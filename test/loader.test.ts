import { describe, it, expect } from 'vitest';
import { documentEntrySchema, publicationEntrySchema } from '../src/loader.js';

const baseDoc = {
  id: 'abc123',
  uri: 'at://did:plc:x/site.standard.document/abc123',
  cid: 'bafycid',
  title: 'A Post',
  site: 'https://example.com',
  tags: [],
  _raw: {
    site: 'https://example.com',
    title: 'A Post',
    publishedAt: '2026-01-15T00:00:00Z',
  },
};

describe('documentEntrySchema', () => {
  it('accepts a Date publishedAt (write path)', () => {
    const result = documentEntrySchema.safeParse({
      ...baseDoc,
      publishedAt: new Date('2026-01-15T00:00:00Z'),
    });
    expect(result.success).toBe(true);
  });

  it('coerces a serialized string publishedAt back to a Date (read path)', () => {
    const entry = documentEntrySchema.parse({
      ...baseDoc,
      publishedAt: '2026-01-15T00:00:00Z',
    });
    expect(entry.publishedAt).toBeInstanceOf(Date);
  });

  it('keeps the open content union as-is', () => {
    const entry = documentEntrySchema.parse({
      ...baseDoc,
      publishedAt: new Date(),
      content: { $type: 'at.markpub.markdown', text: { markdown: '# Hi' } },
    });
    expect((entry.content as any).$type).toBe('at.markpub.markdown');
  });
});

describe('publicationEntrySchema', () => {
  it('parses a publication entry', () => {
    const result = publicationEntrySchema.safeParse({
      id: 'pub1',
      uri: 'at://did:plc:x/site.standard.publication/pub1',
      cid: 'bafycid',
      name: 'My Blog',
      url: 'https://example.com',
      _raw: { url: 'https://example.com', name: 'My Blog' },
    });
    expect(result.success).toBe(true);
  });
});
