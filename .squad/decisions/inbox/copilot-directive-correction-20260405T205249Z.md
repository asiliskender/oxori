### 2026-04-05T20:52:49Z: CORRECTION — Backlog tooling clarification
**By:** Onur (via Copilot)
**What:** The project backlog is **GitHub Projects**, NOT PROJECT.md.
  - Backlog-first workflow rule still applies: tasks go into GitHub Projects before work starts
  - When tasks complete, the GitHub Projects item is updated
  - Commit messages reference the GitHub issue/project item number (e.g., "fix(ci): resolve micromatch — closes #12")
  - PROJECT.md contains high-level phase descriptions only — it is NOT the work backlog
**Why:** Corrects erroneous directive from 2026-04-05T20:50:03Z that named PROJECT.md as the backlog
