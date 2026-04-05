/**
 * @file watcher.ts
 * @description Vault filesystem watcher — Phase 3.
 *
 * Wraps Node.js `fs.watch` to emit typed `WatchEvent` objects for `.md` files.
 * Only `.md` files are surfaced; all other extensions are silently ignored.
 */

import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as path from "node:path";
import type { VaultWatcher, WatchEvent, VaultConfig } from "./types.js";

/**
 * @brief Concrete implementation of VaultWatcher using Node.js `fs.watch`.
 *
 * Extends `EventEmitter` so callers can use the standard `on()` / `off()` API.
 * Watches `vaultPath` recursively and emits a `"change"` event for every
 * `.md` modification, creation, or deletion. Non-`.md` filesystem events are
 * silently discarded. Errors from the underlying `FSWatcher` are re-emitted
 * as `"error"` events so the caller can handle them without crashing.
 *
 * @example
 * ```typescript
 * const watcher = new VaultWatcherImpl("/Users/alice/vault");
 * watcher.on("change", (event) => console.log(event.type, event.filepath));
 * watcher.on("error", (err) => console.error("Watch error:", err));
 * // ... later ...
 * watcher.stop();
 * ```
 *
 * @since 0.3.0
 */
class VaultWatcherImpl extends EventEmitter implements VaultWatcher {
  /** The underlying Node.js FSWatcher handle; `null` after `stop()` is called. */
  private watcher: fs.FSWatcher | null = null;

  /**
   * @brief Creates a new watcher for the specified vault directory.
   *
   * Starts watching `vaultPath` recursively via `fs.watch`. If the watch
   * cannot be started (e.g. directory not found), the error is deferred to the
   * next tick so callers can attach `"error"` listeners synchronously before
   * the error fires.
   *
   * @param vaultPath - Absolute path to the vault directory to watch.
   * @param _config - Optional vault configuration (reserved for future use,
   *   e.g. `excludePatterns` filtering). Currently unused.
   */
  constructor(vaultPath: string, _config?: VaultConfig) {
    super();
    try {
      this.watcher = fs.watch(
        vaultPath,
        { recursive: true },
        (eventType, filename) => {
          if (!filename || !filename.endsWith(".md")) return;
          const absPath = path.resolve(vaultPath, filename);
          let type: WatchEvent["type"];
          if (eventType === "change") {
            type = "change";
          } else {
            // "rename" covers both create and delete — distinguish via existence check
            type = fs.existsSync(absPath) ? "add" : "unlink";
          }
          const event: WatchEvent = {
            type,
            filepath: absPath,
            timestamp: Date.now(),
          };
          this.emit("change", event);
        }
      );
      this.watcher.on("error", (err) => this.emit("error", err));
    } catch (err) {
      // Defer so the caller can attach listeners before the error fires
      setImmediate(() => this.emit("error", err));
    }
  }

  /**
   * @brief Stops watching and releases the underlying filesystem handle.
   *
   * After `stop()` is called, no further `"change"` or `"error"` events will
   * be emitted. Subsequent calls to `stop()` are safe (idempotent).
   */
  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }
}

/**
 * @brief Creates a vault watcher that monitors filesystem changes.
 *
 * Factory function that constructs a {@link VaultWatcherImpl} and returns it
 * as the public {@link VaultWatcher} interface. This hides the implementation
 * class from consumers and keeps the public API minimal.
 *
 * @param vaultPath - Absolute or relative path to the vault directory.
 * @param config - Optional {@link VaultConfig} with settings (e.g., ignore patterns).
 * @returns A {@link VaultWatcher} instance ready to emit `"change"` events.
 *
 * @example
 * ```typescript
 * const watcher = watch("/Users/alice/vault");
 * watcher.on("change", (event) => {
 *   if (event.type === "add") indexFile(event.filepath, state);
 *   if (event.type === "unlink") removeFile(event.filepath, state);
 * });
 * // Graceful shutdown:
 * watcher.stop();
 * ```
 *
 * @since 0.3.0
 */
export function watch(vaultPath: string, config?: VaultConfig): VaultWatcher {
  return new VaultWatcherImpl(vaultPath, config);
}
