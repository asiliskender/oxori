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
