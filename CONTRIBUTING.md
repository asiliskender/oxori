# Contributing to Oxori

## Development Setup

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

## Commit Convention

We use Conventional Commits for automatic versioning and changelog generation.

```
feat: add graph walk with typed relations       → minor bump (0.1.0 → 0.2.0)
fix: handle missing frontmatter gracefully      → patch bump (0.1.0 → 0.1.1)
docs: update architecture with governance       → no version bump
test: add fixtures for linked vault             → no version bump
refactor: extract query AST into module         → no version bump
feat!: change index format to hierarchical      → major bump (0.1.0 → 1.0.0)
```

## Running Checks Locally

```bash
# All checks (same as CI)
pnpm lint
pnpm typecheck
pnpm test:coverage

# Auto-fix lint and format
pnpm lint:fix
pnpm format:fix

# Run specific test file
pnpm test tests/parser.test.ts

# Watch mode
pnpm test:watch

# Run CLI locally
pnpm dev -- init ./test-vault
pnpm dev -- query "type:decision"
```

## Testing

Tests live in `tests/` with one file per module. Sample vaults for testing are under `tests/fixtures/`.

Coverage target is 80% overall. Parser and governance modules should aim for near 100%.

When adding a new feature, write tests first or alongside the implementation.

## Project Phases

Check the roadmap in README.md and the build order in PROJECT.md. If you want to contribute, pick a task from the current phase.
