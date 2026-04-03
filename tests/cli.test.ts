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
import { mkdirSync, rmSync, existsSync } from 'fs'

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
  it.todo(
    'creates .oxori/ directory in the target path',
    // Expected: after `oxori init <path>`, the .oxori/ directory exists at <path>/.oxori/
  )

  it.todo(
    'prints a user-friendly success message to stdout',
    // Expected: stdout contains something like "Initialized vault at <path>"
  )

  it.todo(
    'exits with code 0 on success',
    // Expected: status === 0 after a successful init
  )

  it.todo(
    'fails gracefully if path is not writable',
    // Expected: status !== 0 and stderr contains an actionable error message
  )

  it.todo(
    'is idempotent — running init twice does not overwrite existing .oxori/',
    // Expected: second run completes without error and does not destroy existing config
  )
})

// -----------------------------------------------------------------------------
// oxori index
// -----------------------------------------------------------------------------
describe('oxori index', () => {
  it.todo(
    're-indexes vault in the current working directory',
    // Expected: running `oxori index` from a vault dir triggers buildIndex()
    // and exits 0
  )

  it.todo(
    'accepts --vault flag to specify a vault path',
    // Expected: `oxori index --vault <path>` indexes the vault at <path>
    // even when cwd is different
  )

  it.todo(
    'prints indexed file count to stdout',
    // Expected: stdout contains a number and a human-readable label,
    // e.g. "Indexed 6 files." or "6 files indexed."
  )

  it.todo(
    'prints error with action suggestion if no vault found at path',
    // Expected: exit code !== 0, stderr contains a message with an action
    // like "Run `oxori init <path>` to initialise a new vault."
  )

  it.todo(
    'exits with code 0 when vault is valid and indexing succeeds',
  )

  it.todo(
    'exits with non-zero code on vault not found',
  )
})
