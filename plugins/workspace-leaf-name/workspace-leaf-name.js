#!/usr/bin/env node
// @ts-check

import { execFileSync } from "node:child_process";
import { basename } from "node:path";

/** @typedef {{workspace_id?: unknown, workspace_label?: unknown}} PluginContext */

const context = parseContext(requiredEnvironment("HERDR_PLUGIN_CONTEXT_JSON"));
const workspaceId = requiredContextString(context, "workspace_id");
const herdrPath = requiredEnvironment("HERDR_BIN_PATH");
const response = JSON.parse(
  execFileSync(herdrPath, ["pane", "list", "--workspace", workspaceId], {
    encoding: "utf8",
  }),
);
const firstPane = response?.result?.panes?.[0];
if (typeof firstPane?.cwd !== "string" || !firstPane.cwd) {
  throw new Error("workspace has no pane working directory");
}

const workspaceName = basename(firstPane.cwd);
if (!workspaceName) throw new Error("workspace directory has no leaf name");

if (context.workspace_label !== workspaceName) {
  execFileSync(herdrPath, ["workspace", "rename", workspaceId, workspaceName], {
    stdio: "inherit",
  });
}

/**
 * @param {string} value
 * @returns {PluginContext}
 */
function parseContext(value) {
  const context = /** @type {PluginContext} */ (JSON.parse(value));
  if (!context || typeof context !== "object") throw new Error("invalid plugin context");
  return context;
}

/**
 * @param {PluginContext} context
 * @param {keyof PluginContext} key
 * @returns {string}
 */
function requiredContextString(context, key) {
  const value = context[key];
  if (typeof value !== "string" || !value) throw new Error(`plugin context lacks ${key}`);
  return value;
}

/**
 * @param {string} name
 * @returns {string}
 */
function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing environment variable: ${name}`);
  return value;
}
