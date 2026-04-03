/**
 * @file parser.test.ts
 * @description Unit tests for the parseFile() function.
 *
 * Tests are written against fixtures in tests/fixtures/basic-vault/ and
 * tests/fixtures/linked-vault/. The parser implementation lives in src/parser.ts
 * (authored by Tron). Tests marked it.todo() need implementation details that
 * cannot be known before the parser is written.
 *
 * Run: pnpm test:coverage
 */

import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { parseFile } from '../src/parser'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BASIC_VAULT = join(__dirname, 'fixtures/basic-vault')
const LINKED_VAULT = join(__dirname, 'fixtures/linked-vault')

describe('parseFile', () => {
  // ---------------------------------------------------------------------------
  // Frontmatter extraction
  // ---------------------------------------------------------------------------
  describe('frontmatter extraction', () => {
    it('extracts frontmatter fields into a plain object', async () => {
      const result = await parseFile(join(BASIC_VAULT, 'overview.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.value.frontmatter['title']).toBe('Project Overview')
      expect(result.value.frontmatter['type']).toBe('note')
      expect(result.value.frontmatter['author']).toBe('human')
      // frontmatter is a plain Record — no prototype methods
      expect(Object.getPrototypeOf(result.value.frontmatter)).toBe(Object.prototype)
    })

    it('returns the correct filename stem', async () => {
      const result = await parseFile(join(BASIC_VAULT, 'overview.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.filename).toBe('overview')
    })

    it('returns the normalised absolute filepath', async () => {
      const filePath = join(BASIC_VAULT, 'overview.md')
      const result = await parseFile(filePath)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.filepath).toBe(filePath)
    })

    it('handles file with no frontmatter — returns empty object', async () => {
      const result = await parseFile(join(BASIC_VAULT, 'no-frontmatter.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.frontmatter).toEqual({})
    })

    it('handles empty file — returns valid ParsedFile with empty collections', async () => {
      const result = await parseFile(join(BASIC_VAULT, 'empty.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.frontmatter).toEqual({})
      expect(result.value.tags.size).toBe(0)
      expect(result.value.wikilinks.size).toBe(0)
      expect(result.value.typedRelations.size).toBe(0)
      expect(result.value.body.trim()).toBe('')
    })

    it.todo(
      'handles malformed YAML frontmatter — throws descriptive error with code PARSE_ERROR',
    )
  })

  // ---------------------------------------------------------------------------
  // Tag extraction
  // ---------------------------------------------------------------------------
  describe('tag extraction', () => {
    it('finds simple tags in body', async () => {
      // no-frontmatter.md body contains: #project/beta and #status/pending
      const result = await parseFile(join(BASIC_VAULT, 'no-frontmatter.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      // After expansion project/beta → ['project', 'project/beta']
      //                   status/pending → ['status', 'status/pending']
      expect(result.value.tags.has('project/beta')).toBe(true)
      expect(result.value.tags.has('status/pending')).toBe(true)
    })

    it('expands hierarchical tags to all ancestor levels', async () => {
      // overview.md has tags: project/alpha, project/alpha/planning, status/active
      // project/alpha/planning → 'project', 'project/alpha', 'project/alpha/planning'
      const result = await parseFile(join(BASIC_VAULT, 'overview.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.tags.has('project')).toBe(true)
      expect(result.value.tags.has('project/alpha')).toBe(true)
      expect(result.value.tags.has('project/alpha/planning')).toBe(true)
      expect(result.value.tags.has('status')).toBe(true)
      expect(result.value.tags.has('status/active')).toBe(true)
    })

    it('finds tags in frontmatter tag arrays', async () => {
      // prerequisite.md has tags: [project/alpha/planning, status/active]
      const result = await parseFile(join(BASIC_VAULT, 'prerequisite.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.tags.has('project/alpha/planning')).toBe(true)
      expect(result.value.tags.has('status/active')).toBe(true)
    })

    it('deduplicates tags', async () => {
      // overview.md has both project/alpha and project/alpha/planning in frontmatter.
      // Both expand to include the ancestor 'project' — it must appear only once.
      const result = await parseFile(join(BASIC_VAULT, 'overview.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const tagArray = [...result.value.tags]
      const projectCount = tagArray.filter((t) => t === 'project').length
      expect(projectCount).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Wikilink extraction
  // ---------------------------------------------------------------------------
  describe('wikilink extraction', () => {
    it('finds [[wikilinks]] in body', async () => {
      // overview.md body contains [[note-one]], [[NOTE-ONE]], [[note-two]], [[prerequisite]]
      const result = await parseFile(join(BASIC_VAULT, 'overview.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.wikilinks.has('note-two')).toBe(true)
      expect(result.value.wikilinks.has('prerequisite')).toBe(true)
    })

    it('stores only filename stem without extension', async () => {
      const result = await parseFile(join(BASIC_VAULT, 'note-one.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      // Every wikilink stored in the Set must not carry an .md extension
      for (const link of result.value.wikilinks) {
        expect(link).not.toMatch(/\.md$/)
      }
    })

    it('normalizes wikilinks to lowercase', async () => {
      // overview.md body contains both [[note-one]] and [[NOTE-ONE]]
      // both should resolve to the single lowercase key 'note-one'
      const result = await parseFile(join(BASIC_VAULT, 'overview.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.wikilinks.has('note-one')).toBe(true)
      // The uppercase variant must NOT be stored separately
      expect(result.value.wikilinks.has('NOTE-ONE')).toBe(false)
    })

    it('deduplicates wikilinks', async () => {
      // note-one.md body links [[overview]] twice — only one entry in the Set
      const result = await parseFile(join(BASIC_VAULT, 'note-one.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const links = [...result.value.wikilinks]
      const overviewCount = links.filter((l) => l === 'overview').length
      expect(overviewCount).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // Typed relations
  // ---------------------------------------------------------------------------
  describe('typed relations', () => {
    it('identifies frontmatter keys with [[wikilink]] values as typed relations', async () => {
      // note-two.md: depends_on: "[[prerequisite]]", blocks: "[[note-one]]"
      const result = await parseFile(join(BASIC_VAULT, 'note-two.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.typedRelations.has('depends_on')).toBe(true)
      expect(result.value.typedRelations.has('blocks')).toBe(true)
      expect(result.value.typedRelations.get('depends_on')).toContain('prerequisite')
      expect(result.value.typedRelations.get('blocks')).toContain('note-one')
    })

    it('supports multiple targets per relation type', async () => {
      // node-f.md: related_to: ["[[node-e]]", "[[node-c]]"]
      const result = await parseFile(join(LINKED_VAULT, 'node-f.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const targets = result.value.typedRelations.get('related_to') ?? []
      expect(targets).toContain('node-e')
      expect(targets).toContain('node-c')
      expect(targets.length).toBe(2)
    })

    it('typed relations do not appear in the wikilinks Set', async () => {
      // note-two.md has NO wikilinks in body — only typed-relation frontmatter
      // 'prerequisite' and 'note-one' must NOT appear in the wikilinks Set
      const result = await parseFile(join(BASIC_VAULT, 'note-two.md'))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.wikilinks.has('prerequisite')).toBe(false)
      expect(result.value.wikilinks.has('note-one')).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('error handling', () => {
    it.todo(
      'throws with action suggestion if file does not exist',
      // Expected: parseFile('/no/such/file.md') rejects with an OxoriError
      // carrying a non-empty `action` string like "Check the file path and try again."
    )

    it.todo(
      'includes filepath in error message',
      // Expected: the rejected error object has filepath === the path passed in
    )
  })
})
