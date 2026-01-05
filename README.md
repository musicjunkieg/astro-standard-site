# astro-standard-site

Publish your Astro blog to the federated web. This package connects your blog to [ATProto](https://atproto.com/) (the protocol behind Bluesky) using the [standard.site](https://standard.site/) schema, enabling:

- **Cross-platform publishing** — Your posts appear on Leaflet, Pckt, and other ATProto readers, if enabled
- **Federated comments** — Display Bluesky replies as comments on your blog
- **Verified ownership** — Prove you own your content with cryptographic verification

Created with love by *Bryan Guffey*
## Installation

```bash
npm install @bryanguffey/astro-standard-site
```

## Use Cases

This package supports multiple workflows:

| You want to... | Use |
|----------------|-----|
| Show Bluesky replies as comments | `<Comments />` component |
| Publish Astro posts to ATProto | `StandardSitePublisher` |
| Pull ATProto posts into Astro | `standardSiteLoader` |
| Verify you own your content | Verification helpers |

You can mix and match — use comments without publishing, or publish without loading, etc.

## Quick Start

### 1. Display Bluesky Comments on Your Blog

The fastest way to get started — add federated comments to your existing posts.

**Add to your blog post layout:**

```astro
---
// src/layouts/BlogPost.astro
import Comments from '@bryanguffey/astro-standard-site/components/Comments.astro';

const { bskyPostUri } = Astro.props.frontmatter;
---

<article>
  <slot />
</article>

{bskyPostUri && (
  <Comments 
    bskyPostUri={bskyPostUri}
    canonicalUrl={Astro.url.href}
  />
)}
```

**Add the field to your content schema:**

```ts
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
    // ... your existing fields
    bskyPostUri: z.string().optional(),
  }),
});

export const collections = { blog };
```

**Link a post to Bluesky:**

1. Publish your blog post
2. Share it on Bluesky
3. Copy the post's AT-URI (click ··· → "Copy post link", then convert to AT-URI format)
4. Add it to your post's frontmatter:

```yaml
---
title: "My First Federated Post"
date: 2026-01-15
bskyPostUri: "at://did:plc:your-did/app.bsky.feed.post/abc123def"
---
```

5. Rebuild your site — comments now appear!

> **Tip:** To get the AT-URI from a Bluesky URL like `https://bsky.app/profile/you.bsky.social/post/abc123def`, the format is `at://did:plc:YOUR_DID/app.bsky.feed.post/abc123def`. You can find your DID at [bsky.app/settings](https://bsky.app/settings).

---

## Full Setup: Publish to ATProto

To publish your posts *to* ATProto (not just display comments), you'll need:

1. A Bluesky account (or any ATProto PDS)
2. An [app password](https://bsky.app/settings/app-passwords)

### Create a Publication

First, create a publication record that represents your blog:

```ts
// scripts/create-publication.ts
import { StandardSitePublisher } from '@bryanguffey/astro-standard-site';

const publisher = new StandardSitePublisher({
  handle: 'you.bsky.social',
  appPassword: process.env.ATPROTO_APP_PASSWORD!,
});

await publisher.login();

const result = await publisher.publishPublication({
  name: 'My Awesome Blog',
  url: 'https://yourblog.com',
  description: 'Thoughts on code, life, and everything',
  // Optional: customize your theme colors (RGB 0-255)
  basicTheme: {
    background: { r: 13, g: 17, b: 23 },
    foreground: { r: 230, g: 237, b: 243 },
    accent: { r: 74, g: 124, b: 155 },
    accentForeground: { r: 255, g: 255, b: 255 },
  },
});

console.log('Publication created!');
console.log('AT-URI:', result.uri);
console.log('Save this rkey for verification:', result.uri.split('/').pop());
```

Run it once:

```bash
ATPROTO_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx" npx tsx scripts/create-publication.ts
```

### Publish Posts

Create a sync script to publish your Astro posts:

see example in scripts/sync-to-atproto.ts

### Set Up Verification

Verification lets platforms confirm you own the content. Create a well-known endpoint:

```ts
// src/pages/.well-known/site.standard.publication.ts
import type { APIRoute } from 'astro';
import { generatePublicationWellKnown } from '@bryanguffey/astro-standard-site';

export const GET: APIRoute = () => {
  return new Response(
    generatePublicationWellKnown({
      did: 'did:plc:your-did-here',           // Your DID
      publicationRkey: 'your-rkey-here',        // From create-publication output
    }),
    { headers: { 'Content-Type': 'text/plain' } }
  );
};
```

After deploying, verify it works:

```bash
curl https://yourblog.com/.well-known/site.standard.publication
# Should output: at://did:plc:xxx/site.standard.publication/3abc123xyz789
```

---

## Components

### `<Comments />`

Displays Bluesky replies as a comment section.

```astro
<Comments 
  bskyPostUri="at://did:plc:xxx/app.bsky.feed.post/abc123"
  canonicalUrl="https://yourblog.com/post/my-post"
  maxDepth={3}
  title="Discussion"
  showReplyLink={true}
  class="my-custom-class"
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bskyPostUri` | `string` | — | AT-URI of the Bluesky announcement post |
| `canonicalUrl` | `string` | — | URL of your blog post (for mention search) |
| `maxDepth` | `number` | `3` | Maximum nesting depth for replies |
| `title` | `string` | `"Comments"` | Section heading |
| `showReplyLink` | `boolean` | `true` | Show "Reply on Bluesky" link |
| `class` | `string` | — | Custom CSS class |

**Styling:** The component uses CSS custom properties that inherit from your site's theme:

```css
--color-border-soft
--color-text-primary
--color-text-secondary
--color-text-muted
--color-text-link
--color-bg-elevated
--space-xs, --space-sm, --space-md, --space-lg, --space-xl, --space-2xl
```

---

## API Reference

### `StandardSitePublisher`

Handles authentication and publishing to ATProto.

```ts
import { StandardSitePublisher } from '@bryanguffey/astro-standard-site';

const publisher = new StandardSitePublisher({
  handle: 'you.bsky.social',      // Your handle
  appPassword: 'xxxx-xxxx-xxxx',  // App password (not your main password!)
  // Optional: specify PDS directly (auto-resolved from DID by default)
  pdsUrl: 'https://bsky.social',
});

await publisher.login();
```

#### `publishDocument(input)`

Publish a blog post.

```ts
const result = await publisher.publishDocument({
  // Required
  site: 'https://yourblog.com',
  title: 'My Post Title',
  publishedAt: '2026-01-15T12:00:00Z',
  
  // Recommended
  path: '/blog/my-post',
  description: 'A short excerpt...',
  content: {
    $type: 'site.standard.content.markdown',
    text: '# Full markdown content...',
    version: '1.0',
  },
  textContent: 'Plain text version for search indexing',
  
  // Optional
  updatedAt: '2026-01-16T12:00:00Z',
  tags: ['astro', 'atproto'],
});

console.log(result.uri);  // at://did:plc:xxx/site.standard.document/3abc...
console.log(result.cid);  // Content hash
```

#### `publishPublication(input)`

Create or update your publication metadata.

```ts
const result = await publisher.publishPublication({
  name: 'My Blog',
  url: 'https://yourblog.com',
  description: 'What this blog is about',
  basicTheme: {
    background: { r: 255, g: 255, b: 255 },
    foreground: { r: 0, g: 0, b: 0 },
    accent: { r: 0, g: 102, b: 204 },
    accentForeground: { r: 255, g: 255, b: 255 },
  },
  preferences: {
    showInDiscover: true,
  },
});
```

### `transformContent(markdown, options)`

Transform markdown for ATProto compatibility.

```ts
import { transformContent } from '@bryanguffey/astro-standard-site';

const result = transformContent(markdownString, {
  baseUrl: 'https://yourblog.com',  // For resolving relative links
});

result.markdown;      // Cleaned markdown (sidenotes converted, links resolved)
result.textContent;   // Plain text for search indexing
result.wordCount;     // Number of words
result.readingTime;   // Estimated minutes to read
```

**What it does:**

- Converts HTML sidenotes to markdown blockquotes
- Resolves relative links (`/about` → `https://yourblog.com/about`)
- Strips markdown to plain text for the `textContent` field
- Calculates word count and reading time

### `standardSiteLoader(config)`

Astro Content Layer loader — pull YOUR content written on other platforms (Leaflet, WhiteWind) into your Astro blog.

**Primary use case:** You write posts on Leaflet, and want them to appear on your Astro site — but NOT the posts you published *from* your Astro site to ATProto.

```ts
// src/content/config.ts
import { defineCollection } from 'astro:content';
import { standardSiteLoader } from '@bryanguffey/astro-standard-site';

const federated = defineCollection({
  loader: standardSiteLoader({
    repo: 'me.bsky.social',              // Your ATProto handle or DID
    excludeSite: 'https://myblog.com',   // Skip posts published FROM your Astro blog
  }),
});

export const collections = { federated };
```

| Option | Type | Description |
|--------|------|-------------|
| `repo` | `string` | **Required.** ATProto handle or DID to load from |
| `excludeSite` | `string` | Skip documents with this site URL (your blog) |
| `publication` | `string` | Only load documents from this specific site |
| `limit` | `number` | Max documents to fetch (default: 100) |
| `service` | `string` | PDS endpoint (default: public API) |

**Using loaded documents:**

```astro
---
// src/pages/federated/[...slug].astro
import { getCollection } from 'astro:content';

const posts = await getCollection('federated');
---

{posts.map(post => (
  <article>
    <h2><a href={post.data.url}>{post.data.title}</a></h2>
    <time>{post.data.publishedAt.toLocaleDateString()}</time>
    <p>{post.data.description}</p>
    
    {/* For plain text display */}
    {post.data.textContent && (
      <div>{post.data.textContent}</div>
    )}
    
    {/* Or handle markdown content specifically */}
    {post.data.content?.$type === 'site.standard.content.markdown' && (
      <div set:html={marked(post.data.content.text)} />
    )}
  </article>
))}
```

**Loaded document fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Record key (TID) |
| `uri` | `string` | Full AT-URI |
| `title` | `string` | Document title |
| `site` | `string` | Source publication URL |
| `publishedAt` | `Date` | Publication date |
| `path` | `string?` | Path segment |
| `url` | `string?` | Full URL (site + path) |
| `description` | `string?` | Excerpt |
| `tags` | `string[]` | Categories |
| `textContent` | `string?` | Plain text for display/search |
| `content` | `unknown` | Platform-specific content (see below) |
| `_raw` | `Document` | Full raw record |

**About the `content` field:**

The `content` field is an open union — different platforms use different types. Use `textContent` for simple display, or check `content.$type` for rich rendering:

```ts
// Markdown content (Leaflet, this package)
if (post.data.content?.$type === 'site.standard.content.markdown') {
  const markdown = post.data.content.text;
}

// Or just use textContent for plain text
const plainText = post.data.textContent;
```

### `publicationLoader(config)`

Load publication metadata (blog info, not posts):

```ts
const publications = defineCollection({
  loader: publicationLoader({ repo: 'someone.bsky.social' }),
});
```

### `fetchComments(options)`

Fetch comments programmatically (used internally by the Comments component).

```ts
import { fetchComments } from '@bryanguffey/astro-standard-site';

const comments = await fetchComments({
  bskyPostUri: 'at://did:plc:xxx/app.bsky.feed.post/abc123',
  canonicalUrl: 'https://yourblog.com/post/my-post',
  maxDepth: 3,
});

// Returns array of Comment objects with nested replies
```

### Verification Helpers

```ts
import { 
  generatePublicationWellKnown,
  generateDocumentLinkTag,
  getDocumentAtUri,
  getPublicationAtUri,
  parseAtUri,
} from '@bryanguffey/astro-standard-site';

// For /.well-known/site.standard.publication endpoint
generatePublicationWellKnown({ did: '...', publicationRkey: '...' });
// → "at://did:plc:xxx/site.standard.publication/abc123"

// For <head> tag to verify individual documents
generateDocumentLinkTag({ did: '...', documentRkey: '...' });
// → '<link rel="site.standard.document" href="at://...">'

// Build AT-URIs
getDocumentAtUri('did:plc:xxx', '3abc123');
// → "at://did:plc:xxx/site.standard.document/3abc123"

// Parse AT-URIs
parseAtUri('at://did:plc:xxx/site.standard.document/3abc123');
// → { did: 'did:plc:xxx', collection: 'site.standard.document', rkey: '3abc123' }
```

---

## Workflow Tips

### Getting Your DID

Your DID is your permanent identifier on ATProto. Find it at:
- [bsky.app/settings](https://bsky.app/settings) → scroll to "DID"
- Or: `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=you.bsky.social`

### Getting AT-URIs from Bluesky URLs

Bluesky web URLs look like:
```
https://bsky.app/profile/you.bsky.social/post/3abc123xyz
```

The AT-URI format is:
```
at://did:plc:YOUR_DID/app.bsky.feed.post/3abc123xyz
```

### Viewing Your Published Content

After publishing, view your records at:
- `https://pdsls.dev/at://YOUR_DID/site.standard.publication`
- `https://pdsls.dev/at://YOUR_DID/site.standard.document`

### Comments Appear at Build Time

Comments are fetched when you build your site (static). To show new comments, rebuild and redeploy. For high-traffic sites, consider scheduled rebuilds or on-demand ISR.

---

## Troubleshooting

### "Failed to resolve handle"

- Check your handle is correct
- Verify your PDS is reachable
- Make sure you're using an app password, not your main password

### "Schema validation failed" / "invalid TID"

Record keys must be TIDs (timestamp identifiers). The package generates these automatically — if you see this error, you may be using an older version or passing a custom rkey.

### Comments not appearing

1. Verify the `bskyPostUri` is correct (AT-URI format, not web URL)
2. Check the Bluesky post exists and has public replies
3. Rebuild your site after adding the URI

### Verification endpoint returning 404

- Ensure the file is at `src/pages/.well-known/site.standard.publication.ts`
- The `.well-known` folder needs to be inside `pages/`
- Check your hosting platform allows `.well-known` paths

---

## How It Works

This package implements the [standard.site](https://standard.site/) specification, which defines a common schema for longform content on ATProto. This means:

1. **Your content is portable** — It lives in your ATProto repository, not locked to any platform
2. **Multiple readers** — Leaflet, WhiteWind, and future apps can all display your posts
3. **Federated engagement** — Comments and likes from any ATProto app appear on your blog
4. **Verified ownership** — The `.well-known` endpoint proves you control the content

---

## Links

- [standard.site specification](https://standard.site/)
- [ATProto documentation](https://atproto.com/)
- [Bluesky](https://bsky.app/)
- [Leaflet](https://leaflet.pub/) — ATProto blog reader
- [Pckt](https://pckt.blog) — Another ATProto blog platform
- [pdsls.dev](https://pdsls.dev/) — Browse ATProto records

---

## License

MIT
