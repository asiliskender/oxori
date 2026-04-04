# Tron: Watcher Implementation

**Date:** 2026-04-03  
**Phase:** 3 (Watcher)  
**Status:** ✅ Implemented & Build Verified

---

## What Was Done

Implemented `src/watcher.ts` — the vault filesystem watcher module for Phase 3.

### Key decisions

1. **Type mapping** — `fs.watch` emits `"change"` and `"rename"`. Mapped:
   - `"change"` → `WatchEvent.type = "change"`
   - `"rename"` + `fs.existsSync(absPath)` → `"add"`
   - `"rename"` + `!fs.existsSync(absPath)` → `"unlink"`

2. **Field names** — Used `filepath` (not `path`) and `"add"/"change"/"unlink"` (not `"create"/"modify"/"delete"`) as defined in the actual `WatchEvent` type in `src/types.ts`. The task description used different names; the type definition was authoritative.

3. **Error handling** — `try/catch` around `fs.watch` constructor; errors deferred via `setImmediate` so callers can attach `"error"` listeners before the event fires.

4. **Filter** — Only `.md` files are forwarded; all other extensions are silently dropped inside the `fs.watch` callback.

5. **Exported** — `watch` is the only public export from `src/watcher.ts`. `VaultWatcherImpl` is internal.

### Files changed

- `src/watcher.ts` — created
- `src/index.ts` — added `export { watch } from "./watcher.js"`

### Build & test

- `pnpm build` — ✅ zero TypeScript errors
- `pnpm test` — ✅ 130 passed, 43 todo (all watcher tests are `it.todo()` stubs, no failures)
