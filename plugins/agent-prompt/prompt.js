#!/usr/bin/env node
// @ts-check

import "./runtime.js";
import { Box, Screen, escape } from "@unblessed/core";
import { readFileSync, rmSync } from "node:fs";
import { listWorkspaceAgents, promptAgent } from "./herdr.js";

/**
 * @typedef {object} PromptContext
 * @property {string} file
 * @property {number} line
 * @property {string} selection
 */

const KEY_LEGEND = "↑/↓ agent  •  enter send  •  esc close";
const workspaceId = requiredEnvironment("HERDR_ACTIVE_WORKSPACE_ID");
const agents = listWorkspaceAgents(workspaceId);
const initialPrompt = readInitialPrompt();
let prompt = initialPrompt ? `${initialPrompt}\n\n` : "";
let selectedIndex = 0;
let errorMessage = "";

const screen = new Screen({ smartCSR: true, title: "Prompt agent" });
const agentHeight = agents.length > 1 ? Math.min(7, agents.length + 2) : 3;
const agentList = new Box({
  parent: screen,
  top: 0,
  left: 0,
  right: 0,
  height: agentHeight,
  tags: true,
  label: " Agent ",
  border: "line",
  style: {
    bg: "black",
    border: { fg: "gray" },
    fg: "white",
    label: { fg: "gray" },
  },
});
const promptBox = new Box({
  parent: screen,
  top: agentHeight,
  left: 0,
  right: 0,
  bottom: 1,
  tags: true,
  scrollable: true,
  alwaysScroll: true,
  label: " Prompt ",
  border: "line",
  style: {
    bg: "black",
    border: { fg: "blue" },
    fg: "white",
    label: { fg: "blue" },
  },
});
const status = new Box({
  parent: screen,
  left: 0,
  right: 0,
  bottom: 0,
  height: 1,
  tags: true,
  style: { bg: "black", fg: "gray" },
});

screen.on("keypress", handleKeypress);
render();

/**
 * @param {string | undefined} character
 * @param {import("@unblessed/core").KeyEvent} key
 */
function handleKeypress(character, key) {
  if (key.name === "escape" || key.full === "C-c") {
    close();
  } else if (key.name === "enter") {
    sendPrompt();
  } else if (key.name === "up") {
    moveAgent(-1);
  } else if (key.name === "down") {
    moveAgent(1);
  } else if (key.name === "backspace") {
    prompt = Array.from(prompt).slice(0, -1).join("");
  } else if (isPromptCharacter(character)) {
    prompt += character;
  } else {
    return;
  }
  render();
}

function render() {
  renderAgents();
  promptBox.setContent(`${escape(prompt)}_`);
  promptBox.setScrollPerc?.(100);
  status.setContent(
    errorMessage ? `{red-fg} ${escape(errorMessage)}{/}` : `{gray-fg} ${KEY_LEGEND}{/}`,
  );
  screen.render();
}

function renderAgents() {
  if (agents.length === 0) {
    agentList.setContent(" {red-fg}No agents in this workspace{/}");
    return;
  }

  const visibleCount = Math.max(1, agentHeight - 2);
  const start = Math.min(
    Math.max(0, selectedIndex - visibleCount + 1),
    Math.max(0, agents.length - visibleCount),
  );
  agentList.setContent(
    agents
      .slice(start, start + visibleCount)
      .map((agent, index) => {
        const selected = start + index === selectedIndex;
        const prefix = selected ? "> " : "  ";
        const color = selected ? "blue" : "white";
        return `{${color}-fg} ${prefix}${escape(agent.label)}{/}{gray-fg}  ${escape(agent.status)}{/}`;
      })
      .join("\n"),
  );
}

/** @param {number} direction */
function moveAgent(direction) {
  if (agents.length < 2) return;
  selectedIndex = (selectedIndex + direction + agents.length) % agents.length;
}

function sendPrompt() {
  const agent = agents[selectedIndex];
  const text = prompt.trimEnd();
  if (!agent) {
    errorMessage = "No agent is available in this workspace";
    return;
  }
  if (!text) {
    errorMessage = "Enter a prompt";
    return;
  }

  try {
    promptAgent(agent.paneId, text);
    close();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }
}

function readInitialPrompt() {
  const path = process.env.HERDR_PROMPT_CONTEXT_FILE;
  if (!path) return "";

  try {
    const value = /** @type {unknown} */ (JSON.parse(readFileSync(path, "utf8")));
    if (!isPromptContext(value)) return "";
    const location = `${value.file}:${value.line}`;
    if (!value.selection) return location;
    const quote = value.selection
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    return `${location}\n${quote}`;
  } finally {
    rmSync(path, { force: true });
  }
}

/**
 * @param {unknown} value
 * @returns {value is PromptContext}
 */
function isPromptContext(value) {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (/** @type {any} */ (value).file) === "string" &&
    Number.isInteger(/** @type {any} */ (value).line) &&
    typeof (/** @type {any} */ (value).selection) === "string"
  );
}

function close() {
  screen.destroy();
  process.exit(0);
}

/** @param {unknown} character */
function isPromptCharacter(character) {
  return typeof character === "string" && character >= " " && character !== "\x7f";
}

/** @param {string} name */
function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing environment variable: ${name}`);
  return value;
}
