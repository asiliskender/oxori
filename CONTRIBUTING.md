# Contributing to Oxori

Oxori is built by a team of specialists working in phases. Each phase is a complete, shippable npm release with tests, docs, and architectural review before merge.

## Getting Started

### Prerequisites

- Node.js 20 or later
- pnpm (preferred package manager)
- Git

### Development Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/oxori.git
cd oxori

# Install pnpm if you don't have it
npm install -g pnpm

# Install dependencies
pnpm install

# Verify everything works
pnpm test
pnpm typecheck
pnpm lint
```

## Running Commands Locally

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test -- --coverage

# Run a specific test file
pnpm test tests/parser.test.ts

# Watch mode (re-run tests on file change)
pnpm test:watch

# Type check
pnpm typecheck

# Lint code
pnpm lint

# Auto-fix lint and format issues
pnpm lint:fix
pnpm format:fix

# Build for distribution
pnpm build

# Run CLI locally (dev mode)
pnpm dev -- init ./test-vault
pnpm dev -- index
```

## Code Conventions

### TypeScript

- **Strict mode enabled** — `strict: true` in tsconfig.json
- **No `any` type** — use `unknown` and narrow at call sites
- **Named exports only** — no default exports
- **Use `type` keyword** — for type-only imports: `import type { Foo } from "..."`

### Functions and Classes

- **Prefer functions** — use classes only for stateful objects (Vault, MCP server)
- **Descriptive names** — `frontmatter` not `fm`, `governance` not `gov`
- **No abbreviations** — full names make code self-documenting
- **Error handling** — use `Result<T, E>` pattern or throw on unrecoverable errors

### File Paths

- **Always normalize** — use `path.resolve()` before storing paths
- **Store absolute paths** — never store relative paths in data structures
- **Use Node.js `path` module** — never string-concatenate paths

### Async/Await

- **Prefer `async/await`** — over callbacks or raw Promises
- **Don't mix styles** — be consistent within a file

### Comments

- **Document the WHY, not the WHAT** — code should be self-explanatory; comments explain design decisions
- **JSDoc for public functions** — include @param, @returns, @example, @throws tags
- **Mark edge cases** — use comments for non-obvious logic, especially around state mutation or side effects

## Commit Convention

We use **Conventional Commits** for automatic versioning and changelog generation. Every commit message follows this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types

- `feat:` — new feature (triggers minor version bump)
- `fix:` — bug fix (triggers patch bump)
- `docs:` — documentation changes (no version bump)
- `test:` — test additions/modifications (no version bump)
- `refactor:` — code refactoring (no version bump)
- `perf:` — performance improvements (no version bump)
- `chore:` — dependency updates, config changes (no version bump)

### Breaking Changes

Mark breaking changes with `!` after the scope or include `BREAKING CHANGE:` in the footer (triggers major version bump):

```
feat!: change index format to hierarchical
```

Or:

```
feat: redesign query language

BREAKING CHANGE: query syntax changed from 'file:type' to 'type:decision'
```

### Examples

```bash
# Feature
git commit -m "feat(parser): add support for frontmatter aliases"

# Bug fix
git commit -m "fix(indexer): handle missing tag gracefully"

# Documentation
git commit -m "docs(architecture): update layer descriptions"

# Test
git commit -m "test(parser): add fixtures for edge cases"

# Multi-line (use git commit without -m, then edit in editor)
git commit
# Editor opens:
# feat(graph): add traversal depth limit
#
# Prevents infinite loops in cyclic link graphs. Traversal now stops
# after configured depth (default: 3). Closes #42.
```

## Testing

### Test Structure

- Each module has a corresponding `.test.ts` file in `tests/`
- Tests use `vitest` framework with a flat assertion style
- Test fixtures live in `tests/fixtures/` — sample vaults and markdown files

### Test Coverage

- **Minimum 80%** coverage across all modules
- **Parser, indexer, governance** modules should aim for **95%+** coverage
- Critical paths (error handling, edge cases) must have dedicated tests

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { parseFile } from '../src/parser';

describe('parseFile', () => {
  it('extracts frontmatter from a markdown file', async () => {
    const result = await parseFile('./tests/fixtures/basic-vault/note.md');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.frontmatter.type).toBe('decision');
    }
  });

  it('returns error for missing file', async () => {
    const result = await parseFile('./nonexistent.md');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_NOT_FOUND');
    }
  });
});
```

### Integration Tests

- Test full workflows: init → index → query → walk
- Test vault scenarios with multiple files and complex relationships
- Test governance enforcement end-to-end

## Creating a Pull Request

1. **Create a branch** — use kebab-case: `feat/semantic-search`, `fix/parser-edge-case`
2. **Link to an issue** — every PR should reference a GitHub issue (e.g. `Closes #42`)
3. **Run checks locally** — before pushing:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test -- --coverage
   ```
4. **Write a clear PR description** — include context, what changed, and why
5. **Keep commits atomic** — one logical change per commit
6. **Wait for review** — Flynn (architecture) reviews all Phase PRs before merge

### PR Checklist

- [ ] Follows commit convention (feat/fix/docs/test/refactor)
- [ ] Tests added/updated with 80%+ coverage
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
- [ ] README or docs updated (if needed)
- [ ] No `any` types
- [ ] No console.logs or debugging code
- [ ] Linked to a GitHub issue

## Phases and Releases

Oxori is built in 5 phases, each a separate npm release:

| Phase | Scope | Release | Status |
|-------|-------|---------|--------|
| 1 | Parser + Markdown Index | v0.1.0 | Current |
| 2 | Query + Graph Walk | v0.2.0 | Planned |
| 3 | Write API + Governance | v0.3.0 | Planned |
| 4 | Semantic Search | v0.4.0 | Planned |
| 5 | MCP + Watcher | v0.5.0 | Planned |

### Phase Process

1. **Create issue** for the phase (e.g. "Phase 2: Query and Graph Traversal")
2. **Break into tasks** — open sub-issues for each module
3. **Developers create PRs** — link to the phase issue
4. **Flynn reviews** — architecture + design approval
5. **Merge to main** — all tests pass, 80%+ coverage
6. **Tag release** — create Git tag `v0.X.0`
7. **Publish npm** — automated via GitHub Actions
8. **Dumont writes release notes** — features, breaking changes, migration steps

### Phase Gates

Each phase is gated by:
- All tests passing (80%+ coverage, 95%+ for parser/indexer/governance)
- All issues closed and PRs merged
- Architecture reviewed and approved by Flynn
- Documentation complete (JSDoc, architecture.md updated)
- Release notes written

## Documentation

### Inline JSDoc

Public functions and types should have JSDoc:

```typescript
/**
 * Parses a markdown file and extracts its structure.
 *
 * @param filepath - Absolute path to the file, normalized via path.resolve()
 * @returns A Result wrapping the parsed file or an error
 *
 * @example
 * const result = await parseFile('/vault/auth.md');
 * if (result.ok) {
 *   console.log(result.value.tags);
 * }
 *
 * @throws Never throws — errors are returned in the Result
 */
export async function parseFile(filepath: string): Promise<Result<ParsedFile>> {
  // ...
}
```

### Architecture Documentation

Major design decisions go in `docs/architecture.md`:

- Layer descriptions
- Data flow diagrams (ASCII or Mermaid)
- Type system overview
- Key ADRs (architectural decision records)
- Performance notes

### README and Guides

- Keep README high-level and focused on getting started
- Move detailed docs to `docs/` folder
- Include code examples that are tested or clearly marked as pseudo-code

## CI/CD Pipeline

### GitHub Actions

Every push and PR triggers:

```yaml
1. Lint (ESLint)
2. Type check (TypeScript)
3. Test + coverage (vitest)
4. Coverage report (upload to Codecov)
```

Coverage must stay at 80%+ or CI fails.

### Release Pipeline

Merges to `main` trigger:

```yaml
1. semantic-release reads commits
2. Determines version bump (major/minor/patch)
3. Creates changelog
4. Creates Git tag
5. Publishes to npm
```

## Getting Help

- **Questions?** Open a discussion or ask in a PR comment
- **Found a bug?** Open an issue with a reproducible example
- **Want to contribute?** Pick an open issue with the `good first issue` label

## Code of Conduct

Be respectful, inclusive, and constructive. We're building a shared knowledge layer for humans and AI agents — everyone's perspective matters.
