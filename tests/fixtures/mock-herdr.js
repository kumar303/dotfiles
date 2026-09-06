#!/usr/bin/env node
// @ts-check

import { appendFileSync, readFileSync, renameSync, writeFileSync } from "node:fs";

const logPath = requiredEnvironment("HERDR_MOCK_LOG");
const panesPath = requiredEnvironment("HERDR_MOCK_PANES");
const counterPath = requiredEnvironment("HERDR_MOCK_COUNTER");
const args = process.argv.slice(2);
appendFileSync(logPath, `${JSON.stringify(args)}\n`);

/** @type {{result: {panes: Array<Record<string, unknown>>}}} */
const state = JSON.parse(readFileSync(panesPath, "utf8"));
const [area, command] = args;

if (area === "tab" && command === "create") {
  const next = nextId();
  const workspaceId = option(args, "--workspace") || "w1";
  const pane = {
    pane_id: `${workspaceId}:p${next}`,
    terminal_id: `term_${next}`,
    cwd: option(args, "--cwd") || "",
    tab_id: `${workspaceId}:t${next}`,
    workspace_id: workspaceId,
    focused: false,
  };
  state.result.panes.push(pane);
  saveState(state);
  output({
    result: {
      tab: { tab_id: pane.tab_id, label: option(args, "--label") },
      root_pane: pane,
    },
  });
} else if (area === "pane") {
  handlePaneCommand(command);
} else {
  fail(`unexpected mock invocation: ${args.join(" ")}`);
}

/** @param {string | undefined} command */
function handlePaneCommand(command) {
  switch (command) {
    case "list":
      output(state);
      break;
    case "current":
      process.exitCode = 1;
      break;
    case "split": {
      const sourcePaneId = option(args, "--pane");
      const cwd = option(args, "--cwd");
      const sourcePane = state.result.panes.find((pane) => pane.pane_id === sourcePaneId);
      if (!sourcePane) fail(`source pane not found: ${sourcePaneId}`);

      const next = nextId();
      const pane = {
        pane_id: `w1:p${next}`,
        terminal_id: `term_${next}`,
        cwd,
        tab_id: sourcePane.tab_id,
        workspace_id: sourcePane.workspace_id,
        focused: false,
      };
      state.result.panes.push(pane);
      saveState(state);
      output({ result: { pane, marker: option(args, "--env") } });
      break;
    }
    case "move": {
      const paneId = args[2];
      const pane = state.result.panes.find((item) => item.pane_id === paneId);
      if (!pane) fail(`pane not found: ${paneId}`);

      if (args.includes("--new-tab")) {
        const next = nextId();
        const workspaceId = option(args, "--workspace") || String(pane.workspace_id);
        pane.workspace_id = workspaceId;
        pane.tab_id = `${workspaceId}:t${next}`;
      } else {
        const tabId = option(args, "--tab");
        if (!tabId) fail("move requires --tab or --new-tab");
        pane.tab_id = tabId;
        const target = state.result.panes.find(
          (item) => item.pane_id === option(args, "--target-pane"),
        );
        if (target) pane.workspace_id = target.workspace_id;
      }
      saveState(state);
      output({ result: { move_result: { pane } } });
      break;
    }
    case "close": {
      const paneId = args[2];
      state.result.panes = state.result.panes.filter((pane) => pane.pane_id !== paneId);
      saveState(state);
      output({ result: {} });
      break;
    }
    case "get": {
      const pane = state.result.panes.find((item) => item.pane_id === args[2]);
      output({ result: { pane } });
      break;
    }
    case "swap":
    case "run":
      output({ result: {} });
      break;
    default:
      fail(`unexpected mock invocation: ${args.join(" ")}`);
  }
}

function nextId() {
  const next = Number.parseInt(readFileSync(counterPath, "utf8"), 10) + 1;
  writeFileSync(counterPath, `${next}\n`);
  return next;
}

/**
 * @param {string[]} values
 * @param {string} name
 * @returns {string | undefined}
 */
function option(values, name) {
  const index = values.indexOf(name);
  return index >= 0 ? values[index + 1] : undefined;
}

/** @param {unknown} value */
function output(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

/** @param {{result: {panes: Array<Record<string, unknown>>}}} value */
function saveState(value) {
  const temporaryPath = `${panesPath}.${process.pid}`;
  writeFileSync(temporaryPath, `${JSON.stringify(value)}\n`);
  renameSync(temporaryPath, panesPath);
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

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(message);
  process.exit(1);
}
