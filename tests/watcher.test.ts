/**
 * @file watcher.test.ts
 * @description Unit + integration tests for the watch() function — Phase 3.
 *
 * Tests are written against fixtures in tests/fixtures/ and will test the file
 * system watcher implementation in src/watcher.ts. Most tests use it.todo()
 * because the watcher implementation is pending.
 *
 * Run: pnpm test:coverage
 */

import { describe, it, expect } from "vitest";

describe("watch()", () => {
  it.todo("emits change event when a markdown file is created");
  it.todo("emits change event when a markdown file is modified");
  it.todo("emits change event when a markdown file is deleted");
  it.todo("does not emit change for non-markdown files");
  it.todo("stop() closes the watcher cleanly");
  it.todo("emits error event on invalid vault path");
  it.todo("type field on WatchEvent is correct for create/modify/delete");
  it.todo("path field on WatchEvent is absolute path");
  it.todo("handles rapid successive changes without crashing");
  it.todo("can watch nested subdirectories");
});
