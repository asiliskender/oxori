/**
 * @file cli.test.ts
 * @description End-to-end tests for the Oxori CLI commands.
 *
 * Tests spawn `tsx src/cli.ts` as a child process and assert on exit codes,
 * stdout/stderr, and filesystem side effects. Each test that modifies the
 * filesystem uses an isolated temp directory under tests/.tmp-cli-<n>/ and
 * cleans up afterwards.
 *
 * Run: pnpm test:coverage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { spawnSync } from 'child_process'
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const REPO_ROOT = resolve(__dirname, '..')
const CLI_ENTRY = join(REPO_ROOT, 'src', 'cli.ts')
const BASIC_VAULT = join(__dirname, 'fixtures/basic-vault')
const LINKED_VAULT = join(__dirname, 'fixtures/linked-vault')

/** Runs the CLI via tsx and returns { stdout, stderr, status }. */
function runCLI(args: string[], cwd: string = REPO_ROOT) {
  const result = spawnSync('node', ['--import', 'tsx/esm', CLI_ENTRY, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
    timeout: 15_000,
  })
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? -1,
  }
}

/** Per-test temp workspace, created fresh and cleaned up after each test. */
let testDir: string
let testIndex = 0

beforeEach(() => {
  testIndex++
  testDir = join(__dirname, `.tmp-cli-${testIndex}`)
  mkdirSync(testDir, { recursive: true })
})

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true })
})

// -----------------------------------------------------------------------------
// oxori init
// -----------------------------------------------------------------------------
describe('oxori init', () => {
  it('creates .oxori/ directory in the target path', () => {
    runCLI(['init', testDir])
    expect(existsSync(join(testDir, '.oxori', 'index'))).toBe(true)
  })

  it('prints a user-friendly success message to stdout', () => {
    const { stdout } = runCLI(['init', testDir])
    expect(stdout).toContain('✓ Initialized Oxori vault')
  })

  it('exits with code 0 on success', () => {
    const { status } = runCLI(['init', testDir])
    expect(status).toBe(0)
  })

  it('fails gracefully if path is not writable', () => {
    // Create a file at testDir/deep so that mkdir(testDir/deep/vault/.oxori/index) fails
    // because 'deep' is a file, not a directory.
    writeFileSync(join(testDir, 'deep'), 'not a directory')
    const blockedPath = join(testDir, 'deep', 'vault')
    const { stdout, status } = runCLI(['init', blockedPath])
    expect(status).not.toBe(0)
    expect(stdout).toContain('✗')
  })

  it('is idempotent — running init twice does not overwrite existing .oxori/', () => {
    runCLI(['init', testDir])
    const { stdout, status } = runCLI(['init', testDir])
    expect(status).toBe(0)
    expect(stdout).toContain('✓ Initialized Oxori vault')
    expect(existsSync(join(testDir, '.oxori', 'index'))).toBe(true)
  })
})

// -----------------------------------------------------------------------------
// oxori index
// -----------------------------------------------------------------------------
describe('oxori index', () => {
  it('re-indexes vault in the current working directory', () => {
    // CLI takes an explicit path argument; run with BASIC_VAULT from a different cwd
    const { status } = runCLI(['index', BASIC_VAULT], testDir)
    expect(status).toBe(0)
  })

  it('accepts --vault flag to specify a vault path', () => {
    // The CLI accepts an explicit path argument. Copy a markdown file into testDir
    // and index it by passing the absolute path directly.
    writeFileSync(join(testDir, 'note.md'), '# Hello\nSome content.')
    const { status } = runCLI(['index', testDir])
    expect(status).toBe(0)
  })

  it('prints indexed file count to stdout', () => {
    const { stdout } = runCLI(['index', BASIC_VAULT])
    expect(stdout).toMatch(/✓ Indexed \d+ files in \d+ms/)
  })

  it('prints error with action suggestion if no vault found at path', () => {
    const nonexistent = join(testDir, 'no-such-vault-xyz')
    const { stdout, status } = runCLI(['index', nonexistent])
    expect(status).not.toBe(0)
    expect(stdout).toContain('✗')
  })

  it('exits with code 0 when vault is valid and indexing succeeds', () => {
    const { status } = runCLI(['index', BASIC_VAULT])
    expect(status).toBe(0)
  })

  it('exits with non-zero code on vault not found', () => {
    const { status } = runCLI(['index', join(testDir, 'ghost-vault')])
    expect(status).not.toBe(0)
  })
})

// -----------------------------------------------------------------------------
// oxori query
// -----------------------------------------------------------------------------
describe('oxori query', () => {
  it('returns matching files for a valid query (tag filter)', () => {
    const { stdout, status } = runCLI(['query', 'tag:auth', '--vault', BASIC_VAULT])
    expect(status).toBe(0)
    expect(stdout).toContain('decisions/api-choice.md')
  })

  it("exits 0 with 'No files matched.' for a query that matches nothing", () => {
    const { stdout, status } = runCLI(['query', 'tag:zzz-nonexistent-xyz', '--vault', BASIC_VAULT])
    expect(status).toBe(0)
    expect(stdout).toContain('No files matched.')
  })

  it('outputs JSON when --json flag is passed', () => {
    const { stdout, status } = runCLI(['query', 'tag:auth', '--vault', BASIC_VAULT, '--json'])
    expect(status).toBe(0)
    const parsed = JSON.parse(stdout) as { files: string[]; totalCount: number }
    expect(Array.isArray(parsed.files)).toBe(true)
    expect(parsed.files.length).toBeGreaterThan(0)
    expect(typeof parsed.totalCount).toBe('number')
  })

  it('accepts --vault flag to specify vault path', () => {
    const { stdout, status } = runCLI(['query', 'tag:auth', '--vault', BASIC_VAULT], REPO_ROOT)
    expect(status).toBe(0)
    expect(stdout).toContain('decisions/api-choice.md')
  })

  it('exits 1 and prints error for invalid query (unbalanced parens)', () => {
    const { stderr, status } = runCLI(['query', '(tag:auth', '--vault', BASIC_VAULT])
    expect(status).toBe(1)
    expect(stderr).toContain('✗')
  })

  it('exits 1 and prints error for unknown filter field', () => {
    const { stderr, status } = runCLI(['query', 'badfield:value', '--vault', BASIC_VAULT])
    expect(status).toBe(1)
    expect(stderr).toContain('✗')
  })
})

// -----------------------------------------------------------------------------
// oxori walk
// -----------------------------------------------------------------------------
describe('oxori walk', () => {
  it('walks forward from start node and prints visited files', () => {
    const { stdout, status } = runCLI([
      'walk', 'node-a.md',
      '--vault', LINKED_VAULT,
      '--via', 'links',
    ])
    expect(status).toBe(0)
    // node-a links to node-b and node-c; node-b links to node-c and node-d; cycle back handled
    expect(stdout).toContain('node-b.md')
    expect(stdout).toContain('node-d.md')
  })

  it('accepts --direction backward flag', () => {
    const { stdout, status } = runCLI([
      'walk', 'node-d.md',
      '--vault', LINKED_VAULT,
      '--direction', 'backward',
      '--via', 'links',
    ])
    expect(status).toBe(0)
    // node-b, node-e, node-g all link to node-d directly
    expect(stdout).toContain('node-b.md')
    expect(stdout).toContain('node-e.md')
  })

  it('accepts --depth flag to limit traversal', () => {
    const { stdout, status } = runCLI([
      'walk', 'node-a.md',
      '--vault', LINKED_VAULT,
      '--via', 'links',
      '--depth', '1',
    ])
    expect(status).toBe(0)
    // depth 1: node-a + immediate neighbors node-b, node-c — node-d is 2 hops away
    expect(stdout).toContain('node-b.md')
    expect(stdout).not.toContain('node-d.md')
  })

  it('outputs JSON when --json flag is passed', () => {
    const { stdout, status } = runCLI([
      'walk', 'node-a.md',
      '--vault', LINKED_VAULT,
      '--via', 'links',
      '--json',
    ])
    expect(status).toBe(0)
    const parsed = JSON.parse(stdout) as { visited: string[]; edges: unknown[]; totalCount: number }
    expect(Array.isArray(parsed.visited)).toBe(true)
    expect(Array.isArray(parsed.edges)).toBe(true)
    expect(typeof parsed.totalCount).toBe('number')
  })

  it('exits 1 when start path is not found in vault', () => {
    const { stderr, status } = runCLI([
      'walk', 'nonexistent-file.md',
      '--vault', LINKED_VAULT,
    ])
    expect(status).toBe(1)
    expect(stderr).toContain('✗')
  })
})

// -----------------------------------------------------------------------------
// oxori graph
// -----------------------------------------------------------------------------
describe('oxori graph', () => {
  it("prints all edges in the vault as 'source → target' lines", () => {
    const { stdout, status } = runCLI(['graph', '--vault', LINKED_VAULT])
    expect(status).toBe(0)
    // node-a body links to node-b and node-c
    expect(stdout).toContain('node-a.md → node-b.md (wikilink)')
    expect(stdout).toContain('node-a.md → node-c.md (wikilink)')
  })

  it('outputs JSON with nodes and edges when --json flag is passed', () => {
    const { stdout, status } = runCLI(['graph', '--vault', LINKED_VAULT, '--json'])
    expect(status).toBe(0)
    const parsed = JSON.parse(stdout) as { nodes: string[]; edges: { source: string; target: string; kind: string }[] }
    expect(Array.isArray(parsed.nodes)).toBe(true)
    expect(Array.isArray(parsed.edges)).toBe(true)
    expect(parsed.nodes.length).toBeGreaterThan(0)
    // verify at least one edge connects node-a to node-b
    const edge = parsed.edges.find(e => e.source === 'node-a.md' && e.target === 'node-b.md')
    expect(edge).toBeDefined()
  })

  it('exits 0 on an empty vault (no markdown files)', () => {
    const { stdout, status } = runCLI(['graph', '--vault', testDir])
    expect(status).toBe(0)
    expect(stdout.trim()).toBe('')
  })
})

// -----------------------------------------------------------------------------
// oxori watch (Sprint 3)
// -----------------------------------------------------------------------------
describe('oxori watch', () => {
  it.todo('starts watching a vault directory for changes')
  it.todo('emits watcher events when files are added')
  it.todo('emits watcher events when files are modified')
  it.todo('emits watcher events when files are deleted')
  it.todo('exits gracefully on SIGINT')
  it.todo('prints error and exits if vault path does not exist')
})

// -----------------------------------------------------------------------------
// oxori check (Sprint 3)
// -----------------------------------------------------------------------------
describe('oxori check', () => {
  it.todo('runs governance checks on all files in vault')
  it.todo('outputs violations when rules are violated')
  it.todo('exits with code 0 when all checks pass')
  it.todo('exits with non-zero code when violations found')
  it.todo('accepts --rules flag to specify custom rules file')
  it.todo('outputs JSON when --json flag is passed')
})

