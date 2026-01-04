# Adding New Exports

## Steps

### 1. Create the Module

Create `src/newmodule.ts`:

```ts
/**
 * Brief description of what this module does
 */

export function myFunction(): void {
  // implementation
}

export interface MyType {
  // ...
}
```

### 2. Export from Index

Add to `src/index.ts`:

```ts
export * from './newmodule.js';
// or selective exports:
export { myFunction, type MyType } from './newmodule.js';
```

### 3. Add Package Export

Add to `package.json` exports:

```json
{
  "exports": {
    // ... existing exports ...
    "./newmodule": {
      "types": "./dist/newmodule.d.ts",
      "import": "./dist/newmodule.js"
    }
  }
}
```

### 4. Build

```bash
npm run build
```

Verify `dist/newmodule.js` and `dist/newmodule.d.ts` exist.

### 5. Add Tests

Create `test/newmodule.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/newmodule.js';

describe('myFunction', () => {
  it('should do the thing', () => {
    expect(myFunction()).toBe(expected);
  });
});
```

Run tests:

```bash
npm test
```

## Export Patterns

### Default: Everything from Index

Users import from main entry:
```ts
import { myFunction } from '@bryanguffey/astro-standard-site';
```

### Subpath Export

Users import from specific module:
```ts
import { myFunction } from '@bryanguffey/astro-standard-site/newmodule';
```

Use subpath exports when:
- Module has heavy dependencies you want tree-shakeable
- Module is optional/specialized
- Keeping main export clean

### Component Export

For Astro components, use glob pattern:
```json
"./components/*": "./components/*"
```

Users import:
```ts
import Comments from '@bryanguffey/astro-standard-site/components/Comments.astro';
```

## Checklist

- [ ] Module created in `src/`
- [ ] Exported from `src/index.ts`
- [ ] Added to `package.json` exports (if subpath needed)
- [ ] Tests written
- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] Update README if user-facing
