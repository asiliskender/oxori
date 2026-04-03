# Oxori Query Language Reference

The Oxori query language is a simple, human-friendly syntax for searching and filtering files in your vault. Queries match files in an `IndexState` based on frontmatter metadata, tags, file paths, titles, and wikilink relationships. The language supports boolean operators (`AND`, `OR`, `NOT`), grouping with parentheses, and six filter fields.

## Filter Syntax

Filters are the basic building blocks of queries. A filter has the form `field operator value`, where:

- **field** is one of: `tag`, `type`, `path`, `frontmatter`, `title`, or `link`
- **operator** is one of: `:` (contains), `=` (exact match), or `~` (substring/regex)
- **value** is a word, quoted string, or number

The three operators work differently depending on the field:

| Field | Operator | Behavior | Example |
|---|---|---|---|
| `tag` | `=` | Exact tag match (case-insensitive) | `tag=project` matches files with tag `#project` |
| `tag` | `:` | Exact tag match (same as `=` for tags) | `tag:auth` matches `#auth`, `#project/auth`, `#project/auth/oauth` at any level |
| `tag` | `~` | Substring within any tag | `tag~oau` matches `#project/auth/oauth` |
| `type` | `=` | Exact match on frontmatter `type` (case-insensitive) | `type=decision` matches files where frontmatter `type: decision` |
| `type` | `:` | Contains match in frontmatter `type` | `type:dec` matches `type: decision` |
| `type` | `~` | Substring match in frontmatter `type` | `type~cis` matches `type: decision` |
| `path` | `=` | Exact filepath match (case-insensitive) | `path=/vault/auth.md` matches that exact file |
| `path` | `:` | Contains match in filepath | `path:docs` matches any file with `docs` in its path |
| `path` | `~` | Substring match in filepath | `path~auth` matches `/auth.md`, `/oauth-auth.md`, etc. |
| `title` | `=` | Exact filename stem match (case-insensitive) | `title=authentication` matches the file `authentication.md` |
| `title` | `:` | Contains match in filename | `title:auth` matches `authentication.md`, `oauth-auth.md` |
| `title` | `~` | Substring match in filename | `title~auth` matches `authentication.md` |
| `link` | `=` | Exact wikilink target match (case-insensitive) | `link=authentication` matches files linking to `[[authentication]]` |
| `link` | `:` | Exact wikilink target match (same as `=` for links) | `link:setup` matches files linking to `[[setup]]` |
| `link` | `~` | Substring within a wikilink target | `link~auth` matches files linking to any file with `auth` in the stem |
| `frontmatter` | `=` | Exact match against any frontmatter value | `frontmatter=john` matches any file with `"john"` as a value (case-insensitive) |
| `frontmatter` | `:` | Exact match against any frontmatter value (same as `=` for frontmatter) | `frontmatter:wip` matches any file with `status: wip` |
| `frontmatter` | `~` | Substring match against any frontmatter value | `frontmatter~work` matches `status: in-progress` or `name: work-log` |

### Quoted Values

Values containing spaces or special characters must be quoted with double quotes:

```
title:"Quick Start Guide"
frontmatter:"in progress"
```

Without quotes, `title:Quick Start` would be parsed as three separate tokens.

## Boolean Operators

Combine filters using boolean operators (case-insensitive):

- **`AND`** — intersection; both sides must match
- **`OR`** — union; at least one side must match
- **`NOT`** — negation; inverts the result

### Operator Precedence

Operators follow strict precedence (highest to lowest):

1. `NOT` (highest) — applied before any other operator
2. `AND`
3. `OR` (lowest)

This means `tag:auth OR type:note AND status:wip` is parsed as `tag:auth OR (type:note AND status:wip)`.

### Examples

```
tag:auth AND NOT type:draft
```
Matches files tagged with `#auth` that are not in draft status.

```
type:decision OR type:rfc
```
Matches files that are either decisions or requests for comment.

```
path:~/docs AND (tag:project OR tag:learning)
```
Matches files in the docs folder that have either `#project` or `#learning` tags.

## Grouping

Use parentheses `(` and `)` to override operator precedence:

```
(tag:auth OR tag:security) AND type:decision
```

This ensures the `OR` is evaluated before the `AND`, matching files tagged with either `#auth` or `#security` that are decisions.

Grouping is also useful for clarity in complex queries:

```
NOT (path:~/archive AND type:deprecated)
```

## Bare Values

A word without a `field:` prefix is a shorthand for `title:word OR link:word`. This makes simple queries intuitive:

```
authentication
```

This matches files titled "authentication" or files linking to `[[authentication]]`.

Bare values work at any level of precedence and are converted to an implicit `OR`:

```
authentication AND type:decision
```

This is equivalent to `(title:authentication OR link:authentication) AND type:decision`.

## BNF Grammar

The formal grammar for the query language:

```bnf
query       ::= expr | ε
expr        ::= or-expr
or-expr     ::= and-expr ( "OR" and-expr )*
and-expr    ::= not-expr ( "AND" not-expr )*
not-expr    ::= "NOT" not-expr | primary
primary     ::= filter | bare-value | "(" expr ")"

filter      ::= field op value
field       ::= "tag" | "type" | "path" | "frontmatter" | "title" | "link"
op          ::= ":" | "=" | "~"
value       ::= WORD | QUOTED-STRING

bare-value  ::= WORD

WORD        ::= [a-zA-Z0-9_/-]+
QUOTED-STRING ::= '"' [^"]* '"'
```

An empty query (or query containing only whitespace) matches all files.

## Error Messages

The query parser produces structured errors with actionable guidance:

### `QUERY_PARSE_ERROR`

Raised when the query syntax is invalid.

**Common causes:**
- Unbalanced parentheses: `(tag:auth AND type:note`
- Stray closing parenthesis: `tag:auth) AND type:note`
- Missing operator: `tag:auth type:note` (needs `AND` or `OR`)

**Example error:**
```
QUERY_PARSE_ERROR: Expected RPAREN at position 24, got EOF ("").
Action: Check the query syntax and ensure parentheses are balanced.
```

### `QUERY_UNKNOWN_FIELD`

Raised when a filter uses an unknown field name.

**Example:**
```
status:wip
```

Would raise:
```
QUERY_UNKNOWN_FIELD: Unknown filter field "status" at position 0. Did you mean "type"?
Action: Valid fields are: tag, type, path, frontmatter, title, link.
```

## Examples

### 1. Simple Tag Filter

```
tag:decision
```

Matches all files tagged with `#decision` (including `#project/decision`).

### 2. Compound AND Query

```
type:decision AND tag:architecture
```

Matches files that are both decisions AND tagged with `#architecture`. Useful for finding architectural decision records.

### 3. OR with Grouping

```
tag:urgent OR (tag:backlog AND NOT type:wip)
```

Matches files tagged `#urgent`, or files tagged `#backlog` that are not work-in-progress.

### 4. NOT Exclusion

```
NOT type:draft
```

Matches all files except drafts. Useful for published-only results.

### 5. Frontmatter Value Search

```
frontmatter:john AND type:rfc
```

Matches RFCs where "john" appears as any frontmatter value (e.g., `author: john`, `reviewer: john`).

### 6. Graph-Aware Query

```
link:authentication AND type:decision
```

Matches decision files that link to the `[[authentication]]` file. Useful for finding all decisions that reference a key module or concept.

### 7. Path-Based Filtering

```
path:~/src AND NOT tag:deprecated
```

Matches files in the `src/` subdirectory that are not deprecated. Useful for focusing on active implementation docs.

### 8. Bare Value with Boolean

```
oauth AND NOT draft
```

Matches files with "oauth" in the title or linking to `[[oauth]]`, excluding drafts. The bare `draft` becomes `title:draft OR link:draft`.

## Evaluation Semantics

### Case Sensitivity

All field values and operators are case-insensitive. `TAG:auth` and `tag:AUTH` match files with `#Auth`, `#AUTH`, or `#auth`.

### Empty Query

An empty query string (or one containing only whitespace) returns all files in the vault.

```
// Both return all files
evaluate(tokenize(""), state)
evaluate(tokenize("   "), state)
```

### Tag Hierarchy

Tags are expanded to all ancestor levels during parsing. A file with `#project/auth/oauth` is indexed under three tags: `"project"`, `"project/auth"`, and `"project/auth/oauth"`. A query for `tag:project` matches all three descendants.

### Wikilinks

Wikilinks are stored as lowercase filename stems (no `.md` extension). `[[Authentication]]` and `[[authentication]]` both resolve to `"authentication"`. Queries for `link:authentication` match both.

### Filter Operator Consistency

- `=` always performs **exact** case-insensitive match
- `:` performs **contains** match (exact for tags and links, substring for other fields)
- `~` performs **substring** match (character-by-character, case-insensitive)

## Performance

The query engine evaluates queries by filtering the in-memory index cache. All queries complete in **< 100ms** on typical vaults (< 10,000 files). Queries with `NOT` may be slower because they require a full scan and complement operation.

## Tokenizer and Parser

The query language is tokenized and parsed in two stages:

1. **Tokenizer** (`tokenize(query)`) — converts the raw query string into a flat array of tokens (FILTER, VALUE, OPERATOR, LPAREN, RPAREN, EOF).
2. **Parser** (`parse(tokens)`) — converts the token array into a typed `QueryAST` using recursive descent with operator precedence.
3. **Evaluator** (`evaluate(ast, state)`) — walks the AST and matches it against `FileEntry` objects in the index.

Callers should wrap these functions in a `try/catch` to handle `OxoriError` exceptions with `code` values like `"QUERY_PARSE_ERROR"` or `"QUERY_UNKNOWN_FIELD"`.

```typescript
import { tokenize, parse, evaluate } from "@oxori/oxori";

try {
  const tokens = tokenize("tag:decision AND type:rfc");
  const ast = parse(tokens);
  const result = evaluate(ast, state);
  console.log(`Matched ${result.totalMatched} files in ${result.executionMs}ms`);
} catch (err) {
  console.error(`Query failed: ${err.code} - ${err.message}`);
}
```
