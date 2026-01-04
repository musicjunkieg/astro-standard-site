/**
 * Publisher for standard.site documents
 * 
 * Publishes documents to ATProto repositories using the standard.site lexicon,
 * enabling your Astro site to sync content to Leaflet, WhiteWind, or any
 * compatible platform.
 * 
 * The publisher automatically resolves the correct PDS from your DID document,
 * so it works with any PDS (bsky.app, Blacksky, self-hosted, etc.).
 * 
 * @example
 * ```ts
 * import { StandardSitePublisher } from 'astro-standard-site/publisher';
 * 
 * const publisher = new StandardSitePublisher({
 *   identifier: 'your-handle.bsky.social',
 *   password: process.env.ATPROTO_APP_PASSWORD!,
 * });
 * 
 * await publisher.login();
 * 
 * await publisher.publishDocument({
 *   title: 'My Blog Post',
 *   url: 'https://myblog.com/posts/my-post',
 *   publishedAt: new Date().toISOString(),
 *   visibility: 'public',
 * });
 * ```
 */

import { AtpAgent, RichText } from '@atproto/api';
import type { PublisherConfig, Document, Publication } from './schemas.js';
import { PublisherConfigSchema, COLLECTIONS } from './schemas.js';

/**
 * Resolve a handle to a DID using the public API
 */
async function resolveHandle(handle: string): Promise<string> {
  const res = await fetch(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
  if (!res.ok) throw new Error(`Failed to resolve handle: ${handle}`);
  const data = await res.json() as { did: string };
  return data.did;
}

/**
 * Get the PDS endpoint from a DID document
 */
async function getPdsFromDid(did: string): Promise<string> {
  let didDoc: any;
  
  if (did.startsWith('did:plc:')) {
    // Resolve from plc.directory
    const res = await fetch(`https://plc.directory/${did}`);
    if (!res.ok) throw new Error(`Failed to resolve DID: ${did}`);
    didDoc = await res.json();
  } else if (did.startsWith('did:web:')) {
    // Resolve from the domain
    const domain = did.replace('did:web:', '');
    const res = await fetch(`https://${domain}/.well-known/did.json`);
    if (!res.ok) throw new Error(`Failed to resolve DID: ${did}`);
    didDoc = await res.json();
  } else {
    throw new Error(`Unsupported DID method: ${did}`);
  }
  
  // Find the AtprotoPersonalDataServer service
  const pdsService = didDoc.service?.find(
    (s: any) => s.type === 'AtprotoPersonalDataServer' || s.id === '#atproto_pds'
  );
  
  if (!pdsService?.serviceEndpoint) {
    throw new Error(`No PDS found in DID document for ${did}`);
  }
  
  return pdsService.serviceEndpoint;
}

export interface PublishDocumentInput {
  /** Site/publication URI (https or at-uri) - REQUIRED */
  site: string;
  /** Document title - REQUIRED */
  title: string;
  /** When the document was published (ISO 8601) - REQUIRED */
  publishedAt: string;
  /** Path to combine with site URL */
  path?: string;
  /** Document description/excerpt */
  description?: string;
  /** When the document was last updated (ISO 8601) */
  updatedAt?: string;
  /** Tags/categories */
  tags?: string[];
  /** Plain text content for indexing */
  textContent?: string;
  /** Platform-specific content */
  content?: unknown;
  /** Reference to associated Bluesky post */
  bskyPostRef?: { uri: string; cid: string };
}

export interface PublishPublicationInput {
  /** Publication name */
  name: string;
  /** Base URL */
  url: string;
  /** Description */
  description?: string;
  /** Basic theme colors */
  basicTheme?: {
    background: { r: number; g: number; b: number };
    foreground: { r: number; g: number; b: number };
    accent: { r: number; g: number; b: number };
    accentForeground: { r: number; g: number; b: number };
  };
  /** Publication preferences */
  preferences?: {
    showInDiscover?: boolean;
  };
}

export interface PublishResult {
  uri: string;
  cid: string;
}

/**
 * Generate a record key from a string (slug-like)
 */
function generateRkey(input?: string): string {
  if (input) {
    // Sanitize and truncate for use as record key
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64);
  }
  // Fallback to timestamp-based key
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Generate a TID (Timestamp ID) for record keys
 * TIDs are base32-sortable identifiers used in ATProto
 */
/**
 * Generate a TID (Timestamp Identifier) per ATProto spec
 * @see https://atproto.com/specs/tid
 * 
 * Structure:
 * - 64-bit integer, big-endian
 * - Top bit always 0
 * - Next 53 bits: microseconds since UNIX epoch
 * - Final 10 bits: random clock identifier
 * - Encoded as base32-sortable (chars: 234567abcdefghijklmnopqrstuvwxyz)
 * - Always 13 characters
 */
const BASE32_SORTABLE = '234567abcdefghijklmnopqrstuvwxyz';

function generateTid(): string {
  const now = Date.now() * 1000; // Convert to microseconds
  const clockId = Math.floor(Math.random() * 1024); // 10 bits
  
  // Combine: (timestamp << 10) | clockId
  // Ensure top bit is 0 by masking with 0x7FFFFFFFFFFFFFFF
  const tid = ((BigInt(now) << 10n) | BigInt(clockId)) & 0x7FFFFFFFFFFFFFFFn;
  
  // Encode as base32-sortable
  let encoded = '';
  let remaining = tid;
  for (let i = 0; i < 13; i++) {
    const index = Number(remaining & 31n);
    encoded = BASE32_SORTABLE[index] + encoded;
    remaining = remaining >> 5n;
  }
  
  return encoded;
}

/**
 * Publisher for standard.site documents on ATProto
 */
export class StandardSitePublisher {
  private agent: AtpAgent | null = null;
  private config: PublisherConfig;
  private did: string | null = null;
  private pdsUrl: string | null = null;
  
  constructor(config: Partial<PublisherConfig>) {
    this.config = PublisherConfigSchema.parse(config);
  }
  
  /**
   * Authenticate with the PDS
   * Automatically resolves the correct PDS from the DID document
   */
  async login(): Promise<void> {
    // Resolve handle to DID if needed
    let did = this.config.identifier;
    if (!did.startsWith('did:')) {
      did = await resolveHandle(this.config.identifier);
    }
    this.did = did;
    
    // Get PDS URL from DID document (unless manually overridden)
    if (this.config.service) {
      this.pdsUrl = this.config.service;
    } else {
      this.pdsUrl = await getPdsFromDid(did);
    }
    
    // Create agent and login
    this.agent = new AtpAgent({ service: this.pdsUrl });
    await this.agent.login({
      identifier: this.config.identifier,
      password: this.config.password,
    });
  }
  
  /**
   * Get the authenticated DID
   */
  getDid(): string {
    if (!this.did) {
      throw new Error('Not logged in. Call login() first.');
    }
    return this.did;
  }
  
  /**
   * Get the PDS URL being used
   */
  getPdsUrl(): string {
    if (!this.pdsUrl) {
      throw new Error('Not logged in. Call login() first.');
    }
    return this.pdsUrl;
  }
  
  private getAgent(): AtpAgent {
    if (!this.agent) {
      throw new Error('Not logged in. Call login() first.');
    }
    return this.agent;
  }
  
  /**
   * Publish a document record
   */
  async publishDocument(input: PublishDocumentInput): Promise<PublishResult> {
    const did = this.getDid();
    const agent = this.getAgent();
    
    const record: Document = {
      $type: 'site.standard.document',
      site: input.site,
      title: input.title,
      publishedAt: input.publishedAt,
      path: input.path,
      description: input.description,
      updatedAt: input.updatedAt,
      tags: input.tags,
      textContent: input.textContent,
      content: input.content,
      bskyPostRef: input.bskyPostRef,
    };
    
    // Remove undefined values
    const cleanRecord = Object.fromEntries(
      Object.entries(record).filter(([_, v]) => v !== undefined)
    ) as Document;
    
    // Generate TID for record key per lexicon spec (key: "tid")
    const rkey = generateTid();
    
    const response = await agent.api.com.atproto.repo.createRecord({
      repo: did,
      collection: COLLECTIONS.DOCUMENT,
      rkey,
      record: cleanRecord,
    });
    
    return {
      uri: response.data.uri,
      cid: response.data.cid,
    };
  }
  
  /**
   * Update an existing document
   */
  async updateDocument(rkey: string, input: PublishDocumentInput): Promise<PublishResult> {
    const did = this.getDid();
    const agent = this.getAgent();
    
    const record: Document = {
      $type: 'site.standard.document',
      site: input.site,
      title: input.title,
      publishedAt: input.publishedAt,
      path: input.path,
      description: input.description,
      updatedAt: input.updatedAt ?? new Date().toISOString(),
      tags: input.tags,
      textContent: input.textContent,
      content: input.content,
      bskyPostRef: input.bskyPostRef,
    };
    
    const cleanRecord = Object.fromEntries(
      Object.entries(record).filter(([_, v]) => v !== undefined)
    ) as Document;
    
    const response = await agent.api.com.atproto.repo.putRecord({
      repo: did,
      collection: COLLECTIONS.DOCUMENT,
      rkey,
      record: cleanRecord,
    });
    
    return {
      uri: response.data.uri,
      cid: response.data.cid,
    };
  }
  
  /**
   * Delete a document
   */
  async deleteDocument(rkey: string): Promise<void> {
    const did = this.getDid();
    const agent = this.getAgent();
    
    await agent.api.com.atproto.repo.deleteRecord({
      repo: did,
      collection: COLLECTIONS.DOCUMENT,
      rkey,
    });
  }
  
  /**
   * Publish a publication record
   */
  async publishPublication(input: PublishPublicationInput): Promise<PublishResult> {
    const did = this.getDid();
    const agent = this.getAgent();
    
    const record: Publication = {
      $type: 'site.standard.publication',
      name: input.name,
      url: input.url,
      description: input.description,
      basicTheme: input.basicTheme,
      preferences: input.preferences,
    };
    
    const cleanRecord = Object.fromEntries(
      Object.entries(record).filter(([_, v]) => v !== undefined)
    ) as Publication;
    
    // Generate TID for record key per lexicon spec (key: "tid")
    const rkey = generateTid();
    
    const response = await agent.api.com.atproto.repo.createRecord({
      repo: did,
      collection: COLLECTIONS.PUBLICATION,
      rkey,
      record: cleanRecord,
    });
    
    return {
      uri: response.data.uri,
      cid: response.data.cid,
    };
  }
  
  /**
   * Get all documents for the current account
   */
  async listDocuments(limit = 100): Promise<Array<{ uri: string; cid: string; value: Document }>> {
    const did = this.getDid();
    const agent = this.getAgent();
    
    const response = await agent.api.com.atproto.repo.listRecords({
      repo: did,
      collection: COLLECTIONS.DOCUMENT,
      limit,
    });
    
    return response.data.records.map(r => ({
      uri: r.uri,
      cid: r.cid,
      value: r.value as Document,
    }));
  }
  
  /**
   * Get all publications for the current account
   */
  async listPublications(limit = 100): Promise<Array<{ uri: string; cid: string; value: Publication }>> {
    const did = this.getDid();
    const agent = this.getAgent();
    
    const response = await agent.api.com.atproto.repo.listRecords({
      repo: did,
      collection: COLLECTIONS.PUBLICATION,
      limit,
    });
    
    return response.data.records.map(r => ({
      uri: r.uri,
      cid: r.cid,
      value: r.value as Publication,
    }));
  }
  
  /**
   * Get the underlying ATP agent for advanced operations
   */
  getAtpAgent(): AtpAgent {
    return this.getAgent();
  }
}

export type { PublisherConfig };
