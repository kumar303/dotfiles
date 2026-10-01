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
const ownerPath = join(stateDirectory, "snapshot-refresh.json");
const token = randomUUID();

cancelPreviousRefresh();
writeFileSync(ownerPath, `${JSON.stringify({ pid: process.pid, token })}\n`);
writeIfOwner();

for (const workspace of workspaces) {
  for (const pane of workspace.panes) {
    if (!ownsRefresh()) process.exit(0);
    pane.branch = getGitBranch(pane.cwd);
    writeIfOwner();
  }
}

if (ownsRefresh()) rmSync(ownerPath, { force: true });

function cancelPreviousRefresh() {
  if (!existsSync(ownerPath)) return;
  try {
    const owner = JSON.parse(readFileSync(ownerPath, "utf8"));
    if (typeof owner?.pid === "number" && owner.pid !== process.pid) {
      process.kill(owner.pid, "SIGTERM");
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
