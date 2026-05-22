/**
 * Verification utilities for standard.site
 *
 * Helpers for implementing the verification endpoints described at https://standard.site/
 * - Publication verification via /.well-known/site.standard.publication
 * - Document verification via <link rel="site.standard.document"> tags
 */

import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

export interface VerificationConfig {
  /** Your ATProto DID */
  did: string;
  /** Publication record key */
  publicationRkey: string;
}

/**
 * Generate the content for /.well-known/site.standard.publication
 * 
 * @example
 * ```ts
 * // Astro endpoint: src/pages/.well-known/site.standard.publication.ts
 * import { generatePublicationWellKnown } from 'astro-standard-site';
 * 
 * export const GET = () => {
 *   return new Response(
 *     generatePublicationWellKnown({
 *       did: 'did:plc:abc123',
 *       publicationRkey: 'my-blog',
 *     }),
 *     { headers: { 'Content-Type': 'text/plain' } }
 *   );
 * };
 * ```
 */
export function generatePublicationWellKnown(config: VerificationConfig): string {
  return `at://${config.did}/site.standard.publication/${config.publicationRkey}`;
}

/**
 * Generate the <link> tag for document verification
 * 
 * @example
 * ```astro
 * ---
 * import { generateDocumentLinkTag } from 'astro-standard-site';
 * 
 * const linkTag = generateDocumentLinkTag({
 *   did: 'did:plc:abc123',
 *   documentRkey: 'my-post',
 * });
 * ---
 * <head>
 *   <Fragment set:html={linkTag} />
 * </head>
 * ```
 */
export function generateDocumentLinkTag(config: {
  did: string;
  documentRkey: string;
}): string {
  const atUri = `at://${config.did}/site.standard.document/${config.documentRkey}`;
  return `<link rel="site.standard.document" href="${atUri}">`;
}

/**
 * Generate the AT-URI for a document
 */
export function getDocumentAtUri(did: string, rkey: string): string {
  return `at://${did}/site.standard.document/${rkey}`;
}

/**
 * Generate the AT-URI for a publication
 */
export function getPublicationAtUri(did: string, rkey: string): string {
  return `at://${did}/site.standard.publication/${rkey}`;
}

/**
 * Parse an AT-URI into its components
 */
export function parseAtUri(uri: string): {
  did: string;
  collection: string;
  rkey: string;
} | null {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return {
    did: match[1],
    collection: match[2],
    rkey: match[3],
  };
}

const VIRTUAL_PUBLICATION_URI = 'virtual:standard-site/publication-uri';

/**
 * Astro integration that serves the publication verification endpoint.
 *
 * Injects `/.well-known/site.standard.publication` returning the publication
 * AT-URI, so you no longer have to hand-create the route file. Prerendered, so
 * it works on static (SSG) and on-demand (SSR) sites.
 *
 * @example
 * ```ts
 * // astro.config.mjs
 * import { standardSiteVerification } from 'astro-standard-site';
 *
 * export default defineConfig({
 *   integrations: [
 *     standardSiteVerification({
 *       did: 'did:plc:abc123',
 *       publicationRkey: 'my-blog',
 *     }),
 *   ],
 * });
 * ```
 */
export function standardSiteVerification(config: VerificationConfig): AstroIntegration {
  const publicationAtUri = generatePublicationWellKnown(config);
  const resolvedId = '\0' + VIRTUAL_PUBLICATION_URI;

  return {
    name: 'standard-site-verification',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'standard-site-verification',
                resolveId(id: string) {
                  return id === VIRTUAL_PUBLICATION_URI ? resolvedId : null;
                },
                load(id: string) {
                  return id === resolvedId
                    ? `export const publicationAtUri = ${JSON.stringify(publicationAtUri)};`
                    : null;
                },
              },
            ],
          },
        });

        injectRoute({
          pattern: '/.well-known/site.standard.publication',
          entrypoint: fileURLToPath(new URL('./routes/well-known-publication.js', import.meta.url)),
          prerender: true,
        });
      },
    },
  };
}
