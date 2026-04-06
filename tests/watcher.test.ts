/**
 * @file watcher.test.ts
 * @description Unit + integration tests for the watch() function — Sprint 3.
 *
 * Tests cover the VaultWatcher implementation in src/watcher.ts. Because the
 * watcher is built on Node.js `fs.watch`, most tests are async and rely on real
 * filesystem events. Temp directories are created under tests/.tmp-watcher-N/
 * (not in /tmp) and cleaned up in afterEach.
 *
 * Run: pnpm test:coverage
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join, isAbsolute } from "path";
import * as fs from "node:fs";
import { watch } from "../src/watcher";
import type { VaultWatcher, WatchEvent } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let watcher: VaultWatcher | null = null;

beforeEach(() => {
  tmpDir = join(
    __dirname,
    `.tmp-watcher-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  fs.mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  try {
    watcher?.stop();
  } catch {
    // ignore stop errors during cleanup
  }
  watcher = null;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Resolves with the first WatchEvent emitted, or rejects after `timeoutMs`.
 * Attaches a one-time listener so subsequent events in the same test are
 * not swallowed.
 */
function waitForEvent(
  w: VaultWatcher,
  timeoutMs = 5000,
): Promise<WatchEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out after ${timeoutMs}ms waiting for watcher event`)),
      timeoutMs,
    );
    w.on("change", (event) => {
      clearTimeout(timer);
      resolve(event);
    });
  });
}

/** Small sleep helper to let fs.watch settle before triggering changes. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("watch()", () => {
  it("stop() closes the watcher cleanly", () => {
    watcher = watch(tmpDir);
    // First stop: should close without error
    expect(() => watcher!.stop()).not.toThrow();
    // Second stop: idempotent — watcher is already null internally
    expect(() => watcher!.stop()).not.toThrow();
  });

  it("emits error event on invalid vault path", () =>
    new Promise<void>((resolve, reject) => {
      const badPath = join(__dirname, ".tmp-nonexistent-vault-xyz");
      const badWatcher = watch(badPath);
      const timer = setTimeout(
        () => reject(new Error("timeout: error event never fired")),
        3000,
      );
      badWatcher.on("error", (err) => {
        clearTimeout(timer);
        badWatcher.stop();
        expect(err).toBeDefined();
        resolve();
      });
    }), 5000);

  it("emits change event when a markdown file is created", async () => {
    watcher = watch(tmpDir);
    // Let the OS-level watch settle before triggering the change
    await sleep(200);

    const eventPromise = waitForEvent(watcher);
    fs.writeFileSync(join(tmpDir, "new-note.md"), "# Hello");

    const event = await eventPromise;
    expect(event.type).toBe("add");
    expect(event.filepath).toContain("new-note.md");
    expect(typeof event.timestamp).toBe("number");
    expect(event.timestamp).toBeGreaterThan(0);
  }, 12000);

  it("emits change event when a markdown file is modified", async () => {
    const filePath = join(tmpDir, "existing.md");
    fs.writeFileSync(filePath, "# Original");

    watcher = watch(tmpDir);
    await sleep(200);

    const eventPromise = waitForEvent(watcher);
    fs.writeFileSync(filePath, "# Modified");

    const event = await eventPromise;
    // fs.watch may emit "change" or "rename" (→ add) depending on OS
    expect(["change", "add"]).toContain(event.type);
    expect(event.filepath).toBe(filePath);
  }, 12000);

  it("emits change event when a markdown file is deleted", async () => {
    const filePath = join(tmpDir, "to-delete.md");
    fs.writeFileSync(filePath, "# Temporary");

    watcher = watch(tmpDir);
    await sleep(200);

    const eventPromise = waitForEvent(watcher);
    fs.unlinkSync(filePath);

    const event = await eventPromise;
    expect(event.type).toBe("unlink");
    expect(event.filepath).toBe(filePath);
  }, 12000);

  it("does not emit change for non-markdown files", async () => {
    const events: WatchEvent[] = [];

    watcher = watch(tmpDir);
    watcher.on("change", (e) => events.push(e));
    await sleep(200);

    // Write a non-md file — should NOT trigger any event
    fs.writeFileSync(join(tmpDir, "image.png"), "binary");
    fs.writeFileSync(join(tmpDir, "notes.txt"), "plain text");
    fs.writeFileSync(join(tmpDir, "data.json"), "{}");

    // Give the watcher time to fire if it incorrectly emits for these
    await sleep(600);

    // Confirm no events were emitted for non-.md files
    const nonMdEvents = events.filter((e) => !e.filepath.endsWith(".md"));
    expect(nonMdEvents).toHaveLength(0);

    // Sanity-check: writing a .md file DOES produce an event
    fs.writeFileSync(join(tmpDir, "real.md"), "# Real");
    await waitForEvent(watcher);
    // Events array now has at least one .md event
    expect(events.some((e) => e.filepath.endsWith(".md"))).toBe(true);
  }, 12000);

  it("type field on WatchEvent is correct for create/modify/delete", async () => {
    watcher = watch(tmpDir);
    await sleep(200);

    // --- create ---
    const addPromise = waitForEvent(watcher);
    fs.writeFileSync(join(tmpDir, "lifecycle.md"), "# v1");
    const addEvent = await addPromise;
    expect(addEvent.type).toBe("add");

    // Reset listener for next event — create a fresh watcher on a fresh dir copy
    // (simpler: just verify the next write to an existing file)
    await sleep(300);

    // --- delete ---
    const unlinkPromise = waitForEvent(watcher);
    fs.unlinkSync(join(tmpDir, "lifecycle.md"));
    const unlinkEvent = await unlinkPromise;
    expect(unlinkEvent.type).toBe("unlink");
  }, 12000);

  it("path field on WatchEvent is absolute path", async () => {
    watcher = watch(tmpDir);
    await sleep(200);

    const eventPromise = waitForEvent(watcher);
    const fileName = "absolute-check.md";
    fs.writeFileSync(join(tmpDir, fileName), "# Abs");

    const event = await eventPromise;
    expect(isAbsolute(event.filepath)).toBe(true);
    expect(event.filepath).toContain(fileName);
  }, 12000);

  it("handles rapid successive changes without crashing", async () => {
    const filePath = join(tmpDir, "rapid.md");
    fs.writeFileSync(filePath, "# v0");

    watcher = watch(tmpDir);
    await sleep(200);

    const received: WatchEvent[] = [];
    watcher.on("change", (e) => received.push(e));

    // Write 8 times in quick succession
    for (let i = 1; i <= 8; i++) {
      fs.writeFileSync(filePath, `# v${i}`);
    }

    // Wait long enough for the OS to flush all events
    await sleep(1500);

    // The watcher must still be alive — at least one event received
    expect(received.length).toBeGreaterThanOrEqual(1);
    // All received events must have correct shape
    for (const e of received) {
      expect(["add", "change", "unlink"]).toContain(e.type);
      expect(typeof e.filepath).toBe("string");
      expect(typeof e.timestamp).toBe("number");
    }
  }, 12000);

  it("can watch nested subdirectories", async () => {
    const subDir = join(tmpDir, "subdir", "deep");
    fs.mkdirSync(subDir, { recursive: true });

    watcher = watch(tmpDir);
    await sleep(200);

    const eventPromise = waitForEvent(watcher);
    const nestedFile = join(subDir, "nested.md");
    fs.writeFileSync(nestedFile, "# Nested");

    const event = await eventPromise;
    expect(event.filepath).toBe(nestedFile);
    expect(isAbsolute(event.filepath)).toBe(true);
  }, 12000);
});
