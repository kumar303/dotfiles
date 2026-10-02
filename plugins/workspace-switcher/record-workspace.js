#!/usr/bin/env node
// @ts-check

import { currentWorkspaceDirectories, readSnapshot } from "./herdr.js";
import {
  buildWorkspaceSnapshot,
  cancelWorkspaceSnapshotRefresh,
  readWorkspaceSnapshot,
  writeWorkspaceSnapshot,
} from "./snapshot.js";
import { recordWorkspace, seedWorkspaceHistory } from "./store.js";

/** @typedef {{workspace_cwd?: unknown}} PluginContext */

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
recordWorkspace(context.workspace_cwd, stateDirectory);
writeWorkspaceSnapshot(
  buildWorkspaceSnapshot(snapshot, readWorkspaceSnapshot(stateDirectory)),
  stateDirectory,
);

/** @param {string} name */
function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing environment variable: ${name}`);
  return value;
}
