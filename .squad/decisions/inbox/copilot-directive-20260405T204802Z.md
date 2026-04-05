### 2026-04-05T20:48:02Z: User directive
**By:** Onur Asiliskender (via Copilot)
**What:** NPM publish is deferred to Phase 5. Release pipeline should only create a GitHub release with tag + release notes. No `@semantic-release/npm` or `NPM_TOKEN` until Phase 5.
**Why:** NPM_TOKEN is not configured. Keep release pipeline minimal and functional now; NPM integration is a Phase 5 concern.
