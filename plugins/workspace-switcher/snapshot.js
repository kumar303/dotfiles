// @ts-check

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @typedef {object} SnapshotPane
 * @property {string} [paneId]
 * @property {string} cwd
 * @property {string | null} branch
 * @property {boolean} focused
 * @property {number | null} lastFocused
 */

/**
 * @typedef {object} WorkspaceSnapshot
 * @property {string} workspaceId
 * @property {string} name
 * @property {SnapshotPane[]} panes
 */

/**
 * @param {import("./herdr.js").HerdrSnapshot} snapshot
 * @param {WorkspaceSnapshot[]} cached
 * @param {number} [now]
 * @returns {WorkspaceSnapshot[]}
 */
export function buildWorkspaceSnapshot(snapshot, cached, now = Date.now()) {
  return snapshot.workspaces.flatMap((workspace) => {
    if (typeof workspace.workspace_id !== "string") return [];
    const workspaceId = workspace.workspace_id;
    const sourcePanes = snapshot.panes.filter(
      (pane) => pane.workspace_id === workspaceId && typeof pane.cwd === "string",
    );
    if (!sourcePanes.length) return [];

    const activeTabId =
      typeof workspace.active_tab_id === "string" ? workspace.active_tab_id : undefined;
    const activeLayout = (snapshot.layouts ?? []).find(
      (layout) =>
        layout.workspace_id === workspaceId &&
        (!activeTabId || layout.tab_id === activeTabId) &&
        typeof layout.focused_pane_id === "string",
    );
    const selectedPane =
      sourcePanes.find((pane) => pane.pane_id === activeLayout?.focused_pane_id) ??
      sourcePanes.find(
        (pane) =>
          Boolean(pane.focused) && (!activeTabId || !pane.tab_id || pane.tab_id === activeTabId),
      ) ??
      sourcePanes.find((pane) => !activeTabId || !pane.tab_id || pane.tab_id === activeTabId) ??
      sourcePanes[0];
    const selectedPaneId = selectedPane?.pane_id;
    const selectedDirectory = selectedPane ? resolve(/** @type {string} */ (selectedPane.cwd)) : "";
    const name =
      typeof workspace.label === "string" && workspace.label
        ? workspace.label
        : basename(selectedDirectory) || workspaceId;
    const cachedByName = cached.filter((candidate) => candidate.name === name);
    const cachedWorkspace =
      cachedByName.find((candidate) => candidate.workspaceId === workspaceId) ??
      (cachedByName.length === 1 ? cachedByName[0] : undefined);

    const panes = sourcePanes.map((pane) => {
      const paneId = typeof pane.pane_id === "string" ? pane.pane_id : undefined;
      const cwd = resolve(/** @type {string} */ (pane.cwd));
      const focused =
        typeof selectedPaneId === "string"
          ? pane.pane_id === selectedPaneId
          : cwd === selectedDirectory;
      const cachedByDirectory =
        cachedWorkspace?.panes.filter((candidate) => candidate.cwd === cwd) ?? [];
      const cachedPane =
        cachedByDirectory.find((candidate) => paneId && candidate.paneId === paneId) ??
        (cachedByDirectory.length === 1
          ? cachedByDirectory[0]
          : focused
            ? cachedByDirectory.find((candidate) => candidate.focused)
            : undefined);
      const globallyFocused =
        pane.pane_id === snapshot.focused_pane_id ||
        (Boolean(workspace.focused) && Boolean(pane.focused));
      return {
        ...(paneId ? { paneId } : {}),
        cwd,
        branch: cachedPane?.branch ?? null,
        focused,
        lastFocused: globallyFocused
          ? now
          : typeof cachedPane?.lastFocused === "number"
            ? cachedPane.lastFocused
            : focused
              ? now
              : null,
      };
    });
    return [{ workspaceId, name, panes }];
  });
}

/** @param {string} stateDirectory @returns {WorkspaceSnapshot[]} */
export function readWorkspaceSnapshot(stateDirectory) {
  const file = snapshotPath(stateDirectory);
  if (!existsSync(file)) return [];
  /** @type {WorkspaceSnapshot[]} */
  const workspaces = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line) continue;
    try {
      const workspace = JSON.parse(line);
      if (
        typeof workspace?.workspaceId === "string" &&
        typeof workspace.name === "string" &&
        Array.isArray(workspace.panes)
      ) {
        const panes = workspace.panes.filter(isSnapshotPane);
        workspaces.push({ workspaceId: workspace.workspaceId, name: workspace.name, panes });
      }
    } catch {
      // Ignore incomplete writes.
    }
  }
  return workspaces;
}

/**
 * @param {WorkspaceSnapshot[]} workspaces
 * @param {string} stateDirectory
 */
export function writeWorkspaceSnapshot(workspaces, stateDirectory) {
  mkdirSync(stateDirectory, { recursive: true });
  const file = snapshotPath(stateDirectory);
  const temporary = `${file}.${process.pid}.${Date.now()}`;
  const contents = workspaces.map((workspace) => JSON.stringify(workspace)).join("\n");
  writeFileSync(temporary, contents ? `${contents}\n` : "");
  renameSync(temporary, file);
}

/** @param {string} stateDirectory */
export function cancelWorkspaceSnapshotRefresh(stateDirectory) {
  const ownerPath = join(stateDirectory, "snapshot-refresh.json");
  if (!existsSync(ownerPath)) return;
  let pid;
  try {
    const owner = JSON.parse(readFileSync(ownerPath, "utf8"));
    if (typeof owner?.pid === "number") pid = owner.pid;
  } catch {
    // Remove invalid ownership state.
  }
  rmSync(ownerPath, { force: true });
  if (pid === undefined || pid === process.pid) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // The refresh already stopped.
    }
  }
}

/**
 * @param {WorkspaceSnapshot[]} workspaces
 * @param {string} stateDirectory
 * @param {string | undefined} focusedWorkspaceId
 */
export function startWorkspaceSnapshotRefresh(workspaces, stateDirectory, focusedWorkspaceId) {
  const refresh = spawn(
    process.execPath,
    [fileURLToPath(new URL("./refresh-snapshot.js", import.meta.url))],
    {
      detached: true,
      env: {
        ...process.env,
        HERDR_FOCUSED_WORKSPACE_ID: focusedWorkspaceId ?? "",
        HERDR_PLUGIN_STATE_DIR: stateDirectory,
        HERDR_WORKSPACE_SNAPSHOT_JSON: JSON.stringify(workspaces),
      },
      stdio: "ignore",
    },
  );
  refresh.unref();
}

/** @param {unknown} value @returns {value is SnapshotPane} */
function isSnapshotPane(value) {
  if (!value || typeof value !== "object") return false;
  const pane = /** @type {Record<string, unknown>} */ (value);
  return (
    (pane.paneId === undefined || typeof pane.paneId === "string") &&
    typeof pane.cwd === "string" &&
    (typeof pane.branch === "string" || pane.branch === null) &&
    typeof pane.focused === "boolean" &&
    (typeof pane.lastFocused === "number" || pane.lastFocused === null)
  );
}

/** @param {string} stateDirectory */
export function snapshotPath(stateDirectory) {
  return join(stateDirectory, "herdr-snapshot.jsonl");
}
