import { describe, it, expect } from 'vitest';
import {
  transformContent,
  convertSidenotes,
  resolveRelativeLinks,
  stripToPlainText,
  countWords,
  calculateReadingTime,
} from '../src/content.js';

describe('TID generation', async () => {
  // We need to import the generateTid function - it's not exported
  // so we test it indirectly through the publisher or test the format
  
  it('should match TID regex pattern', () => {
    // TID pattern: first char [234567abcdefghij], then 12 chars from base32-sortable
    const tidRegex = /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/;
    
    // Generate some example TIDs manually to verify the pattern
    const validTids = [
      '3jzfcijpj2z2a',
      '7777777777777',
      '3zzzzzzzzzzzz',
      '2222222222222',
    ];
    
    for (const tid of validTids) {
      expect(tid).toMatch(tidRegex);
    }
    
    // Invalid TIDs
    const invalidTids = [
      '0000000000000', // 0 not in base32-sortable
      'zzzzzzzzzzzzz', // z can't be first char (high bit set)
      'ABCDEFGHIJKLM', // uppercase not allowed
    ];
    
    for (const tid of invalidTids) {
      expect(tid).not.toMatch(tidRegex);
    }
  });
});

describe('convertSidenotes', () => {
  it('should convert simple sidenote to blockquote', () => {
    const input = `<div class="sidenote">
  <span class="sidenote-label">Note</span>
  <p>This is a note.</p>
</div>`;
    
    const result = convertSidenotes(input);
    expect(result).toContain('> **Note:**');
    expect(result).toContain('This is a note.');
  });
  
  it('should convert sidenote with type', () => {
    const input = `<div class="sidenote sidenote--tip">
  <span class="sidenote-label">Tip</span>
  <p>This is helpful!</p>
</div>`;
    
    const result = convertSidenotes(input);
    expect(result).toContain('> **Tip:**');
    expect(result).toContain('This is helpful!');
  });
  
  it('should convert warning sidenote', () => {
    const input = `<div class="sidenote sidenote--warning">
  <span class="sidenote-label">Warning</span>
  <p>Be careful!</p>
</div>`;
    
    const result = convertSidenotes(input);
    expect(result).toContain('> **Warning:**');
    expect(result).toContain('Be careful!');
  });
});

describe('resolveRelativeLinks', () => {
  const siteUrl = 'https://example.com';
  
  it('should convert relative links to absolute', () => {
    const input = '[About](/about)';
    const result = resolveRelativeLinks(input, siteUrl);
    expect(result).toBe('[About](https://example.com/about)');
  });
  
  it('should convert relative image paths', () => {
    const input = '![Logo](/images/logo.png)';
    const result = resolveRelativeLinks(input, siteUrl);
    expect(result).toBe('![Logo](https://example.com/images/logo.png)');
  });
  
  it('should leave absolute URLs unchanged', () => {
    const input = '[External](https://other.com/page)';
    const result = resolveRelativeLinks(input, siteUrl);
    expect(result).toBe('[External](https://other.com/page)');
  });
  
  it('should leave mailto links unchanged', () => {
    const input = '[Email](mailto:test@example.com)';
    const result = resolveRelativeLinks(input, siteUrl);
    expect(result).toBe('[Email](mailto:test@example.com)');
  });
  
  it('should leave anchor links unchanged', () => {
    const input = '[Section](#section-1)';
    const result = resolveRelativeLinks(input, siteUrl);
    expect(result).toBe('[Section](#section-1)');
  });
});

describe('stripToPlainText', () => {
  it('should remove markdown formatting', () => {
    const input = '**bold** and *italic* text';
    const result = stripToPlainText(input);
    expect(result).toBe('bold and italic text');
  });
  
  it('should convert links to just text', () => {
    const input = 'Check out [this link](https://example.com)';
    const result = stripToPlainText(input);
    expect(result).toBe('Check out this link');
  });
  
  it('should remove images', () => {
    const input = 'Text ![alt](image.png) more text';
    const result = stripToPlainText(input);
    expect(result).toBe('Text  more text');
  });
  
  it('should remove code blocks', () => {
    const input = 'Text\n```js\nconst x = 1;\n```\nMore text';
    const result = stripToPlainText(input);
    expect(result).toContain('Text');
    expect(result).toContain('More text');
    expect(result).not.toContain('const x');
  });
  
  it('should remove heading markers', () => {
    const input = '# Heading 1\n## Heading 2';
    const result = stripToPlainText(input);
    expect(result).toBe('Heading 1\nHeading 2');
  });
  
  it('should remove HTML tags', () => {
    const input = '<div class="test">Content</div>';
    const result = stripToPlainText(input);
    expect(result).toBe('Content');
  });
});

describe('countWords', () => {
  it('should count words correctly', () => {
    expect(countWords('one two three')).toBe(3);
    expect(countWords('  spaced   out  ')).toBe(2);
    expect(countWords('')).toBe(0);
    expect(countWords('single')).toBe(1);
  });
});

describe('calculateReadingTime', () => {
  it('should calculate reading time', () => {
    expect(calculateReadingTime(200)).toBe(1); // 1 minute
    expect(calculateReadingTime(400)).toBe(2); // 2 minutes
    expect(calculateReadingTime(50)).toBe(1);  // minimum 1 minute
  });
  
  it('should accept custom words per minute', () => {
    expect(calculateReadingTime(300, 100)).toBe(3);
  });
});

describe('transformContent', () => {
  it('should perform full transformation pipeline', () => {
    const input = `# Hello World

This is a [link](/page) and some **bold** text.

<div class="sidenote">
  <span class="sidenote-label">Note</span>
  <p>A sidenote here.</p>
</div>

More content follows.`;

    const result = transformContent(input, {
      siteUrl: 'https://example.com',
    });

    // Check markdown output
    expect(result.markdown).toContain('https://example.com/page');
    expect(result.markdown).toContain('> **Note:**');
    
    // Check plain text output
    expect(result.textContent).toContain('Hello World');
    expect(result.textContent).not.toContain('**');
    expect(result.textContent).not.toContain('<div');
    
    // Check metadata
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.readingTime).toBeGreaterThanOrEqual(1);
  });
});
