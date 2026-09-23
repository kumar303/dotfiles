#!/usr/bin/env node
// @ts-check

import { currentWorkspaceDirectories, readSnapshot } from "./herdr.js";
import { ensureWorkspaceHistory } from "./store.js";

const stateDirectory = requiredEnvironment("HERDR_PLUGIN_STATE_DIR");
ensureWorkspaceHistory(currentWorkspaceDirectories(readSnapshot()), stateDirectory);

/** @param {string} name */
function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing environment variable: ${name}`);
  return value;
}
