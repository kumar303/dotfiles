#!/usr/bin/env node
// @ts-check

import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { openPromptOverlay, paneRunsVim, requestVimContext } from "./herdr.js";

const paneId = requiredEnvironment("HERDR_ACTIVE_PANE_ID");
const cwd = requiredEnvironment("HERDR_ACTIVE_PANE_CWD");
const stateDirectory = requiredEnvironment("HERDR_PLUGIN_STATE_DIR");
const contextFile = join(stateDirectory, `context-${safeId(paneId)}.json`);
rmSync(contextFile, { force: true });

if (paneRunsVim(paneId)) {
  requestVimContext(paneId);
  waitForFile(contextFile, 500);
}

openPromptOverlay({
  cwd,
  contextFile: existsSync(contextFile) ? contextFile : undefined,
});

/**
 * @param {string} path
 * @param {number} timeoutMilliseconds
 */
function waitForFile(path, timeoutMilliseconds) {
  const deadline = Date.now() + timeoutMilliseconds;
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  while (!existsSync(path) && Date.now() < deadline) {
    Atomics.wait(sleeper, 0, 0, 10);
  }
}

/** @param {string} value */
function safeId(value) {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_");
}

/** @param {string} name */
function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing environment variable: ${name}`);
  return value;
}
