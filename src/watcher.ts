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

class VaultWatcherImpl extends EventEmitter implements VaultWatcher {
  private watcher: fs.FSWatcher | null = null;

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

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }
}

/**
 * Create a vault watcher that monitors filesystem changes.
 *
 * @param vaultPath - Absolute or relative path to the vault directory.
 * @param config - Optional VaultConfig with settings (e.g., ignore patterns).
 * @returns A VaultWatcher instance.
 */
export function watch(vaultPath: string, config?: VaultConfig): VaultWatcher {
  return new VaultWatcherImpl(vaultPath, config);
}
