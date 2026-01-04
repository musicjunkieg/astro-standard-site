# Debugging ATProto Issues

## Tools

| Tool | URL | Use For |
|------|-----|---------|
| pdsls | https://pdsls.dev/ | Browse records, check schema validation |
| plc.directory | https://plc.directory/{did} | View DID documents |
| Test PDS | https://pds.rip/ | Throwaway test accounts |

## Common Issues

### Schema Validation Failed

**Error:** `invalid_string_format at .key (expected a tid formatted string)`

**Cause:** Record key (rkey) is not a valid TID.

**Fix:** Ensure `generateTid()` is being called. See `agent_docs/tid_format.md`.

**Verify:** Check the record at `https://pdsls.dev/at://{did}/site.standard.document/{rkey}` — the Info tab shows validation status.

### Authentication Failed

**Error:** `Failed to resolve handle` or `Authentication Required`

**Debug steps:**
1. Verify handle resolves: `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle={handle}`
2. Check DID document: `https://plc.directory/{did}`
3. Verify PDS endpoint in DID document's `service` array
4. Confirm app password is valid (not expired/revoked)

### PDS Not Found

**Error:** `No PDS found in DID document`

**Cause:** DID document doesn't have `AtprotoPersonalDataServer` service.

**Debug:** Check `https://plc.directory/{did}` for:
```json
{
  "service": [
    {
      "id": "#atproto_pds",
      "type": "AtprotoPersonalDataServer",
      "serviceEndpoint": "https://pds.example.com"
    }
  ]
}
```

### Record Not Appearing

**Possible causes:**
1. Published to wrong collection (check `COLLECTIONS` in `schemas.ts`)
2. Record created but PDS hasn't propagated yet (wait a moment)
3. Looking at wrong DID

**Verify:** `https://pdsls.dev/at://{did}/site.standard.document`

### Content Not Rendering on Leaflet/WhiteWind

**Check:**
1. `content.$type` is set correctly (`site.standard.content.markdown`)
2. `content.text` contains the markdown
3. Required fields present: `site`, `title`, `publishedAt`

## Manual Testing

### Test Script

```bash
ATPROTO_APP_PASSWORD="xxxx" npx tsx scripts/test-atproto.ts
```

Creates a test publication and document, outputs URIs for verification.

### Using pdsls to Delete Test Records

1. Go to `https://pdsls.dev/at://{did}/site.standard.document/{rkey}`
2. Click "..." menu
3. Select "Delete record"

### Inspecting a Record

```bash
curl "https://public.api.bsky.app/xrpc/com.atproto.repo.getRecord?repo={did}&collection=site.standard.document&rkey={rkey}"
```

## Integration Testing

Use `pds.rip` for throwaway accounts:

1. Create account at https://pds.rip/
2. Use those credentials in test
3. Records auto-delete (it's a test PDS)

Plan: Add `npm run test:integration` that runs against pds.rip.
