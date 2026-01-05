#!/usr/bin/env npx tsx
/**
 * Sync script for Astro blog → ATProto
 * 
 * This script syncs your Astro blog posts to ATProto using the standard.site lexicon,
 * making them available on Leaflet, WhiteWind, and other compatible platforms.
 * 
 * Usage:
 *   ATPROTO_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx" npx tsx scripts/sync-to-atproto.ts
 * 
 * Options:
 *   --dry-run     Preview changes without publishing
 *   --force       Re-publish all posts (ignore existing)
 *   --post=slug   Sync only a specific post
 *   --delete      Delete posts from ATProto that don't exist locally
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';

// Import from the local package (adjust path as needed)
import { 
  StandardSitePublisher, 
  transformContent,
  type PublishDocumentInput,
} from '@bryanguffey/astro-standard-site';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Your site URL
  siteUrl: 'https://example.com',
  
  // Your ATProto handle
  identifier: 'example.bsky.social',
  
  // Path to blog content (relative to project root)
  contentDir: 'src/content/blog',
  
  // Publication metadata
  publication: {
    name: "My blog tite",
    description: 'More about my blog.',
  },
};

// ============================================================================
// Types
// ============================================================================

interface BlogPost {
  slug: string;
  filePath: string;
  frontmatter: {
    title: string;
    description?: string;
    date: Date;
    tags?: string[];
    draft?: boolean;
    // ATProto-specific fields (added after first sync)
    atprotoUri?: string;
    atprotoRkey?: string;
    bskyPostUri?: string;
  };
  body: string;
}

interface SyncResult {
  slug: string;
  action: 'created' | 'updated' | 'skipped' | 'deleted' | 'error';
  uri?: string;
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function parseArgs(): { dryRun: boolean; force: boolean; postSlug?: string; delete: boolean } {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    postSlug: args.find(a => a.startsWith('--post='))?.split('=')[1],
    delete: args.includes('--delete'),
  };
}

async function loadBlogPosts(contentDir: string): Promise<BlogPost[]> {
  const posts: BlogPost[] = [];
  
  try {
    const files = await readdir(contentDir);
    
    for (const file of files) {
      if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
      
      const filePath = join(contentDir, file);
      const content = await readFile(filePath, 'utf-8');
      const { data, content: body } = matter(content);
      
      // Parse the date
      let date: Date;
      if (data.date instanceof Date) {
        date = data.date;
      } else if (typeof data.date === 'string') {
        date = new Date(data.date);
      } else {
        console.warn(`⚠️  Skipping ${file}: no valid date`);
        continue;
      }
      
      // Get slug from filename
      const slug = file.replace(/\.(md|mdx)$/, '');
      
      posts.push({
        slug,
        filePath,
        frontmatter: {
          title: data.title,
          description: data.description,
          date,
          tags: data.tags,
          draft: data.draft ?? false,
          atprotoUri: data.atprotoUri,
          atprotoRkey: data.atprotoRkey,
          bskyPostUri: data.bskyPostUri,
        },
        body,
      });
    }
  } catch (error) {
    console.error('Failed to load blog posts:', error);
    throw error;
  }
  
  // Sort by date (newest first)
  posts.sort((a, b) => b.frontmatter.date.getTime() - a.frontmatter.date.getTime());
  
  return posts;
}

function postToDocument(post: BlogPost, siteUrl: string): PublishDocumentInput {
  const postPath = `/blog/${post.slug}`;
  
  // Transform the content (converts sidenotes, resolves links, extracts plain text)
  const transformed = transformContent(post.body, {
    siteUrl,
    postPath,
  });
  
  return {
    site: siteUrl,
    title: post.frontmatter.title,
    publishedAt: post.frontmatter.date.toISOString(),
    path: postPath,
    description: post.frontmatter.description,
    tags: post.frontmatter.tags,
    textContent: transformed.textContent,
    content: {
      $type: 'site.standard.content.markdown',
      text: transformed.markdown,
      version: '1.0',
    },
    // Note: rkey is auto-generated as a TID per the lexicon spec
  };
}

// ============================================================================
// Main Sync Logic
// ============================================================================

async function sync() {
  const args = parseArgs();
  
  console.log('🚀 Starting ATProto sync for bryanguffey.com\n');
  
  if (args.dryRun) {
    console.log('📋 DRY RUN MODE - no changes will be made\n');
  }
  
  // Check for app password
  const appPassword = process.env.ATPROTO_APP_PASSWORD;
  if (!appPassword) {
    console.error('❌ Missing ATPROTO_APP_PASSWORD environment variable');
    console.error('   Get one from: https://bsky.app/settings/app-passwords');
    process.exit(1);
  }
  
  // Initialize publisher
  const publisher = new StandardSitePublisher({
    identifier: CONFIG.identifier,
    password: appPassword,
  });
  
  try {
    console.log(`🔐 Logging in as ${CONFIG.identifier}...`);
    await publisher.login();
    const did = publisher.getDid();
    const pds = publisher.getPdsUrl();
    console.log(`   ✓ Logged in (DID: ${did})`);
    console.log(`   ✓ PDS: ${pds}\n`);
    
    // Ensure publication exists
    console.log('📚 Checking publication...');
    const publications = await publisher.listPublications();
    const existingPub = publications.find(p => 
      p.value.url === CONFIG.siteUrl || 
      p.uri.endsWith(`/${CONFIG.publication.rkey}`)
    );
    
    if (!existingPub) {
      console.log('   Creating publication...');
      if (!args.dryRun) {
        const pubResult = await publisher.publishPublication({
          name: CONFIG.publication.name,
          url: CONFIG.siteUrl,
          description: CONFIG.publication.description,
        });
        console.log(`   ✓ Created: ${pubResult.uri}\n`);
      } else {
        console.log(`   Would create: ${CONFIG.publication.name}\n`);
      }
    } else {
      console.log(`   ✓ Found existing: ${existingPub.uri}\n`);
    }
    
    // Load local blog posts
    console.log('📖 Loading local blog posts...');
    let posts = await loadBlogPosts(CONFIG.contentDir);
    console.log(`   Found ${posts.length} posts\n`);
    
    // Filter by slug if specified
    if (args.postSlug) {
      posts = posts.filter(p => p.slug === args.postSlug);
      if (posts.length === 0) {
        console.error(`❌ Post not found: ${args.postSlug}`);
        process.exit(1);
      }
      console.log(`   Filtered to: ${args.postSlug}\n`);
    }
    
    // Get existing documents from ATProto
    console.log('🔍 Fetching existing documents from ATProto...');
    const existingDocs = await publisher.listDocuments();
    console.log(`   Found ${existingDocs.length} documents\n`);
    
    // Create lookup maps
    const existingByPath = new Map(
      existingDocs.map(d => [d.value.path, d])
    );
    const existingByRkey = new Map(
      existingDocs.map(d => {
        const rkey = d.uri.split('/').pop()!;
        return [rkey, d];
      })
    );
    
    // Sync each post
    const results: SyncResult[] = [];
    
    console.log('📤 Syncing posts...\n');
    
    for (const post of posts) {
      const postPath = `/blog/${post.slug}`;
      
      // Skip drafts
      if (post.frontmatter.draft) {
        console.log(`   ⏭️  ${post.slug} (draft, skipping)`);
        results.push({ slug: post.slug, action: 'skipped' });
        continue;
      }
      
      try {
        const doc = postToDocument(post, CONFIG.siteUrl);
        const existingDoc = existingByPath.get(postPath) || 
                           (post.frontmatter.atprotoRkey ? existingByRkey.get(post.frontmatter.atprotoRkey) : undefined);
        
        if (existingDoc && !args.force) {
          // Update existing
          const rkey = existingDoc.uri.split('/').pop()!;
          console.log(`   🔄 ${post.slug} (updating)`);
          
          if (!args.dryRun) {
            const result = await publisher.updateDocument(rkey, doc);
            results.push({ slug: post.slug, action: 'updated', uri: result.uri });
            console.log(`      ✓ ${result.uri}`);
          } else {
            results.push({ slug: post.slug, action: 'updated', uri: existingDoc.uri });
            console.log(`      Would update: ${existingDoc.uri}`);
          }
        } else {
          // Create new
          console.log(`   ✨ ${post.slug} (creating)`);
          
          if (!args.dryRun) {
            const result = await publisher.publishDocument(doc);
            results.push({ slug: post.slug, action: 'created', uri: result.uri });
            console.log(`      ✓ ${result.uri}`);
            
            // Extract rkey for future reference
            const rkey = result.uri.split('/').pop();
            console.log(`      💡 Add to frontmatter: atprotoRkey: "${rkey}"`);
          } else {
            results.push({ slug: post.slug, action: 'created' });
            console.log(`      Would create new document`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`   ❌ ${post.slug} (error: ${message})`);
        results.push({ slug: post.slug, action: 'error', error: message });
      }
    }
    
    // Handle deletions if requested
    if (args.delete && !args.postSlug) {
      const localPaths = new Set(posts.map(p => `/blog/${p.slug}`));
      const orphaned = existingDocs.filter(d => d.value.path && !localPaths.has(d.value.path));
      
      if (orphaned.length > 0) {
        console.log('\n🗑️  Deleting orphaned documents...\n');
        
        for (const doc of orphaned) {
          const rkey = doc.uri.split('/').pop()!;
          console.log(`   🗑️  ${doc.value.path || rkey}`);
          
          if (!args.dryRun) {
            await publisher.deleteDocument(rkey);
            results.push({ slug: doc.value.path || rkey, action: 'deleted' });
            console.log(`      ✓ Deleted`);
          } else {
            results.push({ slug: doc.value.path || rkey, action: 'deleted' });
            console.log(`      Would delete`);
          }
        }
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary\n');
    
    const created = results.filter(r => r.action === 'created').length;
    const updated = results.filter(r => r.action === 'updated').length;
    const skipped = results.filter(r => r.action === 'skipped').length;
    const deleted = results.filter(r => r.action === 'deleted').length;
    const errors = results.filter(r => r.action === 'error').length;
    
    console.log(`   ✨ Created: ${created}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   🗑️  Deleted: ${deleted}`);
    console.log(`   ❌ Errors:  ${errors}`);
    
    if (args.dryRun) {
      console.log('\n   (dry run - no changes made)');
    }
    
    console.log('\n✅ Sync complete!\n');
    
    // Tips
    console.log('💡 Tips:');
    console.log(`   • View your documents: https://pdsls.dev/at://${did}/site.standard.document`);
    console.log(`   • View on Leaflet: https://leaflet.pub/${CONFIG.identifier}`);
    console.log(`   • Add atprotoRkey to frontmatter to maintain stable URIs`);
    console.log(`   • Create a Bluesky post announcing each article for comments!`);
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  }
}

// Run
sync();
