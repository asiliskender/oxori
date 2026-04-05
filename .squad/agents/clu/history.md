# Clu — Project History

## Project Context

**Project:** Oxori
**Owner:** Onur Asiliskender
**Repo:** /Users/onurasiliskender/Git/github-personal/oxori
**Stack:** TypeScript 5.x, Node.js 20+, pnpm, vitest, tsup
**Tagline:** Where humans and AI agents think together, in markdown.

**Architecture layers:**
1. Parser — reads .md files, extracts frontmatter (gray-matter), tags, wikilinks, typed relations
2. Markdown Index — .oxori/index/files.md, tags.md, links.md — in-memory Maps/Sets on startup
3. Query Engine — tokenizer, AST parser, evaluator
4. Graph Traversal — walks link relationships (depth, direction, relation type)
5. Semantic Search — vector embeddings in .oxori/vectors/ (optional, HTTP-based)
6. Governance — .oxori/governance.md, enforced on agent writes only
7. Write API — create/append files with convention-compliant frontmatter
8. Watcher — chokidar-based incremental index updates
9. MCP Server — Model Context Protocol for agent integrations

**Key decisions:**
- No external database — filesystem + markdown index is the database
- Wikilinks: [[filename]] without extension, case-insensitive
- Tags support hierarchy: #project/auth/oauth matches ancestors
- Frontmatter is schemaless — any YAML key-value indexed
- Typed relations via frontmatter keys (e.g., depends_on: [[file]])
- Vector search is optional — core works without embeddings
- Git handles concurrency — no application locks
- Strict TypeScript — no any, use unknown and narrow
- Functions over classes (except Vault and MCP server)

**Build phases:**
- Phase 1: Parser + Markdown Index (types, parser, indexer, CLI init/index)
- Phase 2: Query Engine + Graph Walk (query AST, graph, CLI query/walk/graph)
- Phase 3: Write API + Governance (writer, governance, SDK public API)
- Phase 4: Semantic Search (embeddings, vector storage, cosine similarity)
- Phase 5: MCP Server + Watcher (MCP server, chokidar, Obsidian compat)

**Conventions:**
- Conventional commits (feat/fix/docs/test/refactor)
- Atomic commits — one logical change per commit
- No phase merge without: passing tests, 80%+ coverage, docs updated, Flynn approved
- Each phase = a separate npm release with detailed release notes

## Learnings

### 2026-04-03: CI/CD Infrastructure Established

**What:** Fixed and enhanced the build pipeline:
- **tsup.config.ts**: Split banner configuration per-entry (CLI only gets shebang). Added dual-package (ESM + CJS) for maximum compatibility. CLI gets `./dist/cli.js` with shebang; library exports from `./dist/index.js` (ESM) and `./dist/index.cjs` (CommonJS).
- **eslint.config.js**: Created new ESLint 9.x flat config with `typescript-eslint`. Enables `@typescript-eslint/no-explicit-any: "error"` to enforce type safety (no `any` allowed). Targets `src/**/*.ts` and `tests/**/*.ts`.
- **package.json**: Added `"module"` field for bundler compatibility. Updated `exports` to include CJS require path. Added `"packageManager": "pnpm@9.0.0"` to enforce pnpm 9 across team.
- **ci.yml**: Added `pnpm build` step to catch build failures early. Added CODECOV_TOKEN support for authenticated uploads. Matrix runs Node 20 + 22 for compatibility testing.
- **.npmignore**: Excludes development artifacts (.squad/, tests/, docs/, .github/, *.config.ts, src/) while preserving README.md and only shipping dist/.
- **vitest.config.ts**: Verified 80% threshold across lines, functions, branches, statements. Excludes cli.ts from coverage (entry point, tested by integration).

**Why:** Phase 1 acceptance criteria required full CI/CD infrastructure. The dual-package approach allows Oxori to be consumed by both ESM (modern) and CommonJS (legacy) consumers. Strict no-any rule enforces type safety from day one. Shebang per-entry prevents accidental executable output in library builds.

**Decisions Made:**
1. **Dual-package strategy** — ESM for Node.js, CJS for legacy consumers. Type declarations generated for both.
2. **Flat ESLint config** — Uses ESLint 9.x modern format. Avoids deprecated .eslintrc.json.
3. **No-any enforcement** — Type safety via TypeScript. Unknown is allowed (pattern matching required).
4. **Per-entry banners** — Only CLI gets shebang. Library exports clean.

**Files Modified:**
- ✅ tsup.config.ts (fixed dual-package + per-entry banners)
- ✅ eslint.config.js (created)
- ✅ .npmignore (created)
- ✅ package.json (added module, CJS exports, packageManager)
- ✅ ci.yml (added build step, codecov token)
- ✅ vitest.config.ts (verified thresholds)

### 2026-04-04: Documented Retro Action Items (A5 + A8)

**What:** Completed two retro action items from engineering retrospective:

1. **Retro A5 (P2) — Codify per-entry tsup banner in architecture.md**
   - Added new "Build System and Tooling" section to `docs/architecture.md`
   - Explains why tsup uses array config (`defineConfig([...])`) instead of single object
   - Clarifies that shebang `#!/usr/bin/env node` MUST only appear on CLI entry (`cli.ts`), never on library entry (`index.ts`)
   - Documents the exact pattern to follow when adding new binary entry points
   - Explains the error that occurs if banner object is used incorrectly: "banner option must be a string, got object"

2. **Retro A8 (P3) — Add pre-commit test step to CONTRIBUTING.md**
   - Added new "Pre-Commit Checks" section in `CONTRIBUTING.md`
   - Instructs developers to run `npx vitest run` locally before committing
   - Emphasizes verifying zero non-todo failures
   - Notes that this catches issues early and keeps main branch green

**Why:** Prevent future configuration errors and ensure consistent testing discipline across team. Codifying these patterns in docs makes them discoverable and reduces onboarding friction.

**Files Modified:**
- ✅ docs/architecture.md (added Build System and Tooling section)
- ✅ CONTRIBUTING.md (added Pre-Commit Checks section)

### 2026-04-04: Fixed CI Pipeline Errors

**What:** Resolved two CI/CD issues preventing smooth pipeline execution:

1. **Error 1 — Duplicate pnpm version specification**
   - Removed redundant `version: 9` from `pnpm/action-setup@v4` in `.github/workflows/ci.yml`
   - The action now automatically reads `packageManager: pnpm@9.0.0` from `package.json`
   - Eliminates version conflict that was blocking workflow runs

2. **Warning 2 — Node.js 20 actions deprecation**
   - Added `env: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` at job level
   - Opts runner into Node.js 24 immediately, silencing deprecation warnings
   - Future-proofs pipeline against mandatory Node 24 migration (June 2026)

3. **Bonus — codecov-action version bump**
   - Upgraded `codecov/codecov-action@v4` → `@v5`
   - v5 uses Node 24, aligning with runner environment

**Why:** CI pipeline must run cleanly without warnings or errors. Version conflicts block builds, and deprecation warnings indicate technical debt. Proactive adoption of Node 24 prevents forced migration in 2026.

**Files Modified:**
- ✅ .github/workflows/ci.yml (removed version: 9, added env flag, bumped codecov action)

## 2026-04-03: Release Workflow & README Version Sync

**What:** Fixed two release-critical issues:
1. **Removed pnpm version conflict from release.yml** — removed hardcoded `with: version: 9` from `pnpm/action-setup@v4` and added `env: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` at job level (matching ci.yml fix)
2. **Added README version sync via semantic-release** — three-part solution:
   - Added npm version badge to README.md top (auto-updates from registry)
   - Added README.md to git assets in `@semantic-release/git` config
   - Added `@semantic-release/exec` prepareCmd to sync version in README heading before commit

**Why:** 
- Release workflow used conflicting pnpm version config, causing CI/CD failures
- README v0.2.0 hardcoded and drifting from actual releases — npm badge + semantic-release sync keeps it current

**How:**
- Updated `.github/workflows/release.yml` with env var and removed version pin
- Updated `README.md` with npm version badge below title
- Updated `package.json` release.plugins to include @semantic-release/exec and README.md in git assets
- Added `@semantic-release/exec` to devDependencies, ran npm install

**Result:** Release workflow now uses compatible pnpm version, README version auto-synced on each release.

## 2026-04-05: GitVersion 5.12.0 Integration

**What:** Replaced semantic-release's commit-analyzer version calculation with GitVersion 5.12.0:
1. **Created GitVersion.yml** at repo root with Mainline mode, branch strategies (main, feature, fix), and message-based versioning rules
2. **Updated ci.yml** — Added GitVersion setup and execute steps after pnpm install to display semver during CI runs
3. **Updated release.yml** — Added GitVersion steps before semantic-release, passed GITVERSION_SEMVER as env var to release job
4. **Updated package.json** — Removed `@semantic-release/commit-analyzer` plugin (GitVersion handles version calc), updated exec prepareCmd to use `npm version ${GITVERSION_SEMVER}` for version sync

**Why:** GitVersion provides deterministic semantic versioning based on git history without relying on commit conventions. Mainline mode follows trunk-based development (main branch), branch strategies enable alpha/fix tags for feature/fix branches, and tag-prefix 'v' matches existing tagging scheme.

**How:**
- Created GitVersion.yml with config for Mainline, feature/alpha, and fix/patch branching
- Added gittools/actions/gitversion/setup@v3 and execute@v3 to both workflows
- Removed commit-analyzer from release plugins array in package.json
- Updated exec prepareCmd to incorporate npm version with GITVERSION_SEMVER env var

**Result:** ci and release workflows now use GitVersion for deterministic versioning; semantic-release focuses on publishing and changelog generation without version analysis.

## 2026-04-05: Feature Branch + RELEASE-NOTES Refactor

**What:** Created `feature/pre-phase4-cleanup` branch and refactored release documentation per pre-Phase 4 cleanup directives:

1. **Feature Branch Created** — `feature/pre-phase4-cleanup` for all pre-Phase 4 work (main branch now protected)
2. **RELEASES.md → RELEASE-NOTES.md** — Replaced RELEASES.md with clean, user-focused v0.3.0 release notes only
   - Removed v0.1.0 historical section
   - Removed [Unreleased] marker and phase references
   - Kept only what users need: new features, changed items, documentation updates
3. **Reference Audit** — Confirmed no references to RELEASES.md in package.json, .releaserc, .github/workflows, or code files

**Why:** 
- RELEASES.md was growing with version history; RELEASE-NOTES.md shows current release only
- Simpler versioning workflow — future releases update RELEASE-NOTES.md in-place
- User-focused — current users see current release without historical cruft
- Automated release tools can generate new RELEASE-NOTES.md from conventional commits directly

**Commit:**
- `60beef5` — chore: rename RELEASES.md to RELEASE-NOTES.md (v0.3.0 only)

**Decision Document:**
- `.squad/decisions/inbox/clu-branch-releases.md` — Captures rationale and next steps

