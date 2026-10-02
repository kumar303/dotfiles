#!/usr/bin/env node
// @ts-check

import { currentWorkspaceDirectories, readSnapshot } from "./herdr.js";
import {
  buildWorkspaceSnapshot,
  cancelWorkspaceSnapshotRefresh,
  markWorkspaceFocused,
  readWorkspaceSnapshot,
  writeWorkspaceSnapshot,
} from "./snapshot.js";
import { recordWorkspace, seedWorkspaceHistory } from "./store.js";

/** @typedef {{workspace_cwd?: unknown, workspace_id?: unknown}} PluginContext */

const stateDirectory = requiredEnvironment("HERDR_PLUGIN_STATE_DIR");
const context = /** @type {PluginContext} */ (
  JSON.parse(requiredEnvironment("HERDR_PLUGIN_CONTEXT_JSON"))
);
if (typeof context.workspace_cwd !== "string" || !context.workspace_cwd) {
  throw new Error("plugin context lacks workspace_cwd");
}

cancelWorkspaceSnapshotRefresh(stateDirectory);
const snapshot = readSnapshot();
const current = currentWorkspaceDirectories(snapshot);
seedWorkspaceHistory(current, stateDirectory);
const now = Date.now();
recordWorkspace(context.workspace_cwd, stateDirectory, { now });
const workspaces = buildWorkspaceSnapshot(snapshot, readWorkspaceSnapshot(stateDirectory));
const workspace = workspaces.find(
  (candidate) =>
    candidate.workspaceId === context.workspace_id ||
    (typeof context.workspace_id !== "string" &&
      candidate.panes.some((pane) => pane.focused && pane.cwd === context.workspace_cwd)),
);
if (workspace) markWorkspaceFocused(workspaces, workspace.workspaceId, now);
writeWorkspaceSnapshot(workspaces, stateDirectory);

/** @param {string} name */
function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing environment variable: ${name}`);
  return value;
}
