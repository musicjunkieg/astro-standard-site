# CLAUDE.md

## What

Astro integration for ATProto longform publishing via the `standard.site` lexicon. Syncs blog posts to Leaflet/WhiteWind and aggregates federated comments.

**Package:** `@bryanguffey/astro-standard-site`

## Project Structure

```
src/
  index.ts        # Barrel entry point — re-exports the full public API
  publisher.ts    # Publish to ATProto (stateful, handles auth + PDS resolution)
  loader.ts       # Astro content-layer loaders (standardSiteLoader, publicationLoader)
  content.ts      # Transform markdown (sidenotes → blockquotes, resolve links, plain text)
  comments.ts     # Fetch Bluesky replies/mentions as a unified Comment tree
  schemas.ts      # Zod schemas + COLLECTIONS constants for standard.site lexicons
  verification.ts # .well-known / <link> helpers + standardSiteVerification integration
components/
  Comments.astro  # Drop-in comment component (imports from ../dist, so build first)
scripts/
  sync-to-atproto.ts # Example: sync a local Astro blog → ATProto (reference, not shipped)
test/
  content.test.ts    # Vitest unit tests (content transforms + TID regex)
.github/workflows/
  ci.yml          # build + test on push/PR to main
  publish.yml     # OIDC npm publish on GitHub release
tsconfig.json     # tsc → dist/ (ES2022, ESM, declarations)
vitest.config.ts  # node environment, globals off (import from vitest explicitly)
```

The package ships only `dist/`, `components/`, and `README.md`. Subpath exports are
defined in `package.json`: `.` (index), `./loader`, `./publisher`, `./content`,
`./comments`, and `./components/*`.

## Commands

```bash
npm run build       # tsc → dist/ (required before the Comments.astro component works)
npm test            # vitest run (single pass)
npm run test:watch  # vitest watch mode
```

`prepublishOnly` runs `build` then `test`, so a release won't publish if either fails.

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
ATPROTO_APP_PASSWORD="xxxx" npx tsx scripts/sync-to-atproto.ts --dry-run
```

`scripts/sync-to-atproto.ts` is the reference end-to-end harness — edit its `CONFIG`
(identifier, siteUrl, contentDir) before running. Useful flags: `--dry-run`, `--force`,
`--post=slug`, `--delete`. For integration testing, use `pds.rip` (throwaway test accounts).

## Critical: Publisher Config Shape

`StandardSitePublisher` is constructed with `{ identifier, password, service? }` and
validated by `PublisherConfigSchema` — NOT `{ handle, appPassword }` (some README
snippets are out of date). `service` is optional; when omitted the PDS is auto-resolved
from the DID document (`resolveHandle` → `getPdsFromDid`), so it works with any PDS.
Call `await publisher.login()` before any publish/list call.

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

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
