/**
 * @file indexer.test.ts
 * @description Unit + integration tests for the buildIndex() function.
 *
 * Tests are written against fixtures in tests/fixtures/basic-vault/ and
 * tests/fixtures/linked-vault/. The indexer implementation lives in src/indexer.ts
 * (authored by Tron). Tests marked it.todo() need implementation details that
 * cannot be known before the indexer is written.
 *
 * Run: pnpm test:coverage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs'
import { buildIndex } from '../src/indexer'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BASIC_VAULT = join(__dirname, 'fixtures/basic-vault')
const LINKED_VAULT = join(__dirname, 'fixtures/linked-vault')
const GOVERNANCE_VAULT = join(__dirname, 'fixtures/governance-vault')

/** Temporary output directory created fresh for each test that writes index files. */
const TEST_OUTPUT_DIR = join(__dirname, '.tmp-indexer')

beforeEach(() => {
  mkdirSync(TEST_OUTPUT_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true })
})

describe('buildIndex', () => {
  // ---------------------------------------------------------------------------
  // Vault scanning
  // ---------------------------------------------------------------------------
  describe('vault scanning', () => {
    it('scans all .md files in vault recursively', async () => {
      const state = await buildIndex(BASIC_VAULT)
      // basic-vault has: overview, note-one, note-two, prerequisite, no-frontmatter,
      // empty, plus the legacy files in decisions/, memory/, tasks/ subdirectories
      // At minimum, the 6 root-level fixtures must be indexed
      expect(state.totalFiles).toBeGreaterThanOrEqual(6)
      expect(state.files.size).toBe(state.totalFiles)
    })

    it('builds a files map keyed by absolute filepath', async () => {
      const state = await buildIndex(BASIC_VAULT)
      const overviewPath = join(BASIC_VAULT, 'overview.md')
      expect(state.files.has(overviewPath)).toBe(true)
    })

    it('excludes files starting with .', async () => {
      const state = await buildIndex(BASIC_VAULT)
      for (const filepath of state.files.keys()) {
        const parts = filepath.split('/')
        for (const part of parts) {
          expect(part.startsWith('.')).toBe(false)
        }
      }
    })

    it('excludes files inside .oxori/', async () => {
      // governance-vault has .oxori/governance.md — must not be indexed
      const state = await buildIndex(GOVERNANCE_VAULT)
      for (const filepath of state.files.keys()) {
        expect(filepath).not.toContain('/.oxori/')
      }
    })

    it.todo(
      'throws with action suggestion if vault path does not exist',
      // Expected: buildIndex('/no/such/vault') rejects with OxoriError
      // code: 'VAULT_NOT_FOUND', with a non-empty action string
    )
  })

  // ---------------------------------------------------------------------------
  // In-memory cache
  // ---------------------------------------------------------------------------
  describe('in-memory cache', () => {
    it('builds files map keyed by filepath with correct FileEntry shape', async () => {
      const state = await buildIndex(BASIC_VAULT)
      const overviewPath = join(BASIC_VAULT, 'overview.md')
      const entry = state.files.get(overviewPath)

      expect(entry).toBeDefined()
      expect(entry?.filename).toBe('overview')
      expect(entry?.filepath).toBe(overviewPath)
      expect(entry?.frontmatter['title']).toBe('Project Overview')
      expect(typeof entry?.lastModified).toBe('number')
      expect((entry?.lastModified ?? 0)).toBeGreaterThan(0)
    })

    it('builds tags map with all ancestor levels', async () => {
      const state = await buildIndex(BASIC_VAULT)
      // overview.md has project/alpha → expands to 'project', 'project/alpha'
      expect(state.tags.has('project')).toBe(true)
      expect(state.tags.has('project/alpha')).toBe(true)
    })

    it('tags map entries list files that carry each tag', async () => {
      const state = await buildIndex(BASIC_VAULT)
      const overviewPath = join(BASIC_VAULT, 'overview.md')
      const entry = state.tags.get('project/alpha')
      expect(entry?.files.has(overviewPath)).toBe(true)
    })

    it('builds links map keyed by target stem', async () => {
      const state = await buildIndex(BASIC_VAULT)
      // overview.md links to note-two and prerequisite
      expect(state.links.has('note-two')).toBe(true)
      expect(state.links.has('prerequisite')).toBe(true)
    })

    it('links map entries list files that reference each target', async () => {
      const state = await buildIndex(BASIC_VAULT)
      const overviewPath = join(BASIC_VAULT, 'overview.md')
      const entry = state.links.get('note-two')
      expect(entry?.sources.has(overviewPath)).toBe(true)
    })

    it('totalFiles count matches the size of the files map', async () => {
      const state = await buildIndex(BASIC_VAULT)
      expect(state.totalFiles).toBe(state.files.size)
    })

    it('lastIndexed is a recent Unix timestamp', async () => {
      const before = Date.now()
      const state = await buildIndex(BASIC_VAULT)
      const after = Date.now()
      expect(state.lastIndexed).toBeGreaterThanOrEqual(before)
      expect(state.lastIndexed).toBeLessThanOrEqual(after)
    })
  })

  // ---------------------------------------------------------------------------
  // Index file output
  // ---------------------------------------------------------------------------
  describe('index file output', () => {
    it.todo(
      'creates .oxori/index/ directory if missing when writing output',
      // Expected: after buildIndex() with writeOutput:true option,
      // the .oxori/index/ directory is created
    )

    it.todo(
      'writes files.md with a markdown table of all indexed files',
      // Expected: .oxori/index/files.md exists and contains a markdown table
      // with columns for filepath, filename, tags, lastModified
    )

    it.todo(
      'writes tags.md with tag → files mapping',
      // Expected: .oxori/index/tags.md exists and maps each tag to its files
    )

    it.todo(
      'writes links.md with target → sources mapping',
      // Expected: .oxori/index/links.md exists and maps each link target to its sources
    )

    it.todo(
      'index files are deterministically ordered (alphabetical) for git stability',
      // Expected: running buildIndex() twice produces identical output — rows
      // in files.md, tags.md, links.md are sorted alphabetically so git diffs are clean
    )
  })

  // ---------------------------------------------------------------------------
  // Cycle and graph handling (linked-vault)
  // ---------------------------------------------------------------------------
  describe('graph integrity', () => {
    it('indexes a vault with cyclic wikilinks without infinite loop', async () => {
      // linked-vault: node-a → node-c → node-a (cycle)
      // buildIndex must complete and not hang
      const state = await buildIndex(LINKED_VAULT)
      expect(state.totalFiles).toBeGreaterThanOrEqual(7)
    })

    it('indexes leaf nodes correctly (node-d has no outgoing links)', async () => {
      const state = await buildIndex(LINKED_VAULT)
      const nodeDPath = join(LINKED_VAULT, 'node-d.md')
      const entry = state.files.get(nodeDPath)
      expect(entry?.wikilinks.size).toBe(0)
      expect(entry?.typedRelations.size).toBe(0)
    })

    it('handles multiple typed relation targets per key (node-f related_to)', async () => {
      const state = await buildIndex(LINKED_VAULT)
      const nodeFPath = join(LINKED_VAULT, 'node-f.md')
      const entry = state.files.get(nodeFPath)
      const targets = entry?.typedRelations.get('related_to') ?? []
      expect(targets).toContain('node-e')
      expect(targets).toContain('node-c')
    })
  })

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it.todo(
      'handles vault with zero markdown files gracefully',
      // Expected: buildIndex() on an empty directory returns an IndexState
      // with totalFiles === 0 and empty maps — no error thrown
    )

    it.todo(
      'handles files with identical names in different subdirectories',
      // Expected: both files appear in the files map under their full absolute paths,
      // not overwriting each other
    )

    it('handles empty files without throwing', async () => {
      // basic-vault/empty.md is 0 bytes — buildIndex must not throw
      const state = await buildIndex(BASIC_VAULT)
      const emptyPath = join(BASIC_VAULT, 'empty.md')
      const entry = state.files.get(emptyPath)
      expect(entry).toBeDefined()
      expect(entry?.tags.size).toBe(0)
      expect(entry?.wikilinks.size).toBe(0)
    })
  })
})
