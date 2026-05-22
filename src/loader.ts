/**
 * Astro Content Layer Loader for standard.site
 *
 * Fetches documents from ATProto repositories that use the standard.site lexicon,
 * enabling unified access to content from Leaflet, WhiteWind, and other compatible platforms.
 *
 * Works on Astro 5 and 6: it provides a static Zod schema and validates entries
 * with `parseData` (the Content Layer contract shared by both major versions).
 *
 * @example
 * ```ts
 * // src/content.config.ts
 * import { defineCollection } from 'astro:content';
 * import { standardSiteLoader } from 'astro-standard-site/loader';
 *
 * const blog = defineCollection({
 *   loader: standardSiteLoader({ repo: 'your-handle.bsky.social' }),
 * });
 *
 * export const collections = { blog };
 * ```
 */

import { AtpAgent } from '@atproto/api';
import type { Loader, LoaderContext } from 'astro/loaders';
import { z } from 'astro/zod';
import type { LoaderConfig, Document, Publication } from './schemas.js';
import {
  LoaderConfigSchema,
  DocumentSchema,
  PublicationSchema,
  StrongRefSchema,
  SelfLabelsSchema,
  ContributorSchema,
  COLLECTIONS,
} from './schemas.js';

const blobRefSchema = z.object({
  cid: z.string(),
  mimeType: z.string(),
  size: z.number(),
});

/** Schema for a loaded standard.site document entry. */
export const documentEntrySchema = z.object({
  id: z.string(),
  uri: z.string(),
  cid: z.string(),
  title: z.string(),
  site: z.string(),
  publishedAt: z.coerce.date(),
  path: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
  updatedAt: z.coerce.date().optional(),
  tags: z.array(z.string()),
  coverImage: blobRefSchema.optional(),
  bskyPostRef: StrongRefSchema.optional(),
  labels: SelfLabelsSchema.optional(),
  links: z.unknown().optional(),
  contributors: z.array(ContributorSchema).optional(),
  textContent: z.string().optional(),
  content: z.unknown().optional(),
  _raw: DocumentSchema,
});

export type StandardSiteDocument = z.infer<typeof documentEntrySchema>;

/** Schema for a loaded standard.site publication entry. */
export const publicationEntrySchema = z.object({
  id: z.string(),
  uri: z.string(),
  cid: z.string(),
  name: z.string(),
  url: z.string(),
  description: z.string().optional(),
  icon: blobRefSchema.optional(),
  _raw: PublicationSchema,
});

export type StandardSitePublication = z.infer<typeof publicationEntrySchema>;

/**
 * Parse an AT-URI to extract its components
 */
function parseAtUri(uri: string): { repo: string; collection: string; rkey: string } | null {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return {
    repo: match[1],
    collection: match[2],
    rkey: match[3],
  };
}

/** Normalize a URL for comparison (drop a single trailing slash) */
function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '');
}

/**
 * Creates an Astro Content Layer loader for standard.site documents
 *
 * @param config - Loader configuration
 * @returns Astro loader object
 */
export function standardSiteLoader(config: Partial<LoaderConfig>): Loader {
  const validatedConfig = LoaderConfigSchema.parse(config);

  return {
    name: 'standard-site-loader',
    schema: documentEntrySchema,

    async load({ store, logger, parseData, generateDigest }: LoaderContext) {
      logger.info(`Loading documents from ${validatedConfig.repo}`);

      const agent = new AtpAgent({ service: validatedConfig.service });

      try {
        // Resolve handle to DID if necessary
        let did = validatedConfig.repo;
        if (!did.startsWith('did:')) {
          const resolved = await agent.resolveHandle({ handle: validatedConfig.repo });
          did = resolved.data.did;
          logger.info(`Resolved ${validatedConfig.repo} to ${did}`);
        }

        // Fetch documents from the site.standard.document collection
        const response = await agent.api.com.atproto.repo.listRecords({
          repo: did,
          collection: COLLECTIONS.DOCUMENT,
          limit: validatedConfig.limit,
        });

        logger.info(`Found ${response.data.records.length} documents`);

        // Clear existing entries before loading new ones
        store.clear();

        let loaded = 0;
        for (const record of response.data.records) {
          try {
            const parsed = parseAtUri(record.uri);
            if (!parsed) {
              logger.warn(`Invalid AT-URI: ${record.uri}`);
              continue;
            }

            const docResult = DocumentSchema.safeParse(record.value);
            if (!docResult.success) {
              logger.warn(`Invalid document schema for ${record.uri}: ${docResult.error.message}`);
              continue;
            }

            const doc = docResult.data;

            // Only load documents from a specific publication, if configured
            if (
              validatedConfig.publication &&
              normalizeUrl(doc.site) !== normalizeUrl(validatedConfig.publication)
            ) {
              continue;
            }

            // Exclude documents from a given site (e.g. posts published FROM this blog)
            if (
              validatedConfig.excludeSite &&
              normalizeUrl(doc.site) === normalizeUrl(validatedConfig.excludeSite)
            ) {
              continue;
            }

            // Compute full URL from site + path
            let fullUrl: string | undefined;
            if (doc.path) {
              const baseUrl = normalizeUrl(doc.site);
              const path = doc.path.startsWith('/') ? doc.path : `/${doc.path}`;
              fullUrl = `${baseUrl}${path}`;
            }

            const entry = {
              id: parsed.rkey,
              uri: record.uri,
              cid: record.cid,
              title: doc.title,
              site: doc.site,
              publishedAt: new Date(doc.publishedAt),
              path: doc.path,
              url: fullUrl,
              description: doc.description,
              updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : undefined,
              tags: doc.tags ?? [],
              coverImage: doc.coverImage
                ? {
                    cid: doc.coverImage.ref.$link,
                    mimeType: doc.coverImage.mimeType,
                    size: doc.coverImage.size,
                  }
                : undefined,
              bskyPostRef: doc.bskyPostRef,
              labels: doc.labels,
              links: doc.links,
              contributors: doc.contributors,
              textContent: doc.textContent,
              content: doc.content,
              _raw: doc,
            };

            const data = await parseData({ id: parsed.rkey, data: entry });
            store.set({
              id: parsed.rkey,
              data,
              digest: generateDigest(data),
            });
            loaded++;
          } catch (err) {
            logger.warn(`Error processing record ${record.uri}: ${err}`);
          }
        }

        logger.info(`Successfully loaded ${loaded} documents`);
      } catch (err) {
        logger.error(`Failed to load documents: ${err}`);
        throw err;
      }
    },
  };
}

/**
 * Creates a loader specifically for standard.site publications
 */
export function publicationLoader(config: { repo: string; service?: string }): Loader {
  const service = config.service ?? 'https://public.api.bsky.app';

  return {
    name: 'standard-site-publication-loader',
    schema: publicationEntrySchema,

    async load({ store, logger, parseData, generateDigest }: LoaderContext) {
      logger.info(`Loading publications from ${config.repo}`);

      const agent = new AtpAgent({ service });

      try {
        let did = config.repo;
        if (!did.startsWith('did:')) {
          const resolved = await agent.resolveHandle({ handle: config.repo });
          did = resolved.data.did;
        }

        const response = await agent.api.com.atproto.repo.listRecords({
          repo: did,
          collection: COLLECTIONS.PUBLICATION,
          limit: 100,
        });

        store.clear();

        let loaded = 0;
        for (const record of response.data.records) {
          const parsed = parseAtUri(record.uri);
          if (!parsed) continue;

          const pubResult = PublicationSchema.safeParse(record.value);
          if (!pubResult.success) {
            logger.warn(`Invalid publication schema: ${pubResult.error.message}`);
            continue;
          }

          const pub = pubResult.data;

          const entry = {
            id: parsed.rkey,
            uri: record.uri,
            cid: record.cid,
            name: pub.name,
            url: pub.url,
            description: pub.description,
            icon: pub.icon
              ? {
                  cid: pub.icon.ref.$link,
                  mimeType: pub.icon.mimeType,
                  size: pub.icon.size,
                }
              : undefined,
            _raw: pub,
          };

          const data = await parseData({ id: parsed.rkey, data: entry });
          store.set({
            id: parsed.rkey,
            data,
            digest: generateDigest(data),
          });
          loaded++;
        }

        logger.info(`Loaded ${loaded} publications`);
      } catch (err) {
        logger.error(`Failed to load publications: ${err}`);
        throw err;
      }
    },
  };
}

export type { LoaderConfig };
