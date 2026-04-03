/**
 * @file indexer.test.ts
 * @description Unit + integration tests for the indexVault() function.
 *
 * Tests are written against fixtures in tests/fixtures/basic-vault/ and
 * tests/fixtures/linked-vault/. The indexer implementation lives in src/indexer.ts
 * (authored by Tron). Tests marked it.todo() need implementation details that
 * cannot be known before the indexer is written.
 *
 * Run: pnpm test:coverage
 */

import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { indexVault } from '../src/indexer'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BASIC_VAULT = join(__dirname, 'fixtures/basic-vault')
const LINKED_VAULT = join(__dirname, 'fixtures/linked-vault')
const GOVERNANCE_VAULT = join(__dirname, 'fixtures/governance-vault')

describe('indexVault', () => {
  // ---------------------------------------------------------------------------
  // Vault scanning
  // ---------------------------------------------------------------------------
  describe('vault scanning', () => {
    it('scans all .md files in vault recursively', async () => {
      const result = await indexVault({ vaultPath: BASIC_VAULT })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const state = result.value
      // basic-vault has: overview, note-one, note-two, prerequisite, no-frontmatter,
      // empty, plus the legacy files in decisions/, memory/, tasks/ subdirectories
      // At minimum, the 6 root-level fixtures must be indexed
      expect(state.totalFiles).toBeGreaterThanOrEqual(6)
      expect(state.files.size).toBe(state.totalFiles)
    })

    it('builds a files map keyed by absolute filepath', async () => {
      const result = await indexVault({ vaultPath: BASIC_VAULT })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const overviewPath = join(BASIC_VAULT, 'overview.md')
      expect(result.value.files.has(overviewPath)).toBe(true)
    })

    it('excludes files starting with .', async () => {
      const result = await indexVault({ vaultPath: BASIC_VAULT })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      for (const filepath of result.value.files.keys()) {
        const parts = filepath.split('/')
        for (const part of parts) {
          expect(part.startsWith('.')).toBe(false)
        }
      }
    })

    it('excludes files inside .oxori/', async () => {
      // governance-vault has .oxori/governance.md — must not be indexed
      const result = await indexVault({
        vaultPath: GOVERNANCE_VAULT,
        excludePatterns: ['.oxori/**'],
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      for (const filepath of result.value.files.keys()) {
        expect(filepath).not.toContain('/.oxori/')
      }
    })

    it.todo(
      'throws with action suggestion if vault path does not exist',
      // Expected: indexVault({ vaultPath: '/no/such/vault' }) rejects with OxoriError
      // code: 'VAULT_NOT_FOUND', with a non-empty action string
    )
  })

  // ---------------------------------------------------------------------------
  // In-memory cache
  // ---------------------------------------------------------------------------
  describe('in-memory cache', () => {
    it('builds files map keyed by filepath with correct FileEntry shape', async () => {
      const result = await indexVault({ vaultPath: BASIC_VAULT })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const state = result.value
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
      const result = await indexVault({ vaultPath: BASIC_VAULT })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      // overview.md has project/alpha → expands to 'project', 'project/alpha'
      expect(result.value.tags.has('project')).toBe(true)
      expect(result.value.tags.has('project/alpha')).toBe(true)
    })

    it('tags map entries list files that carry each tag', async () => {
      const result = await indexVault({ vaultPath: BASIC_VAULT })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const overviewPath = join(BASIC_VAULT, 'overview.md')
      const entry = result.value.tags.get('project/alpha')
      expect(entry?.files.has(overviewPath)).toBe(true)
    })

    it('builds links map keyed by target stem', async () => {
      const result = await indexVault({ vaultPath: BASIC_VAULT })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      // overview.md links to note-two and prerequisite
      expect(result.value.links.has('note-two')).toBe(true)
      expect(result.value.links.has('prerequisite')).toBe(true)
    })

    it('links map entries list files that reference each target', async () => {
      const result = await indexVault({ vaultPath: BASIC_VAULT })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const overviewPath = join(BASIC_VAULT, 'overview.md')
      const entry = result.value.links.get('note-two')
      expect(entry?.sources.has(overviewPath)).toBe(true)
    })

    it('totalFiles count matches the size of the files map', async () => {
      const result = await indexVault({ vaultPath: BASIC_VAULT })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.totalFiles).toBe(result.value.files.size)
    })

    it('lastIndexed is a recent Unix timestamp', async () => {
      const before = Date.now()
      const result = await indexVault({ vaultPath: BASIC_VAULT })
      const after = Date.now()
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.lastIndexed).toBeGreaterThanOrEqual(before)
      expect(result.value.lastIndexed).toBeLessThanOrEqual(after)
    })
  })

  // ---------------------------------------------------------------------------
  // Index file output
  // ---------------------------------------------------------------------------
  describe('index file output', () => {
    it.todo(
      'creates .oxori/index/ directory if missing when writing output',
      // Expected: after indexVault() with writeOutput:true option,
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
      // Expected: running indexVault() twice produces identical output — rows
      // in files.md, tags.md, links.md are sorted alphabetically so git diffs are clean
    )
  })

  // ---------------------------------------------------------------------------
  // Cycle and graph handling (linked-vault)
  // ---------------------------------------------------------------------------
  describe('graph integrity', () => {
    it('indexes a vault with cyclic wikilinks without infinite loop', async () => {
      // linked-vault: node-a → node-c → node-a (cycle)
      // indexVault must complete and not hang
      const result = await indexVault({ vaultPath: LINKED_VAULT })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.totalFiles).toBeGreaterThanOrEqual(7)
    })

    it('indexes leaf nodes correctly (node-d has no outgoing links)', async () => {
      const result = await indexVault({ vaultPath: LINKED_VAULT })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const nodeDPath = join(LINKED_VAULT, 'node-d.md')
      const entry = result.value.files.get(nodeDPath)
      expect(entry?.wikilinks.size).toBe(0)
      expect(entry?.typedRelations.size).toBe(0)
    })

    it('handles multiple typed relation targets per key (node-f related_to)', async () => {
      const result = await indexVault({ vaultPath: LINKED_VAULT })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const nodeFPath = join(LINKED_VAULT, 'node-f.md')
      const entry = result.value.files.get(nodeFPath)
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
      // Expected: indexVault() on an empty directory returns an IndexState
      // with totalFiles === 0 and empty maps — no error thrown
    )

    it.todo(
      'handles files with identical names in different subdirectories',
      // Expected: both files appear in the files map under their full absolute paths,
      // not overwriting each other
    )

    it('handles empty files without throwing', async () => {
      // basic-vault/empty.md is 0 bytes — indexVault must not throw
      const result = await indexVault({ vaultPath: BASIC_VAULT })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const emptyPath = join(BASIC_VAULT, 'empty.md')
      const entry = result.value.files.get(emptyPath)
      expect(entry).toBeDefined()
      expect(entry?.tags.size).toBe(0)
      expect(entry?.wikilinks.size).toBe(0)
    })
  })
})
