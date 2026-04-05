/**
 * @file query.ts
 * @description Tokenizer and recursive-descent parser for the Oxori query language.
 *
 * The query language supports:
 * - Filter atoms:  `field:value`, `field=value`, `field~value`
 * - Boolean logic: `AND`, `OR`, `NOT` (case-insensitive)
 * - Grouping:      `(` … `)` parentheses
 * - Quoted values: `"multi word value"`
 * - Bare words:    shorthand for `title:word OR link:word`
 *
 * Operator precedence (highest to lowest):
 *   1. `NOT`  (unary prefix)
 *   2. `AND`  (binary infix)
 *   3. `OR`   (binary infix)
 *
 * @remarks
 * The evaluator (`evaluate()`) is intentionally absent — it ships in Wave 2.
 * This module only transforms a raw query string into a typed AST.
 *
 * All exported functions throw on unrecoverable parse errors. Callers should
 * wrap invocations in a `try/catch` and handle the thrown `OxoriError` value.
 */

import type {
  OxoriError,
  Token,
  TokenKind,
  QueryAST,
  QueryNode,
  FilterNode,
  OperatorNode,
  GroupNode,
  FileEntry,
  QueryResult,
  IndexState,
} from "./types.js";
import { FILTER_FIELDS } from "./types.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds and throws a structured `OxoriError`.
 * TypeScript's `never` return type lets callers use this in expression position.
 */
function raise(error: OxoriError): never {
  throw error;
}

/**
 * Returns the closest match from `FILTER_FIELDS` to the given unknown field
 * name, using a simple character-overlap heuristic. Used for error suggestions.
 */
function closestField(unknown: string): string {
  const lower = unknown.toLowerCase();
  let best = FILTER_FIELDS[0] as string;
  let bestScore = 0;
  for (const field of FILTER_FIELDS) {
    let score = 0;
    for (const ch of lower) {
      if (field.includes(ch)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = field;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// splitFilterToken
// ---------------------------------------------------------------------------

/**
 * Splits a raw FILTER token value (e.g. `"tag:zettel"`, `"path~docs"`) into
 * its constituent parts.
 *
 * @param raw - The full `field:value`, `field=value`, or `field~value` string
 *   as it appears in the token stream.
 * @returns An object with `field`, `operator`, and `value` extracted from `raw`.
 *
 * @throws {@link OxoriError} with code `"QUERY_PARSE_ERROR"` when `raw` has no
 *   recognisable operator separator.
 *
 * @example
 * splitFilterToken("tag:zettel")  // { field: "tag", operator: ":", value: "zettel" }
 * splitFilterToken("path~docs")   // { field: "path", operator: "~", value: "docs" }
 * splitFilterToken('title="My Note"') // { field: "title", operator: "=", value: "My Note" }
 */
function splitFilterToken(raw: string): {
  field: string;
  operator: "=" | ":" | "~";
  value: string;
} {
  // Locate the first occurrence of any operator character
  const idx = raw.search(/[:=~]/);
  if (idx === -1) {
    raise({
      code: "QUERY_PARSE_ERROR",
      message: `Filter token "${raw}" has no operator (":", "=", or "~").`,
      action: `Write filter tokens as field:value, field=value, or field~value.`,
    });
  }
  const opChar = raw[idx] as string;
  if (opChar !== ":" && opChar !== "=" && opChar !== "~") {
    raise({
      code: "QUERY_PARSE_ERROR",
      message: `Filter token "${raw}" contains an unrecognised operator "${opChar}".`,
      action: `Use ":", "=", or "~" as the operator.`,
    });
  }
  return {
    field: raw.slice(0, idx),
    operator: opChar,
    value: raw.slice(idx + 1),
  };
}

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

/** Operator keyword set (lowercase for case-insensitive matching). */
const OPERATOR_KEYWORDS = new Set(["and", "or", "not"]);

/**
 * @brief Tokenizes a raw query string into a flat array of {@link Token} objects.
 *
 * @remarks
 * Rules applied in order:
 * 1. Whitespace is skipped.
 * 2. `(` → `LPAREN`, `)` → `RPAREN`.
 * 3. A double-quoted string → `VALUE` token (quotes stripped from `value`).
 * 4. A `word` containing `:`, `=`, or `~` → `FILTER` token (full `field:value` string).
 * 5. `AND`, `OR`, `NOT` (case-insensitive) → `OPERATOR` token.
 * 6. Any other bare word → `VALUE` token.
 * 7. An `EOF` sentinel is appended after all input is consumed.
 *
 * The tokenizer is purely syntactic — it does **not** validate field names.
 * Field validation happens in {@link parse}.
 *
 * @param query - The raw query string entered by the user or agent.
 * @returns A `Token[]` array ending with an `EOF` token.
 *
 * @example
 * tokenize("tag:auth AND type:note")
 * // [
 * //   { kind: "FILTER",   value: "tag:auth",   position: 0  },
 * //   { kind: "OPERATOR", value: "AND",         position: 9  },
 * //   { kind: "FILTER",   value: "type:note",   position: 13 },
 * //   { kind: "EOF",      value: "",            position: 22 },
 * // ]
 *
 * @since 0.2.0
 */
export function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < query.length) {
    // Skip whitespace
    if (/\s/.test(query[pos] ?? "")) {
      pos++;
      continue;
    }

    const start = pos;
    const ch = query[pos] ?? "";

    // LPAREN / RPAREN
    if (ch === "(") {
      tokens.push({ kind: "LPAREN", value: "(", position: start });
      pos++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "RPAREN", value: ")", position: start });
      pos++;
      continue;
    }

    // Quoted string → VALUE
    if (ch === '"') {
      pos++; // skip opening quote
      let content = "";
      while (pos < query.length && query[pos] !== '"') {
        content += query[pos];
        pos++;
      }
      pos++; // skip closing quote (or advance past end if unterminated)
      tokens.push({ kind: "VALUE", value: content, position: start });
      continue;
    }

    // Bare word — collect until whitespace or paren
    let word = "";
    while (pos < query.length && !/[\s()]/.test(query[pos] ?? "")) {
      word += query[pos];
      pos++;
    }

    if (word.length === 0) {
      // Should never happen given the guards above, but be defensive
      pos++;
      continue;
    }

    // FILTER token: word contains an operator character (:, =, ~)
    if (/[:=~]/.test(word)) {
      tokens.push({ kind: "FILTER", value: word, position: start });
      continue;
    }

    // OPERATOR: AND / OR / NOT (case-insensitive)
    if (OPERATOR_KEYWORDS.has(word.toLowerCase())) {
      tokens.push({
        kind: "OPERATOR",
        value: word.toUpperCase(),
        position: start,
      });
      continue;
    }

    // Bare VALUE
    tokens.push({ kind: "VALUE", value: word, position: start });
  }

  tokens.push({ kind: "EOF", value: "", position: pos });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser — recursive descent
// ---------------------------------------------------------------------------

/**
 * Internal stateful cursor over a `Token[]` array.
 * Encapsulates look-ahead and consumption logic for the recursive-descent parser.
 */
class TokenCursor {
  private readonly tokens: Token[];
  private index: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /** Returns the current token without advancing the cursor. */
  peek(): Token {
    return this.tokens[this.index] ?? { kind: "EOF", value: "", position: 0 };
  }

  /** Advances the cursor and returns the token that was consumed. */
  consume(): Token {
    const t = this.peek();
    if (t.kind !== "EOF") this.index++;
    return t;
  }

  /** Consumes the current token and returns it; throws if the kind does not match. */
  expect(kind: TokenKind): Token {
    const t = this.peek();
    if (t.kind !== kind) {
      raise({
        code: "QUERY_PARSE_ERROR",
        message: `Expected ${kind} at position ${t.position}, got ${t.kind} ("${t.value}").`,
        action: `Check the query syntax and ensure parentheses are balanced.`,
      });
    }
    return this.consume();
  }

  /** Returns true when the current token is an OPERATOR with the given value. */
  isOperator(value: string): boolean {
    const t = this.peek();
    return t.kind === "OPERATOR" && t.value === value;
  }
}

// ---------------------------------------------------------------------------
// Grammar (recursive descent):
//
//   expression  = orExpr
//   orExpr      = andExpr  ( "OR"  andExpr  )*
//   andExpr     = notExpr  ( "AND" notExpr  )*
//   notExpr     = "NOT" notExpr | primary
//   primary     = "(" expression ")" | FILTER | VALUE
// ---------------------------------------------------------------------------

/**
 * Converts a bare `VALUE` token into an implicit `OR` over `title:` and `link:`.
 */
function bareValueToNode(token: Token): QueryNode {
  const titleNode: FilterNode = {
    type: "filter",
    field: "title",
    operator: ":",
    value: token.value,
  };
  const linkNode: FilterNode = {
    type: "filter",
    field: "link",
    operator: ":",
    value: token.value,
  };
  const orNode: OperatorNode = {
    type: "or",
    children: [titleNode, linkNode],
  };
  return orNode;
}

/** Parses a `FILTER` token into a validated `FilterNode`. */
function parseFilterToken(token: Token): FilterNode {
  const { field, operator, value } = splitFilterToken(token.value);

  // Validate field name against FILTER_FIELDS
  const knownField = (FILTER_FIELDS as readonly string[]).includes(field);
  if (!knownField) {
    const suggestion = closestField(field);
    raise({
      code: "QUERY_UNKNOWN_FIELD",
      message: `Unknown filter field "${field}" at position ${token.position}. Did you mean "${suggestion}"?`,
      action: `Valid fields are: ${FILTER_FIELDS.join(", ")}.`,
    });
  }

  return { type: "filter", field, operator, value };
}

function parsePrimary(cursor: TokenCursor): QueryNode {
  const token = cursor.peek();

  if (token.kind === "LPAREN") {
    cursor.consume(); // consume "("
    const child = parseOr(cursor);
    cursor.expect("RPAREN"); // consume ")" — throws if missing
    const group: GroupNode = { type: "group", child };
    return group;
  }

  if (token.kind === "FILTER") {
    cursor.consume();
    return parseFilterToken(token);
  }

  if (token.kind === "VALUE") {
    cursor.consume();
    return bareValueToNode(token);
  }

  // Unexpected token — could be EOF mid-expression or a stray RPAREN
  raise({
    code: "QUERY_PARSE_ERROR",
    message: `Unexpected token "${token.value}" (${token.kind}) at position ${token.position}.`,
    action: `Check that parentheses are balanced and all operators have operands.`,
  });
}

function parseNot(cursor: TokenCursor): QueryNode {
  if (cursor.isOperator("NOT")) {
    cursor.consume(); // consume "NOT"
    const operand = parseNot(cursor); // right-recursive for chained NOTs
    const notNode: OperatorNode = { type: "not", children: [operand] };
    return notNode;
  }
  return parsePrimary(cursor);
}

function parseAnd(cursor: TokenCursor): QueryNode {
  let left = parseNot(cursor);

  while (cursor.isOperator("AND")) {
    cursor.consume(); // consume "AND"
    const right = parseNot(cursor);
    const andNode: OperatorNode = { type: "and", children: [left, right] };
    left = andNode;
  }

  return left;
}

function parseOr(cursor: TokenCursor): QueryNode {
  let left = parseAnd(cursor);

  while (cursor.isOperator("OR")) {
    cursor.consume(); // consume "OR"
    const right = parseAnd(cursor);
    const orNode: OperatorNode = { type: "or", children: [left, right] };
    left = orNode;
  }

  return left;
}

// ---------------------------------------------------------------------------
// parse
// ---------------------------------------------------------------------------

/**
 * @brief Parses a flat `Token[]` array into a typed {@link QueryAST}.
 *
 * Parses a flat `Token[]` array (produced by {@link tokenize}) into a
 * typed {@link QueryAST}.
 *
 * @remarks
 * The parser uses recursive descent with the following operator precedence
 * (highest to lowest): `NOT` → `AND` → `OR`. Parentheses override precedence
 * and are preserved in the AST as {@link GroupNode} objects.
 *
 * Field validation is performed here: any `FILTER` token whose field name is
 * not in {@link FILTER_FIELDS} causes an `OxoriError` with code
 * `"QUERY_UNKNOWN_FIELD"` to be thrown, including a did-you-mean suggestion.
 *
 * An unbalanced closing parenthesis (extra `)`) throws `"QUERY_PARSE_ERROR"`.
 * A missing closing parenthesis is detected when `expect("RPAREN")` fails after
 * a grouped sub-expression.
 *
 * @param tokens - The token array returned by {@link tokenize}.
 * @returns A {@link QueryAST} with `root: null` for the empty query (match all).
 *
 * @throws {@link OxoriError} with code `"QUERY_PARSE_ERROR"` for syntax errors.
 * @throws {@link OxoriError} with code `"QUERY_UNKNOWN_FIELD"` for unrecognised filter fields.
 *
 * @example
 * const tokens = tokenize('tag:auth AND (type:decision OR path:~/docs)');
 * const ast = parse(tokens);
 * // ast.root.type === "and"
 * // ast.root.children[0] → FilterNode { field: "tag", operator: ":", value: "auth" }
 * // ast.root.children[1] → GroupNode { child: OperatorNode { type: "or", ... } }
 *
 * @example
 * parse(tokenize("")) // { root: null }
 *
 * @since 0.2.0
 */
export function parse(tokens: Token[]): QueryAST {
  const cursor = new TokenCursor(tokens);

  // Empty query (only EOF token)
  if (cursor.peek().kind === "EOF") {
    return { root: null };
  }

  const root = parseOr(cursor);

  // After a complete expression, the next token must be EOF (or we have a stray token)
  const remaining = cursor.peek();
  if (remaining.kind !== "EOF") {
    // A stray RPAREN is the most common cause
    raise({
      code: "QUERY_PARSE_ERROR",
      message: `Unexpected token "${remaining.value}" (${remaining.kind}) at position ${remaining.position}. Parentheses may be unbalanced.`,
      action: `Ensure every "(" has a matching ")".`,
    });
  }

  return { root };
}

// ---------------------------------------------------------------------------
// Evaluator — internal helpers
// ---------------------------------------------------------------------------

/**
 * Tests a single `FilterNode` against a `FileEntry`. Returns `true` when the
 * file satisfies the field/operator/value constraint.
 */
function matchFilter(file: FileEntry, node: FilterNode): boolean {
  const { field, operator, value } = node;
  const lowerValue = value.toLowerCase();

  switch (field) {
    case "tag": {
      // "=" and ":" → exact case-insensitive membership; "~" → substring in any tag
      for (const tag of file.tags) {
        const lowerTag = tag.toLowerCase();
        if (operator === "~") {
          if (lowerTag.includes(lowerValue)) return true;
        } else {
          if (lowerTag === lowerValue) return true;
        }
      }
      return false;
    }

    case "type": {
      const fmType = file.frontmatter["type"];
      if (typeof fmType !== "string") return false;
      const lowerType = fmType.toLowerCase();
      if (operator === "=") return lowerType === lowerValue;
      // ":" and "~" → contains
      return lowerType.includes(lowerValue);
    }

    case "path": {
      const lowerPath = file.filepath.toLowerCase();
      if (operator === "=") return lowerPath === lowerValue;
      // ":" and "~" → contains
      return lowerPath.includes(lowerValue);
    }

    case "title": {
      const lowerTitle = file.filename.toLowerCase();
      if (operator === "=") return lowerTitle === lowerValue;
      // ":" and "~" → contains
      return lowerTitle.includes(lowerValue);
    }

    case "link": {
      // wikilinks are stored as lowercase stems
      if (operator === "~") {
        for (const link of file.wikilinks) {
          if (link.includes(lowerValue)) return true;
        }
        return false;
      }
      // "=" and ":" → exact match on the lowercase stem
      return file.wikilinks.has(lowerValue);
    }

    case "frontmatter": {
      // Search across all frontmatter values for any that match
      for (const fmVal of Object.values(file.frontmatter)) {
        const strVal =
          typeof fmVal === "string" ? fmVal.toLowerCase() : String(fmVal).toLowerCase();
        if (operator === "~" && strVal.includes(lowerValue)) return true;
        if ((operator === "=" || operator === ":") && strVal === lowerValue) return true;
      }
      return false;
    }

    default:
      return false;
  }
}

/**
 * Recursively evaluates a `QueryNode` against a single `FileEntry`.
 * Returns `true` when the file satisfies the node's constraint.
 */
function matchNode(file: FileEntry, node: QueryNode, state: IndexState): boolean {
  switch (node.type) {
    case "filter":
      return matchFilter(file, node);

    case "and":
      return node.children.every((child) => matchNode(file, child, state));

    case "or":
      return node.children.some((child) => matchNode(file, child, state));

    case "not": {
      const child = node.children[0];
      if (child === undefined) return false;
      return !matchNode(file, child, state);
    }

    case "group":
      return matchNode(file, node.child, state);
  }
}

// ---------------------------------------------------------------------------
// evaluate
// ---------------------------------------------------------------------------

/**
 * @brief Evaluates a parsed {@link QueryAST} against a vault {@link IndexState}.
 *
 * Evaluates a parsed {@link QueryAST} against a vault {@link IndexState}.
 *
 * @remarks
 * A `null` root (empty query) short-circuits to a match of every file in the
 * state — equivalent to "return all". The result set is built fresh on each
 * call; callers should cache results if they need repeated access.
 *
 * Operator semantics:
 * - `AND` — intersection (all children must match)
 * - `OR`  — union (at least one child must match)
 * - `NOT` — complement relative to all files in the state
 * - `GroupNode` — transparent; evaluates its single child
 *
 * Filter operator semantics:
 * - `=`  exact case-insensitive match
 * - `:`  contains / prefix (same as `~` for most fields; exact for `tag` and `link`)
 * - `~`  case-insensitive substring match
 *
 * @param ast - Parsed query tree produced by {@link parse}.
 * @param state - The current in-memory vault index.
 * @returns A {@link QueryResult} containing the matching file paths, a count,
 *   and the wall-clock evaluation duration in milliseconds.
 *
 * @example
 *   const tokens = tokenize("tag:auth AND type:decision");
 *   const ast = parse(tokens);
 *   const result = evaluate(ast, state);
 *   console.log(result.totalMatched); // number of matching files
 *
 * @since 0.2.0
 */
export function evaluate(ast: QueryAST, state: IndexState): QueryResult {
  const startMs = Date.now();

  if (state.files.size === 0) {
    return { matches: new Set<string>(), totalMatched: 0, executionMs: 0 };
  }

  // Empty query — match everything
  if (ast.root === null) {
    const allPaths = new Set(state.files.keys());
    return {
      matches: allPaths,
      totalMatched: allPaths.size,
      executionMs: Date.now() - startMs,
    };
  }

  const matches = new Set<string>();
  for (const [filepath, file] of state.files) {
    if (matchNode(file, ast.root, state)) {
      matches.add(filepath);
    }
  }

  return {
    matches,
    totalMatched: matches.size,
    executionMs: Date.now() - startMs,
  };
}
