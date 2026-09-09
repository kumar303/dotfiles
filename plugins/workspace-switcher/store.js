// @ts-check

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const MAX_LIST = 500;
const MAX_AGE_DAYS = 180;

/**
 * @typedef {object} WorkspaceEntry
 * @property {string} dir
 * @property {string | null} branch
 * @property {number} lastFocused
 */

/**
 * @typedef {object} WorkspaceHistory
 * @property {WorkspaceEntry[]} today
 * @property {WorkspaceEntry[]} earlier
 */

/**
 * @param {string} dir
 * @returns {string | null}
 */
export function getGitBranch(dir) {
  try {
    return (
      execFileSync("git", ["branch", "--show-current"], {
        cwd: dir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 3000,
      }).trim() || null
    );
  } catch {
    return null;
  }
}

/**
 * @param {string} dir
 * @param {string} stateDirectory
 * @param {{branch?: string | null, now?: number}} [options]
 */
export function recordWorkspace(dir, stateDirectory, options = {}) {
  mkdirSync(stateDirectory, { recursive: true });
  const entry = {
    dir: resolve(dir),
    branch:
      Object.prototype.hasOwnProperty.call(options, "branch") && options.branch !== undefined
        ? options.branch
        : getGitBranch(dir),
    lastFocused: options.now ?? Date.now(),
  };
  appendFileSync(historyPath(stateDirectory), `${JSON.stringify(entry)}\n`);
}

/**
 * @param {Array<{dir: string, branch?: string | null}>} workspaces
 * @param {string} stateDirectory
 * @param {number} [now]
 * @returns {boolean}
 */
export function seedWorkspaceHistory(workspaces, stateDirectory, now = Date.now()) {
  mkdirSync(stateDirectory, { recursive: true });
  const file = historyPath(stateDirectory);
  if (existsSync(file)) return false;

  const lines = workspaces.map((workspace, index) =>
    JSON.stringify({
      dir: resolve(workspace.dir),
      branch: workspace.branch === undefined ? getGitBranch(workspace.dir) : workspace.branch,
      lastFocused: now - index,
    }),
  );
  writeFileSync(file, lines.length ? `${lines.join("\n")}\n` : "");
  return true;
}

/**
 * @param {string} stateDirectory
 * @param {number} [now]
 * @returns {WorkspaceHistory}
 */
export function readWorkspaceHistory(stateDirectory, now = Date.now()) {
  const entries = readEntries(stateDirectory);
  const cutoff = now - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  /** @type {Map<string, WorkspaceEntry>} */
  const byDirectory = new Map();
  for (const entry of entries) {
    if (entry.lastFocused < cutoff) continue;
    const existing = byDirectory.get(entry.dir);
    if (!existing || existing.lastFocused < entry.lastFocused) {
      byDirectory.set(entry.dir, entry);
    }
  }

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const sorted = [...byDirectory.values()].sort(
    (left, right) => right.lastFocused - left.lastFocused,
  );
  return {
    today: sorted.filter((entry) => entry.lastFocused >= startOfToday.getTime()).slice(0, MAX_LIST),
    earlier: sorted
      .filter((entry) => entry.lastFocused < startOfToday.getTime())
      .slice(0, MAX_LIST),
  };
}

/**
 * @param {WorkspaceEntry[]} entries
 * @param {string} query
 * @returns {WorkspaceEntry[]}
 */
export function filterWorkspaces(entries, query) {
  const normalized = query.toLowerCase();
  if (!normalized) return entries;
  return entries.filter(
    (entry) =>
      basename(entry.dir).toLowerCase().includes(normalized) ||
      entry.dir.toLowerCase().includes(normalized) ||
      (entry.branch ?? "").toLowerCase().includes(normalized),
  );
}

/** @param {string} stateDirectory @returns {WorkspaceEntry[]} */
function readEntries(stateDirectory) {
  const file = historyPath(stateDirectory);
  if (!existsSync(file)) return [];
  const entries = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line) continue;
    try {
      const entry = JSON.parse(line);
      if (
        typeof entry?.dir === "string" &&
        (typeof entry.branch === "string" || entry.branch === null) &&
        typeof entry.lastFocused === "number"
      ) {
        entries.push(entry);
      }
    } catch {
      // Ignore incomplete writes.
    }
  }
  return entries;
}

/** @param {string} stateDirectory */
function historyPath(stateDirectory) {
  return join(stateDirectory, "workspaces.jsonl");
}
