# CLAUDE.md

## What

Astro integration for ATProto longform publishing via the `standard.site` lexicon. Syncs blog posts to Leaflet/WhiteWind and aggregates federated comments.

**Package:** `@bryanguffey/astro-standard-site`

## Project Structure

```
src/
  publisher.ts   # Publish to ATProto (stateful, handles auth)
  loader.ts      # Load from ATProto into Astro
  content.ts     # Transform markdown (sidenotes → blockquotes, resolve links)
  comments.ts    # Fetch Bluesky replies as comments
  schemas.ts     # Zod schemas for standard.site lexicons
components/
  Comments.astro # Drop-in comment component
test/
  content.test.ts
```

## Commands

```bash
npm run build    # Compile TypeScript
npm test         # Run tests
```

## Critical: TID Format

Record keys for `site.standard.document` and `site.standard.publication` MUST be TIDs. Schema validation will reject anything else.

**TID requirements:**
- 13 characters, base32-sortable charset: `234567abcdefghijklmnopqrstuvwxyz`
- First char must be `234567abcdefghij` (top bit = 0)
- Regex: `/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/`

See `generateTid()` in `src/publisher.ts` — do not modify without reading https://atproto.com/specs/tid

## Critical: ES Modules

`package.json` must have `"type": "module"`. Without this, imports break.

## Testing Against Real PDS

```bash
ATPROTO_APP_PASSWORD="xxxx" npx tsx scripts/test-atproto.ts
```

For integration testing, use `pds.rip` (throwaway test accounts).

## Reference Docs

Read these before working on specific areas:

| Task | Read First |
|------|------------|
| Understanding the codebase | `agent_docs/architecture.md` |
| Modifying content transform | `agent_docs/content_transformation.md` |
| Changing schemas | `agent_docs/lexicon.md` |
| TID generation issues | `agent_docs/tid_format.md` |
| Publishing to npm | `agent_docs/publishing.md` |
| Adding new exports | `agent_docs/adding_exports.md` |
| Debugging PDS issues | `agent_docs/debugging.md` |

External references:
- ATProto specs: https://atproto.com/
- standard.site: https://standard.site/
- Lexicon explorer: https://pdsls.dev/

## Publishing

OIDC trusted publishing via GitHub Actions. Tag a release → workflow publishes to npm automatically. No token needed.
