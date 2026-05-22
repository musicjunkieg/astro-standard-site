/**
 * Opt-in Astro integration that publishes your blog to ATProto on build.
 *
 * Folds the standalone sync script into the package: it reads markdown from a
 * content directory, transforms it, and publishes site.standard.document records
 * after `astro build`. It is gated by an environment flag so preview/CI builds
 * never publish by accident.
 *
 * Requires the `gray-matter` package (loaded lazily, only when publishing).
 *
 * @example
 * ```ts
 * // astro.config.mjs
 * import { standardSitePublishing } from 'astro-standard-site';
 *
 * export default defineConfig({
 *   integrations: [
 *     standardSitePublishing({
 *       identifier: 'you.bsky.social',
 *       siteUrl: 'https://yourblog.com',
 *     }),
 *   ],
 * });
 * ```
 *
 * Then publish a build with:
 *   STANDARD_SITE_PUBLISH=true ATPROTO_APP_PASSWORD="xxxx" astro build
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AstroIntegration } from 'astro';
import { StandardSitePublisher, type PublishDocumentInput } from './publisher.js';
import { transformContent } from './content.js';

export interface PublishIntegrationConfig {
  /** Handle or DID to authenticate as */
  identifier: string;
  /** Canonical base URL of your site (used as the document `site`) */
  siteUrl: string;
  /** Directory of markdown posts, relative to project root (default: src/content/blog) */
  contentDir?: string;
  /** URL path prefix for posts, used to build each document `path` (default: /blog) */
  blogBasePath?: string;
  /** Publication metadata to create on first publish */
  publication?: { name: string; description?: string };
  /** Env var that must equal "true" to publish (default: STANDARD_SITE_PUBLISH) */
  envFlag?: string;
  /** Env var holding the app password (default: ATPROTO_APP_PASSWORD) */
  passwordEnv?: string;
  /** PDS service URL (auto-resolved from the DID when omitted) */
  service?: string;
}

type Frontmatter = {
  title?: string;
  description?: string;
  date?: string | Date;
  tags?: string[];
  draft?: boolean;
};

async function loadGrayMatter(): Promise<(input: string) => { data: Frontmatter; content: string }> {
  // Non-literal specifier keeps gray-matter an optional, lazily-resolved dependency.
  const specifier = 'gray-matter';
  try {
    const mod: any = await import(specifier);
    return mod.default ?? mod;
  } catch {
    throw new Error(
      "standardSitePublishing requires the 'gray-matter' package. Install it with `npm i -D gray-matter`.",
    );
  }
}

/**
 * Read markdown posts from a directory and build publishable documents.
 * Skips drafts and files without a valid date. Network-free and testable.
 */
export async function collectDocuments(
  contentDir: string,
  siteUrl: string,
  blogBasePath = '/blog',
): Promise<PublishDocumentInput[]> {
  const matter = await loadGrayMatter();
  const base = blogBasePath.replace(/\/$/, '');

  let files: string[];
  try {
    files = await readdir(contentDir);
  } catch {
    return [];
  }

  const docs: PublishDocumentInput[] = [];
  for (const file of files) {
    if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;

    const raw = await readFile(join(contentDir, file), 'utf-8');
    const { data, content } = matter(raw);

    if (data.draft) continue;
    if (!data.title) continue;

    const date = data.date instanceof Date ? data.date : new Date(data.date ?? NaN);
    if (Number.isNaN(date.getTime())) continue;

    const slug = file.replace(/\.(md|mdx)$/, '');
    const path = `${base}/${slug}`;
    const transformed = transformContent(content, { siteUrl, postPath: path });

    docs.push({
      site: siteUrl,
      title: data.title,
      publishedAt: date.toISOString(),
      path,
      description: data.description,
      tags: data.tags,
      textContent: transformed.textContent,
      content: {
        $type: 'at.markpub.markdown',
        text: { markdown: transformed.markdown },
        flavor: 'commonmark',
      },
    });
  }

  return docs;
}

export function standardSitePublishing(config: PublishIntegrationConfig): AstroIntegration {
  const flag = config.envFlag ?? 'STANDARD_SITE_PUBLISH';
  const passwordEnv = config.passwordEnv ?? 'ATPROTO_APP_PASSWORD';
  const contentDir = config.contentDir ?? 'src/content/blog';

  return {
    name: 'standard-site-publishing',
    hooks: {
      'astro:build:done': async ({ logger }) => {
        if (process.env[flag] !== 'true') {
          logger.info(`Skipping ATProto publish (set ${flag}=true to publish).`);
          return;
        }

        const password = process.env[passwordEnv];
        if (!password) {
          logger.warn(`Skipping ATProto publish: ${passwordEnv} is not set.`);
          return;
        }

        const documents = await collectDocuments(contentDir, config.siteUrl, config.blogBasePath);
        if (documents.length === 0) {
          logger.info('No documents found to publish.');
          return;
        }

        const publisher = new StandardSitePublisher({
          identifier: config.identifier,
          password,
          service: config.service,
        });
        await publisher.login();

        if (config.publication) {
          const existing = await publisher.listPublications();
          if (!existing.some((p) => p.value.url === config.siteUrl)) {
            await publisher.publishPublication({
              name: config.publication.name,
              url: config.siteUrl,
              description: config.publication.description,
            });
            logger.info(`Created publication for ${config.siteUrl}`);
          }
        }

        const existingDocs = await publisher.listDocuments();
        const byPath = new Map(existingDocs.map((d) => [d.value.path, d]));

        let created = 0;
        let updated = 0;
        for (const doc of documents) {
          const match = doc.path ? byPath.get(doc.path) : undefined;
          if (match) {
            const rkey = match.uri.split('/').pop()!;
            await publisher.updateDocument(rkey, doc);
            updated++;
          } else {
            await publisher.publishDocument(doc);
            created++;
          }
        }

        logger.info(`Published to ATProto: ${created} created, ${updated} updated.`);
      },
    },
  };
}
