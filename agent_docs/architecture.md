# Architecture

## Module Responsibilities

| Module | Purpose | Stateful? |
|--------|---------|-----------|
| `publisher.ts` | Authenticate and publish to ATProto | Yes (holds auth session) |
| `loader.ts` | Fetch standard.site docs into Astro content layer | No |
| `content.ts` | Transform markdown for ATProto compatibility | No |
| `comments.ts` | Fetch Bluesky replies/mentions | No |
| `schemas.ts` | Zod schemas matching standard.site lexicons | No |
| `verification.ts` | DID/handle verification utilities | No |

## Data Flow

### Publishing (Astro → ATProto)

```
┌──────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Astro blog post  │────▶│ transformContent│────▶│ publishDocument │
│ (.md file)       │     │ - sidenotes     │     │ - creates TID   │
│                  │     │ - resolve links │     │ - POST to PDS   │
└──────────────────┘     │ - plain text    │     └────────┬────────┘
                         └─────────────────┘              │
                                                          ▼
                         ┌─────────────────────────────────────────┐
                         │ site.standard.document record on PDS   │
                         │ Visible on: Leaflet, WhiteWind, etc.   │
                         └─────────────────────────────────────────┘
```

### Comments (ATProto → Astro)

```
┌───────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Bluesky post      │────▶│ fetchComments   │────▶│ Comments.astro  │
│ announcing article│     │ - get thread    │     │ - render HTML   │
│ (has AT-URI)      │     │ - search mentions│    │ - static output │
└───────────────────┘     │ - build tree    │     └─────────────────┘
                          └─────────────────┘
```

### PDS Resolution

The publisher works with any PDS by resolving it from the DID document:

```
handle (e.g. "chaosgreml.in")
    │
    ▼ resolveHandle()
did:plc:xxxxx
    │
    ▼ getPdsFromDid()
https://pds.example.com (from DID doc service endpoint)
    │
    ▼ AtpAgent.login()
Authenticated session
```

## Lexicons Used

- `site.standard.document` — Blog posts/articles
- `site.standard.publication` — Publication metadata (name, theme, etc.)
- `app.bsky.feed.post` — For linking announcement posts
- `app.bsky.feed.getPostThread` — Fetching comment threads
