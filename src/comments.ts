/**
 * Comment aggregation for standard.site documents
 * 
 * Fetches replies/comments from various ATProto platforms:
 * - Bluesky posts that link to your document
 * - Direct replies to announcement posts (via bskyPostRef)
 * - Future: Leaflet comments, WhiteWind reactions
 * 
 * @example
 * ```ts
 * import { fetchComments } from 'astro-standard-site/comments';
 * 
 * const comments = await fetchComments({
 *   documentUri: 'at://did:plc:xxx/site.standard.document/abc123',
 *   bskyPostUri: 'at://did:plc:xxx/app.bsky.feed.post/xyz789',
 * });
 * 
 * // comments is an array of unified Comment objects
 * ```
 */

import { AtpAgent } from '@atproto/api';

export interface Author {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export interface Comment {
  /** Unique identifier (AT-URI) */
  uri: string;
  /** Content ID */
  cid: string;
  /** Comment text */
  text: string;
  /** Author information */
  author: Author;
  /** When the comment was created */
  createdAt: Date;
  /** Source platform */
  source: 'bluesky' | 'leaflet' | 'whitewind' | 'unknown';
  /** URL to view the comment on its platform */
  sourceUrl: string;
  /** Parent comment URI (for threaded replies) */
  parentUri?: string;
  /** Like count (if available) */
  likeCount?: number;
  /** Reply count (if available) */
  replyCount?: number;
  /** Nested replies */
  replies?: Comment[];
}

export interface FetchCommentsOptions {
  /** AT-URI of the site.standard.document record */
  documentUri?: string;
  /** AT-URI of a Bluesky post that announces/links the document */
  bskyPostUri?: string;
  /** Canonical URL of the blog post (for finding mentions) */
  canonicalUrl?: string;
  /** Maximum depth for nested replies */
  maxDepth?: number;
  /** Maximum total comments to fetch */
  maxComments?: number;
  /** PDS service for API calls */
  service?: string;
}

/**
 * Convert a Bluesky post to our unified Comment format
 */
function bskyPostToComment(post: any, depth = 0): Comment {
  const author: Author = {
    did: post.author.did,
    handle: post.author.handle,
    displayName: post.author.displayName,
    avatar: post.author.avatar,
  };
  
  // Build the Bluesky URL
  const postId = post.uri.split('/').pop();
  const sourceUrl = `https://bsky.app/profile/${post.author.handle}/post/${postId}`;
  
  const comment: Comment = {
    uri: post.uri,
    cid: post.cid,
    text: post.record?.text || '',
    author,
    createdAt: new Date(post.record?.createdAt || post.indexedAt),
    source: 'bluesky',
    sourceUrl,
    likeCount: post.likeCount,
    replyCount: post.replyCount,
  };
  
  // Extract parent if this is a reply
  if (post.record?.reply?.parent?.uri) {
    comment.parentUri = post.record.reply.parent.uri;
  }
  
  return comment;
}

/**
 * Recursively process a thread tree from Bluesky
 */
function processThread(thread: any, maxDepth: number, currentDepth = 0): Comment[] {
  const comments: Comment[] = [];
  
  if (!thread || currentDepth > maxDepth) return comments;
  
  // Process the current post if it's a reply (not the root)
  if (thread.post && currentDepth > 0) {
    comments.push(bskyPostToComment(thread.post, currentDepth));
  }
  
  // Process replies
  if (thread.replies && Array.isArray(thread.replies)) {
    for (const reply of thread.replies) {
      const replyComments = processThread(reply, maxDepth, currentDepth + 1);
      comments.push(...replyComments);
    }
  }
  
  return comments;
}

/**
 * Fetch replies to a Bluesky post
 */
export async function fetchBlueskyReplies(
  postUri: string,
  options: {
    maxDepth?: number;
    service?: string;
  } = {}
): Promise<Comment[]> {
  const { maxDepth = 3, service = 'https://public.api.bsky.app' } = options;
  
  const agent = new AtpAgent({ service });
  
  try {
    const response = await agent.api.app.bsky.feed.getPostThread({
      uri: postUri,
      depth: maxDepth,
    });
    
    if (!response.data.thread || response.data.thread.$type === 'app.bsky.feed.defs#notFoundPost') {
      return [];
    }
    
    // Process the thread, skipping the root post (we only want replies)
    const comments = processThread(response.data.thread, maxDepth, 0);
    
    return comments;
  } catch (error) {
    console.error('Failed to fetch Bluesky replies:', error);
    return [];
  }
}

/**
 * Search Bluesky for posts mentioning a URL
 * Useful for finding discussions about your blog post
 */
export async function searchBlueskyMentions(
  url: string,
  options: {
    maxResults?: number;
    service?: string;
  } = {}
): Promise<Comment[]> {
  const { maxResults = 25, service = 'https://public.api.bsky.app' } = options;
  
  const agent = new AtpAgent({ service });
  
  try {
    // Search for posts containing the URL
    const response = await agent.api.app.bsky.feed.searchPosts({
      q: url,
      limit: maxResults,
    });
    
    if (!response.data.posts) {
      return [];
    }
    
    // Convert to our Comment format
    return response.data.posts.map(post => bskyPostToComment(post));
  } catch (error) {
    console.error('Failed to search Bluesky mentions:', error);
    return [];
  }
}

/**
 * Build a tree structure from flat comments
 */
export function buildCommentTree(comments: Comment[]): Comment[] {
  const commentMap = new Map<string, Comment>();
  const rootComments: Comment[] = [];
  
  // First pass: index all comments
  for (const comment of comments) {
    commentMap.set(comment.uri, { ...comment, replies: [] });
  }
  
  // Second pass: build tree
  for (const comment of comments) {
    const node = commentMap.get(comment.uri)!;
    
    if (comment.parentUri && commentMap.has(comment.parentUri)) {
      const parent = commentMap.get(comment.parentUri)!;
      parent.replies = parent.replies || [];
      parent.replies.push(node);
    } else {
      rootComments.push(node);
    }
  }
  
  // Sort by date (oldest first for conversations)
  const sortByDate = (a: Comment, b: Comment) => 
    a.createdAt.getTime() - b.createdAt.getTime();
  
  const sortTree = (comments: Comment[]) => {
    comments.sort(sortByDate);
    for (const comment of comments) {
      if (comment.replies?.length) {
        sortTree(comment.replies);
      }
    }
  };
  
  sortTree(rootComments);
  
  return rootComments;
}

/**
 * Fetch all comments for a document from multiple sources
 */
export async function fetchComments(
  options: FetchCommentsOptions
): Promise<Comment[]> {
  const {
    bskyPostUri,
    canonicalUrl,
    maxDepth = 3,
    maxComments = 100,
    service = 'https://public.api.bsky.app',
  } = options;
  
  const allComments: Comment[] = [];
  
  // Fetch replies to the announcement post
  if (bskyPostUri) {
    const replies = await fetchBlueskyReplies(bskyPostUri, { maxDepth, service });
    allComments.push(...replies);
  }
  
  // Search for mentions of the canonical URL
  if (canonicalUrl) {
    const mentions = await searchBlueskyMentions(canonicalUrl, {
      maxResults: Math.max(10, maxComments - allComments.length),
      service,
    });
    
    // Filter out duplicates and the original post
    const existingUris = new Set(allComments.map(c => c.uri));
    if (bskyPostUri) existingUris.add(bskyPostUri);
    
    for (const mention of mentions) {
      if (!existingUris.has(mention.uri)) {
        allComments.push(mention);
        existingUris.add(mention.uri);
      }
    }
  }
  
  // Future: Add Leaflet comment fetching
  // Future: Add WhiteWind reaction fetching
  
  // Limit total comments
  const limitedComments = allComments.slice(0, maxComments);
  
  // Build into a tree structure
  return buildCommentTree(limitedComments);
}

/**
 * Flatten a comment tree back to an array (for simple list display)
 */
export function flattenComments(tree: Comment[]): Comment[] {
  const flat: Comment[] = [];
  
  const walk = (comments: Comment[], depth = 0) => {
    for (const comment of comments) {
      flat.push({ ...comment, replies: undefined });
      if (comment.replies?.length) {
        walk(comment.replies, depth + 1);
      }
    }
  };
  
  walk(tree);
  return flat;
}

/**
 * Get comment count (including nested replies)
 */
export function countComments(tree: Comment[]): number {
  let count = 0;
  
  const walk = (comments: Comment[]) => {
    for (const comment of comments) {
      count++;
      if (comment.replies?.length) {
        walk(comment.replies);
      }
    }
  };
  
  walk(tree);
  return count;
}

export type { FetchCommentsOptions as CommentFetchOptions };
