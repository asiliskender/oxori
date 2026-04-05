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

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { parseFile, expandTagHierarchy, extractWikilinks, extractTags, extractTypedRelations } from '../src/parser'

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
    it('returns err with FILE_NOT_FOUND when file does not exist', async () => {
      const missing = '/no/such/oxori-test-file.md'
      const result = await parseFile(missing)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('FILE_NOT_FOUND')
      expect(result.error.message).toContain('File not found')
    })

    it('includes filepath in the error object', async () => {
      const missing = '/no/such/oxori-test-file.md'
      const result = await parseFile(missing)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.filepath).toBe(resolve(missing))
    })

    it('returns err with PARSE_ERROR when read fails with non-ENOENT error', async () => {
      // Passing a path inside a regular file triggers ENOTDIR (not ENOENT) from readFile
      const result = await parseFile('/etc/hosts/fake.md')
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.code).toBe('PARSE_ERROR')
      expect(result.error.message).toContain('Failed to read file')
    })

    it('returns err with PARSE_ERROR for malformed YAML frontmatter', async () => {
      // YAML undefined alias reference triggers YAMLException in gray-matter/js-yaml
      const tmpDir = join(__dirname, '.tmp-parser-yaml-err')
      await mkdir(tmpDir, { recursive: true })
      const filePath = join(tmpDir, 'bad-yaml.md')
      await writeFile(filePath, '---\nfoo: *undefined_anchor\n---\nbody\n')

      try {
        const result = await parseFile(filePath)
        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.error.code).toBe('PARSE_ERROR')
        expect(result.error.message).toContain('YAML parse error')
        expect(result.error.filepath).toBe(filePath)
      } finally {
        await rm(tmpDir, { recursive: true, force: true })
      }
    })
  })
})

// ─── expandTagHierarchy ───────────────────────────────────────────────────────

describe('expandTagHierarchy', () => {
  it('returns a single-element array for a flat tag', () => {
    expect(expandTagHierarchy('project')).toEqual(['project'])
  })

  it('expands a two-level tag to two entries', () => {
    expect(expandTagHierarchy('project/auth')).toEqual(['project', 'project/auth'])
  })

  it('expands a three-level tag to three entries', () => {
    expect(expandTagHierarchy('project/auth/oauth')).toEqual([
      'project',
      'project/auth',
      'project/auth/oauth',
    ])
  })
})

// ─── extractWikilinks ────────────────────────────────────────────────────────

describe('extractWikilinks', () => {
  it('extracts a plain wikilink', () => {
    expect(extractWikilinks('See [[target]].')).toEqual(['target'])
  })

  it('handles aliased wikilinks — returns only the target, not the alias', () => {
    expect(extractWikilinks('See [[real-file|Display Text]].')).toEqual(['real-file'])
  })

  it('strips .md extension from wikilink targets', () => {
    expect(extractWikilinks('See [[note.md]] here.')).toEqual(['note'])
  })

  it('normalizes targets to lowercase', () => {
    expect(extractWikilinks('See [[NOTE-ONE]] here.')).toEqual(['note-one'])
  })

  it('returns multiple targets from a string with many wikilinks', () => {
    const result = extractWikilinks('[[alpha]] and [[beta]] and [[gamma]]')
    expect(result).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('returns an empty array when there are no wikilinks', () => {
    expect(extractWikilinks('No links here.')).toEqual([])
  })

  it('handles wikilinks with spaces trimmed', () => {
    const result = extractWikilinks('[[ spaced ]]')
    expect(result).toEqual(['spaced'])
  })
})

// ─── extractTags ─────────────────────────────────────────────────────────────

describe('extractTags', () => {
  it('reads tags from body inline #tags', () => {
    const tags = extractTags('Hello #foo and #bar here.', {})
    expect(tags.has('foo')).toBe(true)
    expect(tags.has('bar')).toBe(true)
  })

  it('reads tags from frontmatter tags array', () => {
    const tags = extractTags('', { tags: ['project/alpha', 'status/active'] })
    expect(tags.has('project/alpha')).toBe(true)
    expect(tags.has('status/active')).toBe(true)
  })

  it('reads a single-string frontmatter tag', () => {
    const tags = extractTags('', { tags: 'single-tag' })
    expect(tags.has('single-tag')).toBe(true)
  })

  it('silently skips non-string items in frontmatter tags array', () => {
    const tags = extractTags('', { tags: ['valid-tag', 42, null, true, 'another'] })
    expect(tags.has('valid-tag')).toBe(true)
    expect(tags.has('another')).toBe(true)
    // Numeric/null/boolean tags must not appear
    expect([...tags].some((t) => t === '42' || t === 'null' || t === 'true')).toBe(false)
  })

  it('returns empty Set when tags is null in frontmatter', () => {
    const tags = extractTags('', { tags: null })
    // null is not Array, not string → no tags added from frontmatter
    expect(tags.size).toBe(0)
  })

  it('returns empty Set for a file with no tags and no body tags', () => {
    const tags = extractTags('No tags here.', {})
    expect(tags.size).toBe(0)
  })

  it('deduplicates via ancestor expansion', () => {
    // 'project/alpha' and 'project/alpha/planning' both expand to include 'project'
    const tags = extractTags('', { tags: ['project/alpha', 'project/alpha/planning'] })
    const arr = [...tags]
    expect(arr.filter((t) => t === 'project').length).toBe(1)
  })
})

// ─── extractTypedRelations ───────────────────────────────────────────────────

describe('extractTypedRelations', () => {
  it('extracts a single wikilink string value as a typed relation', () => {
    const rel = extractTypedRelations({ depends_on: '[[other-file]]' })
    expect(rel.has('depends_on')).toBe(true)
    expect(rel.get('depends_on')).toContain('other-file')
  })

  it('extracts wikilinks from an array frontmatter value', () => {
    const rel = extractTypedRelations({ related_to: ['[[file-a]]', '[[file-b]]'] })
    expect(rel.get('related_to')).toContain('file-a')
    expect(rel.get('related_to')).toContain('file-b')
  })

  it('ignores frontmatter values with no wikilinks', () => {
    const rel = extractTypedRelations({ title: 'My Note', count: 42, enabled: true })
    expect(rel.size).toBe(0)
  })

  it('skips non-string array items when extracting wikilinks', () => {
    const rel = extractTypedRelations({ relates_to: ['[[valid]]', 99, null] })
    expect(rel.get('relates_to')).toEqual(['valid'])
  })

  it('returns an empty Map for an empty frontmatter', () => {
    expect(extractTypedRelations({}).size).toBe(0)
  })
})
