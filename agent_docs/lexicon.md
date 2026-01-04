# standard.site Lexicon

## Overview

standard.site is a unified schema for longform publishing on ATProto, enabling interop between Leaflet, WhiteWind, and other platforms.

**Spec:** https://standard.site/  
**Lexicon records:** `at://did:plc:re3ebnp5v7ffagz6rb6xfei4/com.atproto.lexicon.schema/site.standard.*`

## site.standard.document

Individual blog post or article.

**Key:** `tid` (MUST be a valid TID — see `agent_docs/tid_format.md`)

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `site` | string | Publication URL or AT-URI |
| `title` | string | Document title |
| `publishedAt` | datetime | ISO 8601 timestamp |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `path` | string | Path to append to site URL |
| `description` | string | Excerpt/summary |
| `updatedAt` | datetime | Last modified |
| `tags` | string[] | Categories |
| `textContent` | string | Plain text for search |
| `content` | union | Platform-specific content (open union) |
| `bskyPostRef` | strongRef | Link to announcement post |

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

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Publication name |
| `url` | string | Base URL |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | About the publication |
| `basicTheme` | object | Theme colors (see below) |
| `preferences` | object | Display preferences |

### basicTheme

```ts
{
  background: { r: number, g: number, b: number },
  foreground: { r: number, g: number, b: number },
  accent: { r: number, g: number, b: number },
  accentForeground: { r: number, g: number, b: number }
}
```

RGB values 0-255.

### preferences

```ts
{
  showInDiscover?: boolean  // Show in platform discovery feeds
}
```

## Schema Location

Zod schemas are in `src/schemas.ts`. Keep these in sync with the lexicon if standard.site updates.
