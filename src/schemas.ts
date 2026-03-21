/**
 * site.standard.* lexicon schemas
 * 
 * Based on https://standard.site/ specification
 * These schemas provide unified metadata for longform publishing on ATProto,
 * enabling interoperability between Leaflet, WhiteWind, and other platforms.
 */

import { z } from 'zod';

// ============================================================================
// site.standard.theme.color
// Color definitions for themes
// ============================================================================

export const ThemeColorRgbSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
});

export const ThemeColorRgbaSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
  a: z.number().int().min(0).max(100),
});

export const ThemeColorSchema = z.union([ThemeColorRgbSchema, ThemeColorRgbaSchema]);

export type ThemeColor = z.infer<typeof ThemeColorSchema>;
export type ThemeColorRgb = z.infer<typeof ThemeColorRgbSchema>;
export type ThemeColorRgba = z.infer<typeof ThemeColorRgbaSchema>;

// ============================================================================
// site.standard.theme.basic
// Simplified publication theme for tools or apps to easily implement
// ============================================================================

export const ThemeBasicSchema = z.object({
  background: ThemeColorRgbSchema,
  foreground: ThemeColorRgbSchema,
  accent: ThemeColorRgbSchema,
  accentForeground: ThemeColorRgbSchema,
});

export type ThemeBasic = z.infer<typeof ThemeBasicSchema>;

// ============================================================================
// site.standard.publication
// Represents a publication (blog, newsletter, etc.)
// Key: tid (timestamp-based identifier)
// ============================================================================

export const PublicationPreferencesSchema = z.object({
  showInDiscover: z.boolean().default(true).optional(),
});

export type PublicationPreferences = z.infer<typeof PublicationPreferencesSchema>;

export const PublicationSchema = z.object({
  $type: z.literal('site.standard.publication').optional(),
  
  /** Base publication URL (e.g., https://standard.site) - REQUIRED */
  url: z.string().url(),
  
  /** Square image to identify the publication (at least 256x256, max 1MB) */
  icon: z.object({
    $type: z.literal('blob').optional(),
    ref: z.object({
      $link: z.string(),
    }),
    mimeType: z.string(),
    size: z.number().max(1000000),
  }).optional(),
  
  /** The name of the publication (maxLength: 5000, maxGraphemes: 500) - REQUIRED */
  name: z.string().max(5000),

  /** Brief description of the publication (maxLength: 30000, maxGraphemes: 3000) */
  description: z.string().max(30000).optional(),
  
  /** Simplified publication theme for tools/apps */
  basicTheme: ThemeBasicSchema.optional(),
  
  /** Publication preferences */
  preferences: PublicationPreferencesSchema.optional(),
});

export type Publication = z.infer<typeof PublicationSchema>;

// ============================================================================
// site.standard.document
// Represents a document/post in a publication
// Key: tid (timestamp-based identifier)
// ============================================================================

/** Strong reference to another ATProto record */
export const StrongRefSchema = z.object({
  uri: z.string(),
  cid: z.string(),
});

export type StrongRef = z.infer<typeof StrongRefSchema>;

export const DocumentSchema = z.object({
  $type: z.literal('site.standard.document').optional(),
  
  /** URI to the site or publication this document belongs to (https or at-uri) */
  site: z.string(),
  
  /** Document title (maxLength: 5000, maxGraphemes: 500) */
  title: z.string().max(5000),
  
  /** When the document was published */
  publishedAt: z.string().datetime(),
  
  /** Path to combine with site URL to construct full document URL */
  path: z.string().optional(),
  
  /** Tags/categories for the document (maxLength: 1280, maxGraphemes: 128 per tag) */
  tags: z.array(z.string().max(1280)).optional(),
  
  /** Platform-specific content (open union - can be any type) */
  content: z.unknown().optional(),
  
  /** When the document was last updated */
  updatedAt: z.string().datetime().optional(),
  
  /** Cover/hero image (max 1MB, image/*) */
  coverImage: z.object({
    $type: z.literal('blob').optional(),
    ref: z.object({
      $link: z.string(),
    }),
    mimeType: z.string(),
    size: z.number().max(1000000),
  }).optional(),
  
  /** Reference to associated Bluesky post */
  bskyPostRef: StrongRefSchema.optional(),
  
  /** Document description/excerpt (maxLength: 30000, maxGraphemes: 3000) */
  description: z.string().max(30000).optional(),
  
  /** Plain text content for indexing/search */
  textContent: z.string().optional(),
});

export type Document = z.infer<typeof DocumentSchema>;

// ============================================================================
// AT-URI and Record Types
// ============================================================================

export const AtUriSchema = z.string().regex(
  /^at:\/\/[a-zA-Z0-9._:%-]+\/[a-zA-Z0-9.]+\/[a-zA-Z0-9._~:@!$&'()*+,;=-]+$/,
  'Invalid AT-URI format'
);

export type AtUri = z.infer<typeof AtUriSchema>;

// ============================================================================
// site.standard.graph.subscription
// Tracks relationships between users and publications
// ============================================================================

export const SubscriptionSchema = z.object({
  $type: z.literal('site.standard.graph.subscription').optional(),

  /** AT-URI reference to the publication record being subscribed to */
  publication: AtUriSchema,
});

export type Subscription = z.infer<typeof SubscriptionSchema>;

/** Record returned from a PDS with full metadata */
export const StandardSiteRecordSchema = z.object({
  uri: AtUriSchema,
  cid: z.string(),
  value: z.union([PublicationSchema, DocumentSchema]),
});

export type StandardSiteRecord = z.infer<typeof StandardSiteRecordSchema>;

// ============================================================================
// Loader Configuration
// ============================================================================

export const LoaderConfigSchema = z.object({
  /** DID or handle of the account to load documents from */
  repo: z.string(),
  
  /** PDS service URL (defaults to public.api.bsky.app for reads) */
  service: z.string().url().default('https://public.api.bsky.app'),
  
  /** 
   * Exclude documents from this site URL.
   * Primary use case: exclude posts you published FROM your Astro blog,
   * so you only load posts written on other platforms (Leaflet, WhiteWind).
   * 
   * @example excludeSite: 'https://myblog.com'
   */
  excludeSite: z.string().optional(),
  
  /** Only load documents from a specific site/publication URI */
  publication: z.string().optional(),
  
  /** Maximum number of documents to load */
  limit: z.number().positive().default(100),
});

export type LoaderConfig = z.infer<typeof LoaderConfigSchema>;

// ============================================================================
// Publisher Configuration
// ============================================================================

export const PublisherConfigSchema = z.object({
  /** PDS service URL (auto-resolved from DID if not provided) */
  service: z.string().url().optional(),
  
  /** Handle or DID for authentication */
  identifier: z.string(),
  
  /** App password for authentication */
  password: z.string(),
  
  /** Publication AT-URI to publish documents to */
  publication: z.string().optional(),
});

export type PublisherConfig = z.infer<typeof PublisherConfigSchema>;

// ============================================================================
// Collection Names
// ============================================================================

export const COLLECTIONS = {
  PUBLICATION: 'site.standard.publication',
  DOCUMENT: 'site.standard.document',
  SUBSCRIPTION: 'site.standard.graph.subscription',
} as const;
