# astro-standard-site

The first Astro integration for [standard.site](https://standard.site) — a unified schema for longform publishing on ATProto.

**Write once, publish everywhere.** Sync your Astro blog with any platform that supports the standard.site lexicon, like [pckt](https://pckt.blog)(**soon**), [Leaflet](https://leaflet.pub)(**soon**), and [Offprint](https://offprint.app)
(also **soon**). 

## Features

- 📤 **Publish** — Sync your Astro blog posts to ATProto
- 📥 **Load** — Fetch documents from any ATProto repository  
- 💬 **Comments** — Display Bluesky replies as comments on your blog
- 🔄 **Transform** — Convert sidenotes, resolve relative links, extract plain text
- ✅ **Verify** — Generate `.well-known` endpoints and link tags per spec
- 📝 **Type-safe** — Full TypeScript support with Zod schemas

## Installation

```bash
npm install astro-standard-site
```

## Quick Start

### 1. Publish Your Blog Posts to ATProto

```ts
// scripts/sync-to-atproto.ts
import { getCollection } from 'astro:content';
import { StandardSitePublisher, transformPost } from 'astro-standard-site';

const publisher = new StandardSitePublisher({
  identifier: 'your-handle.bsky.social',
  password: process.env.ATPROTO_APP_PASSWORD!,
});

await publisher.login();
console.log('Logged in! PDS:', publisher.getPdsUrl());

// Get all blog posts
const posts = await getCollection('blog');

for (const post of posts) {
  if (post.data.draft) continue;
  
  // Transform Astro post to standard.site format
  const doc = transformPost(post, { 
    siteUrl: 'https://yourblog.com' 
  });
  
  // Publish to ATProto
  const result = await publisher.publishDocument(doc);
  console.log(`Published: ${post.slug} → ${result.uri}`);
}
```

### 2. Add Comments from Bluesky

```astro
---
// src/layouts/BlogPost.astro
import Comments from 'astro-standard-site/components/Comments.astro';

// After publishing, save the Bluesky post URI in your frontmatter
const { bskyPostUri } = Astro.props.post.data;
---

<article>
  <slot />
</article>

<Comments 
  bskyPostUri={bskyPostUri}
  canonicalUrl={Astro.url.href}
/>
```

### 3. Set Up Verification

```ts
// src/pages/.well-known/site.standard.publication.ts
import type { APIRoute } from 'astro';
import { generatePublicationWellKnown } from 'astro-standard-site';

export const GET: APIRoute = () => {
  return new Response(
    generatePublicationWellKnown({
      did: 'did:plc:your-did-here',
      publicationRkey: 'your-publication-rkey',
    }),
    { headers: { 'Content-Type': 'text/plain' } }
  );
};
```

## API Reference

### Publisher

```ts
import { StandardSitePublisher } from 'astro-standard-site';

const publisher = new StandardSitePublisher({
  identifier: 'handle.bsky.social',  // or DID
  password: process.env.ATPROTO_APP_PASSWORD!,
  // service: 'https://...'  // Optional: auto-resolved from DID
});

await publisher.login();

// Publish a document
await publisher.publishDocument({
  site: 'https://yourblog.com',        // Required
  title: 'My Post',                     // Required
  publishedAt: new Date().toISOString(), // Required
  path: '/blog/my-post',               // Optional
  description: 'A great post',         // Optional
  tags: ['tag1', 'tag2'],              // Optional
  textContent: 'Plain text...',        // Optional (for search)
  content: {                           // Optional (for rendering)
    $type: 'site.standard.content.markdown',
    text: '# My Post\n\nFull markdown...',
  },
});

// Publish a publication (your blog itself)
await publisher.publishPublication({
  name: 'My Blog',
  url: 'https://yourblog.com',
  description: 'Thoughts and writings',
});

// List, update, delete
const docs = await publisher.listDocuments();
await publisher.updateDocument('rkey', { ...updatedData });
await publisher.deleteDocument('rkey');
```

### Content Transformation

```ts
import { 
  transformPost,      // Full Astro post transformation
  transformContent,   // Just the markdown body
  stripToPlainText,   // Extract plain text for textContent
  convertSidenotes,   // HTML sidenotes → markdown blockquotes
} from 'astro-standard-site';

// Transform an Astro blog post
const doc = transformPost(post, { siteUrl: 'https://yourblog.com' });

// Or transform just the content
const { markdown, textContent, wordCount, readingTime } = transformContent(
  rawMarkdown,
  { siteUrl: 'https://yourblog.com' }
);
```

#### Sidenote Conversion

Your HTML sidenotes:
```html
<div class="sidenote sidenote--tip">
  <span class="sidenote-label">Tip</span>
  <p>This is helpful!</p>
</div>
```

Become markdown blockquotes:
```markdown
> **Tip:** This is helpful!
```

### Comments

```ts
import { fetchComments, countComments } from 'astro-standard-site';

// Fetch from a Bluesky post thread
const comments = await fetchComments({
  bskyPostUri: 'at://did:plc:xxx/app.bsky.feed.post/abc123',
  canonicalUrl: 'https://yourblog.com/post',  // Also searches for mentions
  maxDepth: 3,
});

console.log(`${countComments(comments)} comments found`);

// Comments are returned as a tree structure
for (const comment of comments) {
  console.log(`${comment.author.handle}: ${comment.text}`);
  for (const reply of comment.replies || []) {
    console.log(`  ↳ ${reply.author.handle}: ${reply.text}`);
  }
}
```

### Loader (Fetch from ATProto)

```ts
// src/content/config.ts
import { defineCollection } from 'astro:content';
import { standardSiteLoader } from 'astro-standard-site';

// Load documents from any ATProto account
const externalBlog = defineCollection({
  loader: standardSiteLoader({ 
    repo: 'someone.bsky.social',
    // publication: 'at://...',  // Optional: filter by publication
    // limit: 50,                 // Optional: max documents
  }),
});

export const collections = { externalBlog };
```

### Verification

```ts
import { 
  generatePublicationWellKnown,
  generateDocumentLinkTag,
} from 'astro-standard-site';

// For /.well-known/site.standard.publication
const wellKnown = generatePublicationWellKnown({
  did: 'did:plc:xxx',
  publicationRkey: 'my-blog',
});
// Returns: "at://did:plc:xxx/site.standard.publication/my-blog"

// For document <head>
const linkTag = generateDocumentLinkTag({
  did: 'did:plc:xxx',
  documentRkey: 'abc123',
});
// Returns: '<link rel="site.standard.document" href="at://did:plc:xxx/site.standard.document/abc123">'
```

## The standard.site Lexicon

This package implements the full [standard.site](https://standard.site) specification:

### `site.standard.publication`
Represents your blog/publication:
- `url` (required) — Base URL
- `name` (required) — Publication name
- `description` — Brief description
- `icon` — Square image (256x256+, max 1MB)
- `basicTheme` — Color theme for platforms
- `preferences` — Platform-specific settings

### `site.standard.document`
Represents a blog post:
- `site` (required) — Publication URL or AT-URI
- `title` (required) — Post title
- `publishedAt` (required) — ISO 8601 datetime
- `path` — URL path (combines with site)
- `description` — Excerpt/summary
- `tags` — Array of tags
- `updatedAt` — Last modified datetime
- `coverImage` — Hero image (max 1MB)
- `textContent` — Plain text for search/indexing
- `content` — Rich content (open union, platform-specific)
- `bskyPostRef` — Link to Bluesky announcement post

## Workflow: Full Blog Sync

Here's a complete workflow for syncing your Astro blog:

```ts
// scripts/sync.ts
import { getCollection } from 'astro:content';
import { 
  StandardSitePublisher, 
  transformPost,
} from 'astro-standard-site';

async function sync() {
  const publisher = new StandardSitePublisher({
    identifier: process.env.ATPROTO_IDENTIFIER!,
    password: process.env.ATPROTO_APP_PASSWORD!,
  });
  
  await publisher.login();
  const did = publisher.getDid();
  
  // First, ensure publication exists
  const pubs = await publisher.listPublications();
  if (pubs.length === 0) {
    await publisher.publishPublication({
      name: 'My Blog',
      url: 'https://myblog.com',
      description: 'My thoughts and writings',
      rkey: 'my-blog',
    });
  }
  
  // Get existing documents
  const existing = await publisher.listDocuments();
  const existingByPath = new Map(
    existing.map(d => [d.value.path, d])
  );
  
  // Sync all posts
  const posts = await getCollection('blog');
  
  for (const post of posts) {
    if (post.data.draft) continue;
    
    const doc = transformPost(post, { siteUrl: 'https://myblog.com' });
    const existingDoc = existingByPath.get(doc.path);
    
    if (existingDoc) {
      // Update existing
      const rkey = existingDoc.uri.split('/').pop()!;
      await publisher.updateDocument(rkey, doc);
      console.log(`Updated: ${post.slug}`);
    } else {
      // Create new
      const result = await publisher.publishDocument(doc);
      console.log(`Created: ${post.slug} → ${result.uri}`);
    }
  }
  
  console.log('Sync complete!');
}

sync().catch(console.error);
```

Run with:
```bash
ATPROTO_IDENTIFIER="you.bsky.social" \
ATPROTO_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx" \
npx tsx scripts/sync.ts
```

## Resources

- [standard.site specification](https://standard.site)
- [ATProto documentation](https://atproto.com)
- [pdsls.dev](https://pdsls.dev) — Browse ATProto repositories

## License

MIT
