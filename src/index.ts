/**
 * astro-standard-site
 * 
 * The first Astro integration for standard.site - unified ATProto longform publishing.
 * 
 * This package provides:
 * - A loader for fetching documents from ATProto repositories
 * - A publisher for syncing your Astro content to ATProto platforms (Leaflet, WhiteWind, etc.)
 * - Content transformation utilities (sidenotes, relative links, plain text extraction)
 * - Comment aggregation from Bluesky and other ATProto platforms
 * - Verification utilities for the standard.site specification
 * - Type-safe schemas matching the lexicon definitions
 * 
 * @example
 * ```ts
 * // Publish a blog post to ATProto
 * import { StandardSitePublisher, transformPost } from 'astro-standard-site';
 * 
 * const publisher = new StandardSitePublisher({
 *   identifier: 'your-handle.bsky.social',
 *   password: process.env.ATPROTO_APP_PASSWORD!,
 * });
 * 
 * await publisher.login();
 * const doc = transformPost(post, { siteUrl: 'https://yoursite.com' });
 * await publisher.publishDocument(doc);
 * ```
 * 
 * @example
 * ```ts
 * // Fetch comments from Bluesky
 * import { fetchComments } from 'astro-standard-site';
 * 
 * const comments = await fetchComments({
 *   bskyPostUri: 'at://did:plc:xxx/app.bsky.feed.post/abc123',
 *   canonicalUrl: 'https://yoursite.com/blog/post',
 * });
 * ```
 * 
 * @see https://standard.site for the specification
 */

// Re-export loader
export { 
  standardSiteLoader, 
  publicationLoader,
  type StandardSiteDocument,
  type StandardSitePublication,
  type LoaderConfig,
} from './loader.js';

// Re-export publisher
export { 
  StandardSitePublisher,
  type PublishDocumentInput,
  type PublishPublicationInput,
  type PublishResult,
  type PublisherConfig,
} from './publisher.js';

// Re-export schemas
export {
  // Zod schemas
  PublicationSchema,
  DocumentSchema,
  ThemeBasicSchema,
  ThemeColorSchema,
  StrongRefSchema,
  LoaderConfigSchema,
  PublisherConfigSchema,
  AtUriSchema,
  
  // Types
  type Publication,
  type Document,
  type ThemeBasic,
  type ThemeColor,
  type StrongRef,
  
  // Constants
  COLLECTIONS,
} from './schemas.js';

// Re-export verification utilities
export {
  generatePublicationWellKnown,
  generateDocumentLinkTag,
  getDocumentAtUri,
  getPublicationAtUri,
  parseAtUri,
  standardSiteVerification,
  type VerificationConfig,
} from './verification.js';

// Re-export content transformation utilities
export {
  transformContent,
  transformPost,
  convertSidenotes,
  convertComplexSidenotes,
  resolveRelativeLinks,
  stripToPlainText,
  countWords,
  calculateReadingTime,
  type TransformOptions,
  type TransformResult,
  type AstroBlogPost,
  type StandardSiteDocumentInput,
} from './content.js';

// Re-export comment utilities
export {
  fetchComments,
  fetchBlueskyReplies,
  searchBlueskyMentions,
  buildCommentTree,
  flattenComments,
  countComments,
  type Comment,
  type Author,
  type FetchCommentsOptions,
} from './comments.js';
