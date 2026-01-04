# Content Transformation

## Overview

`src/content.ts` transforms Astro markdown for ATProto compatibility. The main entry point is `transformContent()`.

## Sidenote Conversion

Bryan's site uses custom HTML sidenotes. These must be converted to markdown blockquotes for ATProto.

### Input Format

```html
<div class="sidenote sidenote--tip">
  <span class="sidenote-label">Tip</span>
  <p>This is helpful!</p>
</div>
```

Variants: `sidenote--tip`, `sidenote--warning`, or no modifier (default).

### Output Format

```markdown
> **Tip:** This is helpful!
```

### Implementation

See `convertSidenotes()` and `convertComplexSidenotes()` in `src/content.ts:60-120`.

The complex version handles multi-paragraph sidenotes with nested content.

## Link Resolution

Relative links must become absolute for ATProto (content lives outside your domain).

| Input | Output |
|-------|--------|
| `[About](/about)` | `[About](https://bryanguffey.com/about)` |
| `![Logo](/images/logo.png)` | `![Logo](https://bryanguffey.com/images/logo.png)` |
| `[External](https://other.com)` | unchanged |
| `[Email](mailto:x@y.com)` | unchanged |
| `[Section](#anchor)` | unchanged |

See `resolveRelativeLinks()` in `src/content.ts`.

## Plain Text Extraction

The `textContent` field in standard.site is plain text for search/indexing. 

`stripToPlainText()` removes:
- Markdown formatting (`**bold**` → `bold`)
- Links (keeps text, removes URL)
- Images (removed entirely)
- Code blocks
- HTML tags
- Heading markers

## Pipeline

`transformContent(markdown, options)` runs the full pipeline:

1. `convertComplexSidenotes()` — HTML sidenotes → blockquotes
2. `resolveRelativeLinks()` — relative → absolute URLs
3. `stripToPlainText()` — for textContent field
4. `countWords()` / `calculateReadingTime()` — metadata

Returns:
```ts
{
  markdown: string,      // Cleaned markdown for ATProto
  textContent: string,   // Plain text for indexing
  wordCount: number,
  readingTime: number    // minutes
}
```
