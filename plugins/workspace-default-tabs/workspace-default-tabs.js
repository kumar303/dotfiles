#!/usr/bin/env node
// @ts-check

import { execFileSync } from "node:child_process";

/** @typedef {{workspace_id?: unknown, workspace_cwd?: unknown, tab_id?: unknown}} PluginContext */

const context = /** @type {PluginContext} */ (
  JSON.parse(requiredEnvironment("HERDR_PLUGIN_CONTEXT_JSON"))
);
const workspaceId = requiredContextString(context, "workspace_id");
const workspaceCwd = requiredContextString(context, "workspace_cwd");
const agentTabId = requiredContextString(context, "tab_id");
const herdrPath = requiredEnvironment("HERDR_BIN_PATH");

runHerdr(["tab", "rename", agentTabId, "agent"]);
runHerdr([
  "tab",
  "create",
  "--workspace",
  workspaceId,
  "--cwd",
  workspaceCwd,
  "--label",
  "shell",
  "--no-focus",
]);
runHerdr(["tab", "focus", agentTabId]);

/** @param {string[]} args */
function runHerdr(args) {
  execFileSync(herdrPath, args, { stdio: "inherit" });
}

/**
 * @param {PluginContext} contextValue
 * @param {keyof PluginContext} key
 * @returns {string}
 */
function requiredContextString(contextValue, key) {
  const value = contextValue[key];
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
