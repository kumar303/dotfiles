#!/usr/bin/env node
// @ts-check

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getGitBranch } from "./store.js";
import { writeWorkspaceSnapshot } from "./snapshot.js";

const stateDirectory = requiredEnvironment("HERDR_PLUGIN_STATE_DIR");
const workspaces = /** @type {import("./snapshot.js").WorkspaceSnapshot[]} */ (
  JSON.parse(requiredEnvironment("HERDR_WORKSPACE_SNAPSHOT_JSON"))
);
const focusedWorkspaceId = process.env.HERDR_FOCUSED_WORKSPACE_ID;
const ownerPath = join(stateDirectory, "snapshot-refresh.json");
const token = randomUUID();

cancelPreviousRefresh();
writeFileSync(ownerPath, `${JSON.stringify({ pid: process.pid, token })}\n`);
writeIfOwner();

const focusedPane = workspaces
  .find((workspace) => workspace.workspaceId === focusedWorkspaceId)
  ?.panes.find((pane) => pane.focused);
if (focusedPane) {
  focusedPane.branch = getGitBranch(focusedPane.cwd);
  writeIfOwner();
}

if (ownsRefresh()) rmSync(ownerPath, { force: true });

function cancelPreviousRefresh() {
  if (!existsSync(ownerPath)) return;
  try {
    const owner = JSON.parse(readFileSync(ownerPath, "utf8"));
    if (typeof owner?.pid === "number" && owner.pid !== process.pid) {
      try {
        process.kill(-owner.pid, "SIGTERM");
      } catch {
        process.kill(owner.pid, "SIGTERM");
      }
    }
  } catch {
    // Replace invalid ownership state.
  }
}

function writeIfOwner() {
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
