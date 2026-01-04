/**
 * Astro Content Layer Loader for standard.site
 * 
 * Fetches documents from ATProto repositories that use the standard.site lexicon,
 * enabling unified access to content from Leaflet, WhiteWind, and other compatible platforms.
 * 
 * @example
 * ```ts
 * // src/content/config.ts
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
import type { LoaderConfig, Document, Publication } from './schemas.js';
import { 
  LoaderConfigSchema, 
  DocumentSchema, 
  PublicationSchema,
  COLLECTIONS 
} from './schemas.js';

export interface StandardSiteDocument {
  /** Unique ID derived from the record key (tid) */
  id: string;
  /** Full AT-URI of the document */
  uri: string;
  /** Content hash (CID) */
  cid: string;
  /** Document title - REQUIRED */
  title: string;
  /** Site/publication URI (https or at-uri) - REQUIRED */
  site: string;
  /** When published - REQUIRED */
  publishedAt: Date;
  /** Path to append to site URL */
  path?: string;
  /** Full URL (computed from site + path if available) */
  url?: string;
  /** Document description/excerpt */
  description?: string;
  /** Last updated date */
  updatedAt?: Date;
  /** Tags/categories */
  tags: string[];
  /** Cover image blob reference */
  coverImage?: {
    cid: string;
    mimeType: string;
    size: number;
  };
  /** Reference to associated Bluesky post */
  bskyPostRef?: {
    uri: string;
    cid: string;
  };
  /** Plain text content for search/indexing */
  textContent?: string;
  /** Platform-specific content (varies by platform) */
  content?: unknown;
  /** Raw record value for advanced use cases */
  _raw: Document;
}

export interface StandardSitePublication {
  /** Unique ID derived from the record key */
  id: string;
  /** Full AT-URI */
  uri: string;
  /** Content hash */
  cid: string;
  /** Publication name */
  name: string;
  /** Base URL */
  url: string;
  /** Description */
  description?: string;
  /** Icon blob reference */
  icon?: {
    cid: string;
    mimeType: string;
    size: number;
  };
  /** Raw record value */
  _raw: Publication;
}

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

/**
 * Creates an Astro Content Layer loader for standard.site documents
 * 
 * @param config - Loader configuration
 * @returns Astro loader object
 */
export function standardSiteLoader(config: Partial<LoaderConfig>) {
  const validatedConfig = LoaderConfigSchema.parse(config);
  
  return {
    name: 'standard-site-loader',
    
    async load({ store, logger, generateDigest }: {
      store: {
        set: (entry: { id: string; data: unknown; digest?: string }) => void;
        clear: () => void;
      };
      logger: {
        info: (msg: string) => void;
        warn: (msg: string) => void;
        error: (msg: string) => void;
      };
      generateDigest: (data: unknown) => string;
    }) {
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
        
        // Fetch documents from the standard.site.document collection
        const response = await agent.api.com.atproto.repo.listRecords({
          repo: did,
          collection: COLLECTIONS.DOCUMENT,
          limit: validatedConfig.limit,
        });
        
        logger.info(`Found ${response.data.records.length} documents`);
        
        // Clear existing entries before loading new ones
        store.clear();
        
        for (const record of response.data.records) {
          try {
            // Parse and validate the document
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
            
            // Filter by site/publication if specified
            if (validatedConfig.publication && doc.site !== validatedConfig.publication) {
              continue;
            }
            
            // Compute full URL from site + path
            let fullUrl: string | undefined;
            if (doc.path) {
              const baseUrl = doc.site.replace(/\/$/, '');
              const path = doc.path.startsWith('/') ? doc.path : `/${doc.path}`;
              fullUrl = `${baseUrl}${path}`;
            }
            
            // Transform to loader entry
            const entry: StandardSiteDocument = {
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
              coverImage: doc.coverImage ? {
                cid: doc.coverImage.ref.$link,
                mimeType: doc.coverImage.mimeType,
                size: doc.coverImage.size,
              } : undefined,
              bskyPostRef: doc.bskyPostRef,
              textContent: doc.textContent,
              content: doc.content,
              _raw: doc,
            };
            
            store.set({
              id: entry.id,
              data: entry,
              digest: generateDigest(entry),
            });
          } catch (err) {
            logger.warn(`Error processing record ${record.uri}: ${err}`);
          }
        }
        
        logger.info(`Successfully loaded ${response.data.records.length} documents`);
      } catch (err) {
        logger.error(`Failed to load documents: ${err}`);
        throw err;
      }
    },
    
    /** Schema for Astro content collections */
    schema: () => ({
      id: { type: 'string' as const },
      uri: { type: 'string' as const },
      cid: { type: 'string' as const },
      title: { type: 'string' as const, optional: true },
      description: { type: 'string' as const, optional: true },
      url: { type: 'string' as const, optional: true },
      publishedAt: { type: 'date' as const, optional: true },
      updatedAt: { type: 'date' as const, optional: true },
      tags: { type: 'array' as const, items: { type: 'string' as const } },
      visibility: { type: 'string' as const, enum: ['public', 'unlisted', 'private'] },
      publication: { type: 'string' as const, optional: true },
    }),
  };
}

/**
 * Creates a loader specifically for standard.site publications
 */
export function publicationLoader(config: { repo: string; service?: string }) {
  return {
    name: 'standard-site-publication-loader',
    
    async load({ store, logger, generateDigest }: {
      store: {
        set: (entry: { id: string; data: unknown; digest?: string }) => void;
        clear: () => void;
      };
      logger: {
        info: (msg: string) => void;
        warn: (msg: string) => void;
        error: (msg: string) => void;
      };
      generateDigest: (data: unknown) => string;
    }) {
      const service = config.service ?? 'https://bsky.social';
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
        
        for (const record of response.data.records) {
          const parsed = parseAtUri(record.uri);
          if (!parsed) continue;
          
          const pubResult = PublicationSchema.safeParse(record.value);
          if (!pubResult.success) {
            logger.warn(`Invalid publication schema: ${pubResult.error.message}`);
            continue;
          }
          
          const pub = pubResult.data;
          
          const entry: StandardSitePublication = {
            id: parsed.rkey,
            uri: record.uri,
            cid: record.cid,
            name: pub.name,
            url: pub.url,
            description: pub.description,
            icon: pub.icon ? {
              cid: pub.icon.ref.$link,
              mimeType: pub.icon.mimeType,
              size: pub.icon.size,
            } : undefined,
            _raw: pub,
          };
          
          store.set({
            id: entry.id,
            data: entry,
            digest: generateDigest(entry),
          });
        }
        
        logger.info(`Loaded ${response.data.records.length} publications`);
      } catch (err) {
        logger.error(`Failed to load publications: ${err}`);
        throw err;
      }
    },
  };
}

export type { LoaderConfig };
