/**
 * Content transformation utilities for standard.site
 * 
 * Converts Astro blog post content into formats suitable for ATProto:
 * - Strips markdown to plain text for `textContent` (search/indexing)
 * - Converts custom sidenotes to standard markdown
 * - Resolves relative links to absolute URLs
 * 
 * @example
 * ```ts
 * import { transformContent, stripToPlainText } from 'astro-standard-site/content';
 * 
 * const result = transformContent(markdown, {
 *   siteUrl: 'https://bryanguffey.com',
 *   postPath: '/blog/my-post',
 * });
 * 
 * // result.markdown - cleaned markdown for ATProto
 * // result.textContent - plain text for search
 * ```
 */

export interface TransformOptions {
  /** Base URL of your site (e.g., 'https://bryanguffey.com') */
  siteUrl: string;
  /** Path to the current post (e.g., '/blog/my-post') */
  postPath?: string;
}

export interface TransformResult {
  /** Transformed markdown suitable for ATProto */
  markdown: string;
  /** Plain text version for textContent field */
  textContent: string;
  /** Word count */
  wordCount: number;
  /** Estimated reading time in minutes */
  readingTime: number;
}

/**
 * Convert HTML sidenotes to markdown blockquotes
 * 
 * Transforms:
 * ```html
 * <div class="sidenote sidenote--tip">
 *   <span class="sidenote-label">Tip</span>
 *   <p>Content here</p>
 * </div>
 * ```
 * 
 * Into:
 * ```markdown
 * > **Tip:** Content here
 * ```
 */
export function convertSidenotes(markdown: string): string {
  // Match sidenote divs with various formats
  const sidenoteRegex = /<div\s+class="sidenote(?:\s+sidenote--(warning|tip))?">\s*<span\s+class="sidenote-label">([^<]+)<\/span>\s*<p>([^<]+)<\/p>\s*<\/div>/gi;
  
  return markdown.replace(sidenoteRegex, (_, type, label, content) => {
    // Clean up the content
    const cleanContent = content.trim();
    const cleanLabel = label.trim();
    
    // Convert to blockquote with label
    return `\n> **${cleanLabel}:** ${cleanContent}\n`;
  });
}

/**
 * Convert HTML sidenotes (multi-paragraph) to markdown
 * Handles more complex sidenote structures
 */
export function convertComplexSidenotes(markdown: string): string {
  // First pass: simple sidenotes
  let result = convertSidenotes(markdown);
  
  // Second pass: sidenotes with multiple paragraphs or nested content
  const complexSidenoteRegex = /<div\s+class="sidenote[^"]*">([\s\S]*?)<\/div>/gi;
  
  result = result.replace(complexSidenoteRegex, (match, innerContent) => {
    // Extract label if present
    const labelMatch = innerContent.match(/<span\s+class="sidenote-label">([^<]+)<\/span>/i);
    const label = labelMatch ? labelMatch[1].trim() : 'Note';
    
    // Remove the label span
    let content = innerContent.replace(/<span\s+class="sidenote-label">[^<]+<\/span>/gi, '');
    
    // Convert remaining HTML to plain text with basic formatting
    content = content
      .replace(/<p>/gi, '')
      .replace(/<\/p>/gi, '\n')
      .replace(/<strong>/gi, '**')
      .replace(/<\/strong>/gi, '**')
      .replace(/<em>/gi, '*')
      .replace(/<\/em>/gi, '*')
      .replace(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, '[$2]($1)')
      .replace(/<[^>]+>/g, '') // Remove any remaining HTML tags
      .trim();
    
    // Format as blockquote
    const lines = content.split('\n').filter((line: string) => line.trim());
    const quotedLines = lines.map((line: string, i: number) => 
      i === 0 ? `> **${label}:** ${line}` : `> ${line}`
    );
    
    return '\n' + quotedLines.join('\n') + '\n';
  });
  
  return result;
}

/**
 * Resolve relative URLs to absolute URLs
 * 
 * Converts:
 * - `[Link](/page)` → `[Link](https://example.com/page)`
 * - `![Image](/img.png)` → `![Image](https://example.com/img.png)`
 */
export function resolveRelativeLinks(markdown: string, siteUrl: string): string {
  const baseUrl = siteUrl.replace(/\/$/, '');
  
  // Match markdown links and images with relative URLs
  // [text](/path) or ![alt](/path)
  const linkRegex = /(!?\[[^\]]*\])\((?!https?:\/\/|mailto:|#)([^)]+)\)/g;
  
  return markdown.replace(linkRegex, (_, prefix, path) => {
    // Ensure path starts with /
    const absolutePath = path.startsWith('/') ? path : `/${path}`;
    return `${prefix}(${baseUrl}${absolutePath})`;
  });
}

/**
 * Strip markdown to plain text for indexing/search
 * 
 * Removes:
 * - Markdown formatting (**, *, #, etc.)
 * - Links (keeps link text)
 * - Images
 * - Code blocks
 * - HTML tags
 */
export function stripToPlainText(markdown: string): string {
  let text = markdown;
  
  // Remove code blocks first (preserve nothing)
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`[^`]+`/g, '');
  
  // Remove images
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  
  // Convert links to just their text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Remove heading markers
  text = text.replace(/^#{1,6}\s+/gm, '');
  
  // Remove bold/italic markers
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');
  
  // Remove blockquote markers
  text = text.replace(/^>\s*/gm, '');
  
  // Remove list markers
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');
  
  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}$/gm, '');
  
  // Collapse multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Trim whitespace
  text = text.trim();
  
  return text;
}

/**
 * Calculate word count from text
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Calculate reading time in minutes (assuming 200 words per minute)
 */
export function calculateReadingTime(wordCount: number, wordsPerMinute = 200): number {
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

/**
 * Full content transformation pipeline
 * 
 * Takes raw markdown (with HTML sidenotes) and produces:
 * - Clean markdown suitable for ATProto platforms
 * - Plain text for search/indexing
 * - Metadata (word count, reading time)
 */
export function transformContent(
  rawMarkdown: string,
  options: TransformOptions
): TransformResult {
  // Step 1: Convert sidenotes from HTML to markdown blockquotes
  let markdown = convertComplexSidenotes(rawMarkdown);
  
  // Step 2: Resolve relative links to absolute URLs
  markdown = resolveRelativeLinks(markdown, options.siteUrl);
  
  // Step 3: Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();
  
  // Step 4: Generate plain text version
  const textContent = stripToPlainText(markdown);
  
  // Step 5: Calculate metadata
  const wordCount = countWords(textContent);
  const readingTime = calculateReadingTime(wordCount);
  
  return {
    markdown,
    textContent,
    wordCount,
    readingTime,
  };
}

/**
 * Transform an Astro blog post entry for standard.site
 * 
 * @example
 * ```ts
 * import { getCollection } from 'astro:content';
 * import { transformPost } from 'astro-standard-site/content';
 * 
 * const posts = await getCollection('blog');
 * for (const post of posts) {
 *   const standardDoc = transformPost(post, {
 *     siteUrl: 'https://bryanguffey.com',
 *   });
 *   await publisher.publishDocument(standardDoc);
 * }
 * ```
 */
export interface AstroBlogPost {
  slug: string;
  body: string;
  data: {
    title: string;
    description?: string;
    date: Date;
    tags?: string[];
    draft?: boolean;
  };
}

export interface StandardSiteDocumentInput {
  site: string;
  title: string;
  publishedAt: string;
  path?: string;
  description?: string;
  tags?: string[];
  textContent?: string;
  content?: {
    $type: string;
    text: string;
    version?: string;
  };
}

export function transformPost(
  post: AstroBlogPost,
  options: { siteUrl: string }
): StandardSiteDocumentInput {
  const postPath = `/blog/${post.slug}`;
  
  // Transform the content
  const transformed = transformContent(post.body, {
    siteUrl: options.siteUrl,
    postPath,
  });
  
  return {
    site: options.siteUrl,
    title: post.data.title,
    publishedAt: post.data.date.toISOString(),
    path: postPath,
    description: post.data.description,
    tags: post.data.tags,
    textContent: transformed.textContent,
    content: {
      $type: 'site.standard.content.markdown',
      text: transformed.markdown,
      version: '1.0',
    },
  };
}
