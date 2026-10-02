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
 * @property {string} [workspaceId]
 * @property {string} [workspaceName]
 * @property {string[]} [workspaceDirectories]
 * @property {(string | null)[]} [workspaceBranches]
 * @property {boolean} [duplicateWorkspaceName]
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
 * @param {Array<{dir: string, branch?: string | null}>} workspaces
 * @param {string} stateDirectory
 * @param {number} [now]
 */
export function ensureWorkspaceHistory(workspaces, stateDirectory, now = Date.now()) {
  mkdirSync(stateDirectory, { recursive: true });
  const candidates = workspaces.map((workspace) => {
    const dir = resolve(workspace.dir);
    return {
      dir,
      branch: workspace.branch === undefined ? getGitBranch(dir) : workspace.branch,
    };
  });
  const history = readWorkspaceHistory(stateDirectory, now);
  const knownDirectories = new Set(
    [...history.today, ...history.earlier].map((entry) => entry.dir),
  );
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const inactiveLastFocused = startOfToday.getTime() - 1;

  for (const candidate of candidates) {
    if (knownDirectories.has(candidate.dir)) continue;
    const entry = { ...candidate, lastFocused: inactiveLastFocused };
    appendFileSync(historyPath(stateDirectory), `${JSON.stringify(entry)}\n`);
    knownDirectories.add(candidate.dir);
  }
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
 * @param {import("./snapshot.js").WorkspaceSnapshot[]} workspaces
 * @param {WorkspaceHistory} history
 * @param {number} [now]
 * @returns {WorkspaceHistory}
 */
export function mergeCurrentWorkspaces(workspaces, history, now = Date.now()) {
  const historyEntries = [...history.today, ...history.earlier];
  /** @type {Map<string, number>} */
  const workspaceNameCounts = new Map();
  for (const workspace of workspaces) {
    workspaceNameCounts.set(workspace.name, (workspaceNameCounts.get(workspace.name) ?? 0) + 1);
  }
  const current = workspaces.flatMap((workspace) => {
    const pane = workspace.panes.find((candidate) => candidate.focused);
    if (!pane) return [];
    const remembered = historyEntries.find((entry) => entry.dir === pane.cwd);
    return [
      {
        dir: pane.cwd,
        branch: pane.branch ?? remembered?.branch ?? null,
        lastFocused: pane.lastFocused ?? now,
        workspaceId: workspace.workspaceId,
        workspaceName: workspace.name,
        workspaceDirectories: workspace.panes.map((candidate) => candidate.cwd),
        workspaceBranches: workspace.panes.map((candidate) => candidate.branch),
        duplicateWorkspaceName: (workspaceNameCounts.get(workspace.name) ?? 0) > 1,
      },
    ];
  });
  const currentDirectories = new Set(
    workspaces.flatMap((workspace) => workspace.panes.map((pane) => pane.cwd)),
  );
  const combined = [
    ...current,
    ...history.today.filter((entry) => !currentDirectories.has(entry.dir)),
    ...history.earlier.filter((entry) => !currentDirectories.has(entry.dir)),
  ].sort((left, right) => right.lastFocused - left.lastFocused);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return {
    today: combined
      .filter((entry) => entry.lastFocused >= startOfToday.getTime())
      .slice(0, MAX_LIST),
    earlier: combined
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
      (entry.branch ?? "").toLowerCase().includes(normalized) ||
      (entry.workspaceDirectories ?? []).some((dir) => dir.toLowerCase().includes(normalized)) ||
      (entry.workspaceBranches ?? []).some((branch) =>
        (branch ?? "").toLowerCase().includes(normalized),
      ),
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
