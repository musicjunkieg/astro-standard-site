# TID Format

## Why This Matters

Record keys for `site.standard.document` and `site.standard.publication` are specified as `"key": "tid"` in the lexicon. Using any other format (slugs, UUIDs, custom strings) will cause **schema validation failure**.

## Specification

**Source:** https://atproto.com/specs/tid

TID = Timestamp Identifier

### Structure

- 64-bit integer
- Big-endian byte ordering
- Encoded as base32-sortable (NOT standard base32)

### Bit Layout

```
┌─────┬────────────────────────────────────┬────────────┐
│  0  │           53 bits                  │  10 bits   │
│ bit │    microseconds since epoch        │  clock ID  │
└─────┴────────────────────────────────────┴────────────┘
```

- **Top bit:** Always 0
- **Next 53 bits:** Microseconds since UNIX epoch (fits in JS safe integer)
- **Final 10 bits:** Random clock identifier (0-1023)

### Encoding

**Charset (base32-sortable):** `234567abcdefghijklmnopqrstuvwxyz`

Note: This is NOT standard base32. No `0`, `1`, `8`, `9`.

**Length:** Always exactly 13 characters

**First character:** Must be `234567abcdefghij` (because top bit = 0)

### Validation Regex

```
/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/
```

### Valid Examples

```
3jzfcijpj2z2a
7777777777777
3zzzzzzzzzzzz
2222222222222
```

### Invalid Examples

```
0000000000000   # '0' not in charset
zzzzzzzzzzzzz   # 'z' can't be first (top bit would be 1)
ABCDEFGHIJKLM   # uppercase not allowed
test-post-123   # not base32-sortable at all
```

## Implementation

See `generateTid()` in `src/publisher.ts:160-178`.

```ts
const BASE32_SORTABLE = '234567abcdefghijklmnopqrstuvwxyz';

function generateTid(): string {
  const now = Date.now() * 1000; // microseconds
  const clockId = Math.floor(Math.random() * 1024);
  const tid = ((BigInt(now) << 10n) | BigInt(clockId)) & 0x7FFFFFFFFFFFFFFFn;
  
  let encoded = '';
  let remaining = tid;
  for (let i = 0; i < 13; i++) {
    const index = Number(remaining & 31n);
    encoded = BASE32_SORTABLE[index] + encoded;
    remaining = remaining >> 5n;
  }
  return encoded;
}
```

## Common Mistakes

1. **Using `toString(32)`** — JavaScript's base32 uses `0-9a-v`, not the ATProto charset
2. **Using slugs** — `my-blog-post` is not a TID
3. **Forgetting the mask** — Must ensure top bit is 0 with `& 0x7FFFFFFFFFFFFFFFn`
4. **Wrong length** — Must be exactly 13 characters, no padding
