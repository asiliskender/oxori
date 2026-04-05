# CLU: Feature Branch + RELEASE-NOTES Refactor

**Date:** 2026-04-04  
**Agent:** Clu (DevOps / CI Engineer)  
**Decision:** Created `feature/pre-phase4-cleanup` branch and refactored release documentation.

## What Was Done

### 1. Feature Branch Creation
- Created branch: `feature/pre-phase4-cleanup`
- Main branch is protected; all work happens on feature branches per new policy

### 2. RELEASES.md → RELEASE-NOTES.md
- **Created:** `RELEASE-NOTES.md` with v0.3.0 content only
- **Deleted:** `RELEASES.md` (which contained v0.1.0 history, v0.3.0 unreleased notes, and Phase references)
- **Format:** Clean, user-focused release notes with no internal team references, phase numbers, or squad mentions

### 3. Reference Audit
Searched for references to RELEASES.md in:
- ✅ `package.json` — No references
- ✅ `.releaserc` — Not found (no semantic-release config file exists)
- ✅ `.github/workflows/` — No references
- ✅ Code files — No references

The only references to RELEASES.md exist in `.squad/` historical decision documents, which are kept as-is for audit trail.

### 4. Commit
```
chore: rename RELEASES.md to RELEASE-NOTES.md (v0.3.0 only)

- Replace RELEASES.md with RELEASE-NOTES.md
- Keep only current release (v0.3.0) content
- Remove historical v0.1.0 and unreleased sections
```

Commit SHA: `60beef5`

## Why This Matters

- **Simpler versioning workflow** — Future releases update RELEASE-NOTES.md in-place rather than appending to a growing history
- **User-focused** — Current users see current release notes, not buried in historical cruft
- **Clean git history** — RELEASE-NOTES.md can be updated via conventional commits without versioning overhead
- **Automated release workflows** — Release tools can generate new RELEASE-NOTES.md content directly from commit messages

## Next Steps

- Other agents will add commits to this branch (Phase 4 semantic search work)
- Will be merged to main once Phase 4 is complete
- Branch remains open for additional pre-Phase 4 cleanup work

