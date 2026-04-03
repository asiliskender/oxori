# Decision: Dual-Package Build Configuration & ESLint Flat Config

**Date:** 2026-04-03  
**Owner:** Clu (DevOps)  
**Status:** Decided

## Problem

Phase 1 CI/CD infrastructure required:
1. Proper bundling for both library consumers (ESM + CommonJS) and CLI users
2. Type safety via linting without allowing `any` types
3. Shebang handling for CLI without polluting library output

## Decision

### 1. Dual-Package Strategy (ESM + CJS)

**tsup.config.ts:**
```typescript
format: ["esm", "cjs"]
banner: {
  js: {
    cli: "#!/usr/bin/env node",  // Only CLI gets shebang
  }
}
```

**Why:**
- ESM for modern Node.js consumers and bundlers (webpack, esbuild, etc.)
- CJS for legacy CommonJS-only environments
- Library (index.ts) ships as both; type declarations unified
- CLI (cli.ts) is executable only (shebang) and not meant for import

**Trade-offs:**
- Slightly larger dist/ folder (both esm + cjs versions)
- ✅ Maximizes compatibility — no need for users to choose bundler mode
- ✅ Modern Node.js resolves esm automatically via exports map
- ✅ Zero breaking changes if ecosystem shifts to ESM-only (library already ships ESM)

### 2. ESLint 9.x Flat Config Format

**eslint.config.js:**
```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];
```

**Why:**
- ESLint 9.x deprecated .eslintrc.json in favor of flat config
- Flat config is simpler: just a JavaScript export, no CLI arg confusion
- typescript-eslint is included in devDependencies already
- `no-explicit-any: error` enforces type safety from day one

**Not using legacy .eslintrc.json:**
- Flat config is the recommended approach going forward
- Easier to compose rulesets (extends via array)
- More consistent with ESM-first ecosystem

### 3. Per-Entry Banner Configuration

**Problem with previous config:**
```typescript
// ❌ Old: Applies to ALL entries
banner: {
  js: "#!/usr/bin/env node"
}
```

This would put a shebang in **both** `dist/index.js` (library) and `dist/cli.js` (CLI).

**Solution:**
```typescript
// ✅ New: Scoped per entry
banner: {
  js: {
    cli: "#!/usr/bin/env node"
  }
}
```

Now only `dist/cli.js` gets the shebang. The library `dist/index.js` is clean.

## Exports Map (package.json)

```json
"exports": {
  ".": {
    "import": "./dist/index.js",
    "require": "./dist/index.cjs",
    "types": "./dist/index.d.ts"
  }
}
```

Node.js resolves based on consumer's import mode:
- `import { Oxori } from "oxori"` → loads `dist/index.js` (ESM)
- `const { Oxori } = require("oxori")` → loads `dist/index.cjs` (CJS)
- TypeScript always loads `dist/index.d.ts` (types)

## Files Changed

| File | Change | Reason |
|------|--------|--------|
| tsup.config.ts | Dual package (ESM+CJS), per-entry banners | Maximize compatibility, clean library output |
| eslint.config.js | New flat config with no-any | Type safety, modern ESLint |
| package.json | Added `module` field, CJS exports, packageManager | Bundler compat, enforce pnpm 9 |
| .npmignore | Exclude src/, keep dist/ | Ship only compiled code + README |
| ci.yml | Added `pnpm build` step | Catch build failures early |

## Follow-up

- If ecosystem shifts to ESM-only: remove CJS format from tsup, simplify exports map
- If semantic-release needs to auto-generate npm dist tags: configure via .npmrc
- Monitor eslint-config-next compatibility as ESLint plugins evolve

## Approval

**By:** Clu (DevOps)
