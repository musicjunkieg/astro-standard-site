# standard.site Lexicon

## Overview

standard.site is a unified schema for longform publishing on ATProto, enabling interop between Leaflet, WhiteWind, and other platforms.

**Spec:** https://standard.site/
**Lexicon records:** `at://did:plc:re3ebnp5v7ffagz6rb6xfei4/com.atproto.lexicon.schema/site.standard.*`

## site.standard.document

Individual blog post or article.

**Key:** `tid` (MUST be a valid TID — see `agent_docs/tid_format.md`)

### Required Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `site` | string | | Publication URL or AT-URI. Avoid trailing slashes. |
| `title` | string | maxLength: 5000, maxGraphemes: 500 | Document title |
| `publishedAt` | datetime | | ISO 8601 timestamp |

### Optional Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `path` | string | must begin with `/` | Path to append to site URL |
| `description` | string | maxLength: 30000, maxGraphemes: 3000 | Excerpt/summary |
| `updatedAt` | datetime | | Last modified |
| `tags` | string[] | maxLength: 1280, maxGraphemes: 128 per tag | Categories (no `#` prefix) |
| `textContent` | string | | Plain text for search |
| `content` | union | open union | Platform-specific content |
| `coverImage` | blob | less than 1MB | Thumbnail or cover image |
| `bskyPostRef` | strongRef | | Link to announcement post |

### Content Field

The `content` field is an **open union** (`"closed": false`), meaning any `$type` is valid.

We use:
```json
{
  "$type": "site.standard.content.markdown",
  "text": "# Post content...",
  "version": "1.0"
}
```

This type isn't formally published in the lexicon yet, but works because the union is open.

## site.standard.publication

Publication metadata (the blog itself, not individual posts).

**Key:** `tid` (MUST be a valid TID)

### Required Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `name` | string | maxLength: 5000, maxGraphemes: 500 | Publication name |
| `url` | string | avoid trailing slashes | Base URL |

### Optional Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `icon` | blob | min 256x256 | Square image for the publication |
| `description` | string | maxLength: 30000, maxGraphemes: 3000 | About the publication |
| `basicTheme` | ref | site.standard.theme.basic | Theme colors (see below) |
| `preferences` | object | | Display preferences |

### basicTheme (`site.standard.theme.basic`)

All four color fields are **required**:

```ts
{
  background: { r: number, g: number, b: number },
  foreground: { r: number, g: number, b: number },
  accent: { r: number, g: number, b: number },
  accentForeground: { r: number, g: number, b: number }
}
```

RGB values 0-255. RGBA also supported with `a: 0-100`.

### preferences

```ts
{
  showInDiscover?: boolean  // Show in platform discovery feeds
}
```

## site.standard.graph.subscription

Tracks relationships between users and publications. Enables follow features and personalized feeds.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `publication` | at-uri | AT-URI reference to the publication record being subscribed to |

### Example

```json
{
  "$type": "site.standard.graph.subscription",
  "publication": "at://did:plc:abc123/site.standard.publication/3lwafzkjqm25s"
}
```

## Schema Location

Zod schemas are in `src/schemas.ts`. Keep these in sync with the lexicon if standard.site updates.
