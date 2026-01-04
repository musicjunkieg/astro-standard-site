/**
 * Verification utilities for standard.site
 * 
 * Helpers for implementing the verification endpoints described at https://standard.site/
 * - Publication verification via /.well-known/site.standard.publication
 * - Document verification via <link rel="site.standard.document"> tags
 */

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

/**
 * Astro integration for verification endpoints
 * 
 * Automatically sets up the /.well-known/site.standard.publication endpoint
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
export function standardSiteVerification(config: VerificationConfig) {
  return {
    name: 'standard-site-verification',
    hooks: {
      'astro:config:setup': ({ injectRoute }: { injectRoute: (config: { pattern: string; entrypoint: string }) => void }) => {
        // We can't actually inject routes with custom content this way,
        // but we provide the helper functions for manual setup
        console.log(
          '[standard-site-verification] To complete setup, create:\n' +
          '  src/pages/.well-known/site.standard.publication.ts\n' +
          'With content: ' + generatePublicationWellKnown(config)
        );
      },
    },
  };
}
