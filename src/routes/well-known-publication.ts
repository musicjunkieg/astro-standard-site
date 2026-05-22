/**
 * Injected route for /.well-known/site.standard.publication
 *
 * Returns the publication AT-URI as plain text. The value is supplied by the
 * standardSiteVerification integration through a virtual module.
 */
import { publicationAtUri } from 'virtual:standard-site/publication-uri';

export const prerender = true;

export function GET() {
  return new Response(publicationAtUri, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
