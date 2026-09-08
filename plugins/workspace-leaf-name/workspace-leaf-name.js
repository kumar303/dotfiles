#!/usr/bin/env node
// @ts-check

import { execFileSync } from "node:child_process";
import { basename } from "node:path";

/** @typedef {{workspace_id?: unknown, workspace_cwd?: unknown}} PluginContext */

const context = parseContext(requiredEnvironment("HERDR_PLUGIN_CONTEXT_JSON"));
const workspaceId = requiredContextString(context, "workspace_id");
const workspaceCwd = requiredContextString(context, "workspace_cwd");
const workspaceName = basename(workspaceCwd);

if (!workspaceName) throw new Error("workspace directory has no leaf name");

execFileSync(
  requiredEnvironment("HERDR_BIN_PATH"),
  ["workspace", "rename", workspaceId, workspaceName],
  { stdio: "inherit" },
);

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
