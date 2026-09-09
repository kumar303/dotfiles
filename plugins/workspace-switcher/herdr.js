// @ts-check

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/** @typedef {(args: string[]) => unknown} HerdrRunner */

/**
 * @typedef {object} HerdrSnapshot
 * @property {Array<Record<string, unknown>>} workspaces
 * @property {Array<Record<string, unknown>>} panes
 */

/**
 * @param {HerdrRunner} [run]
 * @returns {HerdrSnapshot}
 */
export function readSnapshot(run = runHerdr) {
  const response = /** @type {any} */ (run(["api", "snapshot"]));
  const snapshot = response?.result?.snapshot;
  if (!snapshot || !Array.isArray(snapshot.workspaces) || !Array.isArray(snapshot.panes)) {
    throw new Error("Herdr snapshot lacks workspaces or panes");
  }
  return snapshot;
}

/**
 * @param {HerdrSnapshot} snapshot
 * @returns {Array<{dir: string, workspaceId: string}>}
 */
export function currentWorkspaceDirectories(snapshot) {
  return snapshot.workspaces
    .filter((workspace) => typeof workspace.workspace_id === "string")
    .sort(
      (left, right) =>
        Number(Boolean(right.focused)) - Number(Boolean(left.focused)) ||
        Number(left.number ?? 0) - Number(right.number ?? 0),
    )
    .flatMap((workspace) => {
      const workspaceId = /** @type {string} */ (workspace.workspace_id);
      const worktree = isRecord(workspace.worktree) ? workspace.worktree : undefined;
      const worktreePath = worktree?.checkout_path;
      const panes = snapshot.panes.filter((pane) => pane.workspace_id === workspaceId);
      const pane = panes.find((item) => item.focused) ?? panes[0];
      const dir =
        typeof worktreePath === "string"
          ? worktreePath
          : typeof pane?.cwd === "string"
            ? pane.cwd
            : undefined;
      return dir ? [{ dir: resolve(dir), workspaceId }] : [];
    });
}

/**
 * @param {string} dir
 * @param {HerdrSnapshot} snapshot
 * @param {HerdrRunner} [run]
 */
export function openWorkspace(dir, snapshot, run = runHerdr) {
  const absoluteDirectory = resolve(dir);
  const existingPane = snapshot.panes.find(
    (pane) =>
      typeof pane.cwd === "string" &&
      typeof pane.workspace_id === "string" &&
      resolve(pane.cwd) === absoluteDirectory,
  );
  const existingWorktree = snapshot.workspaces.find((workspace) => {
    const worktree = isRecord(workspace.worktree) ? workspace.worktree : undefined;
    return (
      typeof workspace.workspace_id === "string" &&
      typeof worktree?.checkout_path === "string" &&
      resolve(worktree.checkout_path) === absoluteDirectory
    );
  });
  const workspaceId = existingPane?.workspace_id ?? existingWorktree?.workspace_id;
  if (typeof workspaceId === "string") {
    run(["workspace", "focus", workspaceId]);
  } else {
    run(["workspace", "create", "--cwd", absoluteDirectory, "--focus"]);
  }
}

/** @param {HerdrRunner} [run] */
export function openPickerPopup(run = runHerdr) {
  run([
    "plugin",
    "pane",
    "open",
    "--plugin",
    "kumar303.workspace-switcher",
    "--entrypoint",
    "picker",
  ]);
}

/**
 * @param {string[]} args
 * @returns {unknown}
 */
export function runHerdr(args) {
  const output = execFileSync(requiredEnvironment("HERDR_BIN_PATH"), args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10000,
  });
  return JSON.parse(output);
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return Boolean(value) && typeof value === "object";
}

/** @param {string} name */
function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing environment variable: ${name}`);
  return value;
}
