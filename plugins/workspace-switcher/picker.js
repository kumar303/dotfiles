#!/usr/bin/env node
// @ts-check

import "./runtime.js";
import { Box, Screen, escape } from "@unblessed/core";
import { basename } from "node:path";
import { currentWorkspaceDirectories, openWorkspace, readSnapshot } from "./herdr.js";
import { WorkspacePickerModel } from "./model.js";
import { readWorkspaceHistory, seedWorkspaceHistory } from "./store.js";
import { readWorkspaceSwitcherTheme } from "./theme.js";
import { buildWorkspaceRows } from "./view.js";

const theme = await readWorkspaceSwitcherTheme();
const KEY_LEGEND = "↑/↓ select  g/G top/bottom  d/u page  enter open  / search  esc close";
const stateDirectory = requiredEnvironment("HERDR_PLUGIN_STATE_DIR");
const initialSnapshot = readSnapshot();
seedWorkspaceHistory(currentWorkspaceDirectories(initialSnapshot), stateDirectory);
const model = new WorkspacePickerModel(readWorkspaceHistory(stateDirectory));
let scrollOffset = 0;
let errorMessage = "";

const screen = new Screen({ smartCSR: true, title: "Herdr workspaces" });
const content = new Box({
  parent: screen,
  top: 0,
  left: 0,
  right: 0,
  bottom: 1,
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  style: { bg: theme.background, fg: theme.text },
});
const status = new Box({
  parent: screen,
  left: 0,
  right: 0,
  bottom: 0,
  height: 1,
  tags: true,
  style: { bg: theme.background, fg: theme.muted },
});

screen.on("keypress", handleKeypress);

/**
 * @param {string | undefined} character
 * @param {import("@unblessed/core").KeyEvent} key
 */
function handleKeypress(character, key) {
  if (key.full === "C-c") close();

  if (model.searchMode) {
    if (key.name === "escape") {
      model.clearSearch();
    } else if (key.name === "enter") {
      selectWorkspace();
      return;
    } else if (key.name === "up") {
      model.move(-1);
    } else if (key.name === "down") {
      model.move(1);
    } else if (key.name === "backspace") {
      model.backspaceSearch();
    } else if (isSearchCharacter(character)) {
      model.appendSearch(character);
    } else {
      return;
    }
    render();
    return;
  }

  if (key.name === "escape") {
    close();
  } else if (character === "/") {
    model.startSearch();
    render();
  } else if (key.name === "enter") {
    selectWorkspace();
  } else if (key.name === "up") {
    model.move(-1);
    render();
  } else if (key.name === "down") {
    model.move(1);
    render();
  } else if (character === "d") {
    model.move(Math.max(1, Math.floor(content.height / 2)));
    render();
  } else if (character === "u") {
    model.move(-Math.max(1, Math.floor(content.height / 2)));
    render();
  } else if (character === "g") {
    model.selectedIndex = 0;
    render();
  } else if (character === "G") {
    model.selectedIndex = Math.max(0, model.entries.length - 1);
    render();
  }
}

render();

function render() {
  const rows = buildWorkspaceRows(model.filteredHistory, model.selectedIndex);
  content.setContent(rows.map(renderRow).join("\n"));

  const selectedRow = rows.findIndex((row) => row.kind === "entry" && row.selected);
  const visibleRows = Math.max(1, content.height);
  if (selectedRow < scrollOffset) {
    scrollOffset = selectedRow;
  } else if (selectedRow >= scrollOffset + visibleRows) {
    scrollOffset = selectedRow - visibleRows + 1;
  }
  scrollOffset = Math.max(0, scrollOffset);
  content.scrollTo?.(scrollOffset);

  if (errorMessage) {
    status.setContent(`{${theme.error}-fg} ${escape(errorMessage)}{/}`);
  } else if (model.searchMode) {
    status.setContent(`{${theme.muted}-fg} / ${escape(model.searchQuery)}_{/}`);
  } else {
    status.setContent(`{${theme.muted}-fg} ${KEY_LEGEND}{/}`);
  }
  screen.render();
}

/** @param {import("./view.js").WorkspaceRow} row */
function renderRow(row) {
  if (row.kind === "heading") return `{${theme.muted}-fg}${row.text}{/}`;
  if (row.kind === "spacer") return "";

  const prefix = row.selected ? "   > " : "     ";
  const color = row.selected ? theme.accent : theme.text;
  const branch = row.entry.branch ? `{${theme.muted}-fg} [${escape(row.entry.branch)}]{/}` : "";
  return `{${color}-fg}${prefix}${escape(basename(row.entry.dir))}{/}${branch}`;
}

function selectWorkspace() {
  const selected = model.selectedEntry();
  if (!selected) return;
  try {
    openWorkspace(selected.dir, readSnapshot());
    close();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    render();
  }
}

function close() {
  screen.destroy();
  process.exit(0);
}

/**
 * @param {unknown} character
 * @returns {character is string}
 */
function isSearchCharacter(character) {
  return typeof character === "string" && /^[a-zA-Z0-9\-_./@ {}#~+=]$/.test(character);
}

/** @param {string} name */
function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing environment variable: ${name}`);
  return value;
}
