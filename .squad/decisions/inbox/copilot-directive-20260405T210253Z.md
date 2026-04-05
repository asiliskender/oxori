### 2026-04-05T21:02:53Z: User directive — Ticket-first, commit-linked workflow
**By:** Onur (via Copilot)
**What:** Hard rule for all work:
  1. A GitHub issue (ticket) MUST be opened BEFORE any work starts
  2. Every commit MUST reference its issue number (e.g., `closes #N`, `refs #N`)
  3. A ticket can ONLY be closed via a commit that references it — no manual closes
  4. The backlog lives in GitHub Projects (not PROJECT.md or any local file)
**Why:** Full traceability between planned work and code changes. No orphan commits.
