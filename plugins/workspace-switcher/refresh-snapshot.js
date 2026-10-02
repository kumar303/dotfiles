#!/usr/bin/env node
// @ts-check

import { randomUUID } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { writeFileAtomically } from "./atomic-file.js";
import { getGitBranchUpdate } from "./store.js";
import {
  cancelWorkspaceSnapshotRefresh,
  readWorkspaceSnapshot,
  writeWorkspaceSnapshot,
} from "./snapshot.js";

const stateDirectory = requiredEnvironment("HERDR_PLUGIN_STATE_DIR");
const workspaces = /** @type {import("./snapshot.js").WorkspaceSnapshot[]} */ (
  JSON.parse(requiredEnvironment("HERDR_WORKSPACE_SNAPSHOT_JSON"))
);
const focusedWorkspaceId = process.env.HERDR_FOCUSED_WORKSPACE_ID;
const ownerPath = join(stateDirectory, "snapshot-refresh.json");
const token = randomUUID();

cancelWorkspaceSnapshotRefresh(stateDirectory);
writeFileAtomically(ownerPath, `${JSON.stringify({ pid: process.pid, token })}\n`);
writeIfOwner();

const focusedPane = workspaces
  .find((workspace) => workspace.workspaceId === focusedWorkspaceId)
  ?.panes.find((pane) => pane.focused);
if (focusedPane) {
  const update = getGitBranchUpdate(focusedPane.cwd);
  if (update) {
    focusedPane.branch = update.branch;
    writeIfOwner();
  }
}

if (ownsRefresh()) rmSync(ownerPath, { force: true });

function writeIfOwner() {
  if (!ownsRefresh()) process.exit(0);
  const cached = readWorkspaceSnapshot(stateDirectory);
  for (const workspace of workspaces) {
    const cachedWorkspace = cached.find(
      (candidate) => candidate.workspaceId === workspace.workspaceId,
    );
    for (const pane of workspace.panes) {
      const lastFocused = cachedWorkspace?.panes.find(
        (candidate) => candidate.paneId === pane.paneId,
      )?.lastFocused;
      if (typeof lastFocused === "number" && (pane.lastFocused ?? -Infinity) < lastFocused) {
        pane.lastFocused = lastFocused;
      }
    }
  }
  if (!ownsRefresh()) process.exit(0);
  writeWorkspaceSnapshot(workspaces, stateDirectory);
}

function ownsRefresh() {
  try {
    const owner = JSON.parse(readFileSync(ownerPath, "utf8"));
    return owner?.pid === process.pid && owner?.token === token;
  } catch {
    return false;
  }
}

/** @param {string} name */
function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing environment variable: ${name}`);
  return value;
}
