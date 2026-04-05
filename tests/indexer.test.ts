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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { indexVault, indexFile, removeFile, createEmptyState } from '../src/indexer'

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
    let tmpDir: string
    let tmpCounter = 0

    beforeEach(async () => {
      tmpCounter++
      tmpDir = join(__dirname, `.tmp-indexer-${tmpCounter}`)
      await mkdir(tmpDir, { recursive: true })
    })

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true })
    })

    it('handles vault with zero markdown files gracefully', async () => {
      const result = await indexVault({ vaultPath: tmpDir })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.totalFiles).toBe(0)
      expect(result.value.files.size).toBe(0)
      expect(result.value.tags.size).toBe(0)
      expect(result.value.links.size).toBe(0)
    })

    it('handles files with identical names in different subdirectories', async () => {
      const subA = join(tmpDir, 'folder-a')
      const subB = join(tmpDir, 'folder-b')
      await mkdir(subA, { recursive: true })
      await mkdir(subB, { recursive: true })
      await writeFile(join(subA, 'note.md'), '# Note A\n\n#tag-a\n')
      await writeFile(join(subB, 'note.md'), '# Note B\n\n#tag-b\n')

      const result = await indexVault({ vaultPath: tmpDir })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.totalFiles).toBe(2)
      expect(result.value.files.has(join(subA, 'note.md'))).toBe(true)
      expect(result.value.files.has(join(subB, 'note.md'))).toBe(true)
    })

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

    it('skips files that fail to parse and logs a warning', async () => {
      // YAML undefined alias reference triggers YAMLException in js-yaml/gray-matter
      await writeFile(join(tmpDir, 'bad.md'), '---\nfoo: *undefined_anchor\n---\n# body\n')
      await writeFile(join(tmpDir, 'good.md'), '# Good\n\n#tag-ok\n')

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const result = await indexVault({ vaultPath: tmpDir })
      warnSpy.mockRestore()

      expect(result.ok).toBe(true)
      if (!result.ok) return
      // good.md indexed, bad.md skipped
      expect(result.value.files.has(join(tmpDir, 'good.md'))).toBe(true)
      expect(result.value.files.has(join(tmpDir, 'bad.md'))).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Error paths
  // ---------------------------------------------------------------------------
  describe('error paths', () => {
    it('returns VAULT_NOT_FOUND when vault path does not exist', async () => {
      const result = await indexVault({ vaultPath: '/no/such/vault/path/oxori-test' })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('VAULT_NOT_FOUND')
      expect(result.error.message).toContain('Vault directory not found')
    })

    it('returns VAULT_NOT_FOUND with different message when readdir fails with non-ENOENT', async () => {
      // Passing a regular file as vaultPath causes readdir to throw ENOTDIR (not ENOENT)
      const result = await indexVault({ vaultPath: '/etc/hosts' })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('VAULT_NOT_FOUND')
      expect(result.error.message).toContain('Failed to read vault directory')
    })
  })
})

// ─── createEmptyState ────────────────────────────────────────────────────────

describe('createEmptyState', () => {
  it('returns a state with empty Maps and zero counters', () => {
    const state = createEmptyState()
    expect(state.files.size).toBe(0)
    expect(state.tags.size).toBe(0)
    expect(state.links.size).toBe(0)
    expect(state.totalFiles).toBe(0)
    expect(state.lastIndexed).toBe(0)
  })

  it('returns a fresh instance on every call', () => {
    const a = createEmptyState()
    const b = createEmptyState()
    expect(a).not.toBe(b)
    expect(a.files).not.toBe(b.files)
  })
})

// ─── indexFile ───────────────────────────────────────────────────────────────

describe('indexFile', () => {
  let tmpDir: string
  let tmpCounter = 0

  beforeEach(async () => {
    tmpCounter++
    tmpDir = join(__dirname, `.tmp-indexfile-${tmpCounter}`)
    await mkdir(tmpDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('indexes a new file into an empty state', async () => {
    const filePath = join(tmpDir, 'alpha.md')
    await writeFile(filePath, '---\ntitle: Alpha\ntags:\n  - project/alpha\n---\n\nSee [[beta]] for more.\n')
    const state = createEmptyState()

    const result = await indexFile(filePath, state)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.files.has(filePath)).toBe(true)
    expect(result.value.totalFiles).toBe(1)
    expect(result.value.tags.has('project')).toBe(true)
    expect(result.value.tags.has('project/alpha')).toBe(true)
    expect(result.value.links.has('beta')).toBe(true)
    const linkEntry = result.value.links.get('beta')
    expect(linkEntry?.sources.has(filePath)).toBe(true)
  })

  it('re-indexes a file — removes stale entries and inserts fresh ones', async () => {
    const filePath = join(tmpDir, 'changing.md')
    await writeFile(filePath, '---\ntags:\n  - old-tag\n---\n\nSee [[old-link]].\n')
    const state = createEmptyState()

    await indexFile(filePath, state)
    expect(state.tags.has('old-tag')).toBe(true)
    expect(state.links.has('old-link')).toBe(true)

    // Update file content
    await writeFile(filePath, '---\ntags:\n  - new-tag\n---\n\nSee [[new-link]].\n')
    const result = await indexFile(filePath, state)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(state.tags.has('old-tag')).toBe(false)
    expect(state.links.has('old-link')).toBe(false)
    expect(state.tags.has('new-tag')).toBe(true)
    expect(state.links.has('new-link')).toBe(true)
    expect(state.totalFiles).toBe(1)
  })

  it('returns err with FILE_NOT_FOUND when file does not exist', async () => {
    const state = createEmptyState()
    const missing = join(tmpDir, 'does-not-exist.md')

    const result = await indexFile(missing, state)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('FILE_NOT_FOUND')
    expect(result.error.message).toContain('File not found')
    expect(result.error.filepath).toBe(resolve(missing))
  })

  it('returns err with PARSE_ERROR when stat fails with non-ENOENT error', async () => {
    // Passing a path inside a regular file triggers ENOTDIR (not ENOENT) from stat
    const state = createEmptyState()
    const result = await indexFile('/etc/hosts/fake.md', state)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PARSE_ERROR')
    expect(result.error.message).toContain('Failed to stat file')
  })

  it('returns the same state reference on success', async () => {
    const filePath = join(tmpDir, 'ref.md')
    await writeFile(filePath, '# ref\n')
    const state = createEmptyState()

    const result = await indexFile(filePath, state)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toBe(state)
  })

  it('returns parse error when file content is invalid YAML', async () => {
    const filePath = join(tmpDir, 'bad-yaml.md')
    // YAML undefined alias reference triggers YAMLException in gray-matter/js-yaml
    await writeFile(filePath, '---\nfoo: *undefined_anchor\n---\nbody\n')
    const state = createEmptyState()

    const result = await indexFile(filePath, state)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PARSE_ERROR')
    expect(result.error.filepath).toBe(resolve(filePath))
  })
})

// ─── removeFile ──────────────────────────────────────────────────────────────

describe('removeFile', () => {
  let tmpDir: string
  let tmpCounter = 0

  beforeEach(async () => {
    tmpCounter++
    tmpDir = join(__dirname, `.tmp-removefile-${tmpCounter}`)
    await mkdir(tmpDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('removes file, its tags, and its links from state', async () => {
    const filePath = join(tmpDir, 'remove-me.md')
    await writeFile(filePath, '---\ntags:\n  - to-remove\n---\n\nSee [[target]].\n')
    const state = createEmptyState()
    await indexFile(filePath, state)

    expect(state.files.has(resolve(filePath))).toBe(true)
    expect(state.tags.has('to-remove')).toBe(true)
    expect(state.links.has('target')).toBe(true)

    removeFile(filePath, state)

    expect(state.files.has(resolve(filePath))).toBe(false)
    expect(state.tags.has('to-remove')).toBe(false)
    expect(state.links.has('target')).toBe(false)
    expect(state.totalFiles).toBe(0)
  })

  it('is a no-op when the file is not in the state', () => {
    const state = createEmptyState()
    const notPresent = join(tmpDir, 'ghost.md')

    // Should not throw and state remains empty
    const returned = removeFile(notPresent, state)
    expect(returned).toBe(state)
    expect(state.files.size).toBe(0)
  })

  it('preserves shared tag entries when only one of two files is removed', async () => {
    const fileA = join(tmpDir, 'a.md')
    const fileB = join(tmpDir, 'b.md')
    await writeFile(fileA, '---\ntags:\n  - shared-tag\n---\n')
    await writeFile(fileB, '---\ntags:\n  - shared-tag\n---\n')

    const state = createEmptyState()
    await indexFile(fileA, state)
    await indexFile(fileB, state)
    expect(state.tags.get('shared-tag')?.files.size).toBe(2)

    removeFile(fileA, state)

    // Tag entry should still exist because fileB still carries it
    expect(state.tags.has('shared-tag')).toBe(true)
    expect(state.tags.get('shared-tag')?.files.size).toBe(1)
    expect(state.tags.get('shared-tag')?.files.has(resolve(fileB))).toBe(true)
  })

  it('preserves shared link entries when only one of two files is removed', async () => {
    const fileA = join(tmpDir, 'c.md')
    const fileB = join(tmpDir, 'd.md')
    await writeFile(fileA, '# A\n\nSee [[shared-target]].\n')
    await writeFile(fileB, '# B\n\nSee [[shared-target]].\n')

    const state = createEmptyState()
    await indexFile(fileA, state)
    await indexFile(fileB, state)

    removeFile(fileA, state)

    expect(state.links.has('shared-target')).toBe(true)
    expect(state.links.get('shared-target')?.sources.has(resolve(fileB))).toBe(true)
  })

  it('returns the same state reference', async () => {
    const filePath = join(tmpDir, 'same-ref.md')
    await writeFile(filePath, '# x\n')
    const state = createEmptyState()
    await indexFile(filePath, state)

    const returned = removeFile(filePath, state)
    expect(returned).toBe(state)
  })
})
