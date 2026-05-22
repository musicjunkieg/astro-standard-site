import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectDocuments } from '../src/integration.js';

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'std-site-'));
  await writeFile(
    join(dir, 'hello.md'),
    `---\ntitle: Hello\ndate: 2026-01-15\ntags:\n  - a\n  - b\n---\n# Hi\n\nBody **text**.`,
  );
  await writeFile(
    join(dir, 'draft.md'),
    `---\ntitle: Draft\ndate: 2026-01-16\ndraft: true\n---\nNope.`,
  );
  await writeFile(join(dir, 'nodate.md'), `---\ntitle: No Date\n---\nNope.`);
  await writeFile(join(dir, 'ignore.txt'), `not markdown`);
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('collectDocuments', () => {
  it('collects only publishable markdown posts (skips drafts, undated, non-markdown)', async () => {
    const docs = await collectDocuments(dir, 'https://example.com');
    expect(docs).toHaveLength(1);

    const [doc] = docs;
    expect(doc.title).toBe('Hello');
    expect(doc.site).toBe('https://example.com');
    expect(doc.path).toBe('/blog/hello');
    expect(doc.publishedAt).toBe('2026-01-15T00:00:00.000Z');
    expect(doc.tags).toEqual(['a', 'b']);
    expect(doc.textContent).toContain('Hi');
    expect((doc.content as any).$type).toBe('at.markpub.markdown');
    expect((doc.content as any).text.markdown).toContain('Hi');
  });

  it('honors a custom blog base path', async () => {
    const docs = await collectDocuments(dir, 'https://example.com', '/posts');
    expect(docs[0].path).toBe('/posts/hello');
  });

  it('returns an empty list for a missing directory', async () => {
    const docs = await collectDocuments(join(dir, 'does-not-exist'), 'https://example.com');
    expect(docs).toEqual([]);
  });
});
