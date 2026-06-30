### 2026-06-30: search query made optional for --tag/--link modes
**By:** Parker (requested by Onur)
**What:** `oxori search [query] [path]` — query is now optional positional. Required only for text mode. --tag and --link work without a query.
**Before:** `oxori search "" --tag "#rust"`
**After:** `oxori search --tag "#rust"`
