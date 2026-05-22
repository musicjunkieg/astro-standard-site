/**
 * site.standard.* lexicon schemas
 *
 * Modeled on the canonical lexicon records published by standard.site (verified
 * against the live `com.atproto.lexicon.schema` records). These provide unified
 * metadata for longform publishing on ATProto, enabling interoperability between
 * Leaflet, WhiteWind, and other platforms.
 *
 * Zod is imported from `astro/zod` so schemas use the exact Zod instance Astro
 * ships (Zod 3 on Astro 5, Zod 4 on Astro 6). Only syntax valid on both major
 * versions is used here so the package works across the supported peer range.
 */

import { z } from 'astro/zod';

// ============================================================================
// site.standard.theme.color
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
// All four colors are required. The lexicon defines NO `preferences` field here.
// ============================================================================

export const ThemeBasicSchema = z.object({
  background: ThemeColorRgbSchema,
  foreground: ThemeColorRgbSchema,
  accent: ThemeColorRgbSchema,
  accentForeground: ThemeColorRgbSchema,
});

export type ThemeBasic = z.infer<typeof ThemeBasicSchema>;

// ============================================================================
// com.atproto.label.defs#selfLabels — self-applied content labels
// ============================================================================

export const SelfLabelsSchema = z.object({
  $type: z.literal('com.atproto.label.defs#selfLabels').optional(),
  values: z.array(z.object({ val: z.string().max(128) })),
});

export type SelfLabels = z.infer<typeof SelfLabelsSchema>;

// Shared blob ref for publication.icon and document.coverImage (image/*, max 1MB)
export const ImageBlobSchema = z.object({
  $type: z.literal('blob').optional(),
  ref: z.object({ $link: z.string() }),
  mimeType: z.string(),
  size: z.number().max(1000000),
});

export type ImageBlob = z.infer<typeof ImageBlobSchema>;

// ============================================================================
// site.standard.publication — key: tid
// ============================================================================

export const PublicationPreferencesSchema = z.object({
  showInDiscover: z.boolean().default(true).optional(),
});

export type PublicationPreferences = z.infer<typeof PublicationPreferencesSchema>;

export const PublicationSchema = z.object({
  $type: z.literal('site.standard.publication').optional(),

  /** Base publication URL (e.g. https://standard.site) - REQUIRED */
  url: z.string().url(),

  /** Square icon (image/*, max 1MB, at least 256x256) */
  icon: ImageBlobSchema.optional(),

  /** Publication name (max 500 graphemes / 5000 bytes) - REQUIRED */
  name: z.string().max(5000),

  /** Brief description (max 3000 graphemes / 30000 bytes) */
  description: z.string().max(30000).optional(),

  /** Self-applied content labels / warnings */
  labels: SelfLabelsSchema.optional(),

  /** Simplified publication theme */
  basicTheme: ThemeBasicSchema.optional(),

  /** Publication preferences */
  preferences: PublicationPreferencesSchema.optional(),
});

export type Publication = z.infer<typeof PublicationSchema>;

// ============================================================================
// site.standard.document — key: tid
// ============================================================================

/** com.atproto.repo.strongRef */
export const StrongRefSchema = z.object({
  uri: z.string(),
  cid: z.string(),
});

export type StrongRef = z.infer<typeof StrongRefSchema>;

/** site.standard.document#contributor */
export const ContributorSchema = z.object({
  did: z.string(),
  role: z.string().max(1000).optional(),
  displayName: z.string().max(1000).optional(),
});

export type Contributor = z.infer<typeof ContributorSchema>;

export const DocumentSchema = z.object({
  $type: z.literal('site.standard.document').optional(),

  /** Publication this document belongs to (at-uri or https) - REQUIRED */
  site: z.string(),

  /** Document title (max 500 graphemes / 5000 bytes) - REQUIRED */
  title: z.string().max(5000),

  /** When the document was published - REQUIRED */
  publishedAt: z.string().datetime({ offset: true }),

  /** Path combined with the site URL to form the full document URL (leading slash) */
  path: z.string().optional(),

  /** Tags/categories (max 128 graphemes / 1280 bytes each) */
  tags: z.array(z.string().max(1280)).optional(),

  /** Platform-specific content (open union — each entry carries its own $type) */
  content: z.unknown().optional(),

  /** Relationships to external resources (open union) */
  links: z.unknown().optional(),

  /** Self-applied content labels / warnings */
  labels: SelfLabelsSchema.optional(),

  /** Additional contributors */
  contributors: z.array(ContributorSchema).optional(),

  /** When the document was last updated */
  updatedAt: z.string().datetime({ offset: true }).optional(),

  /** Cover/hero image (image/*, max 1MB) */
  coverImage: ImageBlobSchema.optional(),

  /** Reference to an associated Bluesky post */
  bskyPostRef: StrongRefSchema.optional(),

  /** Description/excerpt (max 3000 graphemes / 30000 bytes) */
  description: z.string().max(30000).optional(),

  /** Plain text content for indexing/search (no markdown or formatting) */
  textContent: z.string().optional(),
});

export type Document = z.infer<typeof DocumentSchema>;

// ============================================================================
// site.standard.graph.subscription — key: tid
// ============================================================================

export const GraphSubscriptionSchema = z.object({
  $type: z.literal('site.standard.graph.subscription').optional(),
  /** AT-URI of the publication being subscribed to - REQUIRED */
  publication: z.string(),
  createdAt: z.string().datetime({ offset: true }).optional(),
});

export type GraphSubscription = z.infer<typeof GraphSubscriptionSchema>;

// ============================================================================
// site.standard.graph.recommend — key: tid
// ============================================================================

export const GraphRecommendSchema = z.object({
  $type: z.literal('site.standard.graph.recommend').optional(),
  /** AT-URI of the recommended document - REQUIRED */
  document: z.string(),
  createdAt: z.string().datetime({ offset: true }),
});

export type GraphRecommend = z.infer<typeof GraphRecommendSchema>;

// ============================================================================
// AT-URI and Record Types
// ============================================================================

export const AtUriSchema = z.string().regex(
  /^at:\/\/[a-zA-Z0-9._:%-]+\/[a-zA-Z0-9.]+\/[a-zA-Z0-9._~:@!$&'()*+,;=-]+$/,
  'Invalid AT-URI format'
);

export type AtUri = z.infer<typeof AtUriSchema>;

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
   * Exclude documents whose `site` matches this URL.
   * Primary use case: exclude posts you published FROM your Astro blog,
   * so you only load posts written on other platforms (Leaflet, WhiteWind).
   *
   * @example excludeSite: 'https://myblog.com'
   */
  excludeSite: z.string().optional(),

  /** Only load documents whose `site` matches this publication URI */
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
  RECOMMEND: 'site.standard.graph.recommend',
} as const;
