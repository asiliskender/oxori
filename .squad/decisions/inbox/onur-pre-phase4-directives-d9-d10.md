
---

### 2026-04-05: Additional pre-Phase 4 directives (D9–D10)
**By:** Onur Asiliskender (via Copilot)

**D9 — Conventional commit format at phase end:**
When a phase/sprint ends, the final commit message MUST use the correct conventional commit type that reflects the magnitude of the changes, because the CI pipeline derives the semver version number from commit messages (GitVersion + semantic-release):
- Breaking API changes → `feat!: ...` or footer `BREAKING CHANGE:` → major bump
- New features/capabilities added → `feat: ...` → minor bump
- Fixes/patches only → `fix: ...` → patch bump
Use the type that honestly reflects what changed in the phase.

**D10 — Remove CONTRIBUTING.md:**
Delete CONTRIBUTING.md entirely. Remove all references to it from other files (README.md, docs/, .github/, etc.).

**Why:** User request — captured for team memory.
