// @ts-check

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = join(repositoryRoot, "plugins", "split-vim-above", "split-vim-above.js");
const mockHerdrPath = join(repositoryRoot, "tests", "fixtures", "mock-herdr.js");

/** @typedef {Record<string, unknown>} Pane */

/** @type {string} */
let testDirectory;
/** @type {string} */
let herdrLogPath;
/** @type {string} */
let panesPath;
/** @type {string} */
let counterPath;
/** @type {string} */
let cacheDirectory;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "split-vim-above-"));
  herdrLogPath = join(testDirectory, "herdr-calls.log");
  panesPath = join(testDirectory, "panes.json");
  counterPath = join(testDirectory, "counter");
  cacheDirectory = join(testDirectory, "cache");
  mkdirSync(cacheDirectory);
  writeFileSync(herdrLogPath, "");
  writeFileSync(counterPath, "100\n");
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("split-vim-above", () => {
  it("creates Vim in a dedicated tab and moves it above the source pane", () => {
    setPanes([sourcePane({ cwd: "/tmp/a dir" })]);

    runScript();

    expect(herdrCalls()).toContainEqual([
      "tab",
      "create",
      "--workspace",
      "w1",
      "--cwd",
      "/tmp/a dir",
      "--label",
      "vim-cache",
      "--no-focus",
    ]);
    expect(herdrCalls()).toContainEqual(["pane", "run", "w1:p101", "vim", "/tmp/a dir"]);
    expect(herdrCalls()).toContainEqual([
      "pane",
      "move",
      "w1:p101",
      "--tab",
      "w1:t1",
      "--target-pane",
      "w1:p1",
      "--split",
      "down",
      "--ratio",
      "0.8",
      "--focus",
    ]);
    expect(herdrCalls()).toContainEqual(["pane", "swap", "--pane", "w1:p101", "--direction", "up"]);
  });

  it("parks the Vim pane in a new inactive tab when toggled off", () => {
    setPanes([sourcePane()]);
    runScript();
    clearHerdrCalls();

    runScript();

    expect(herdrCalls()).toContainEqual([
      "pane",
      "move",
      "w1:p101",
      "--new-tab",
      "--workspace",
      "w1",
      "--label",
      "vim-cache",
      "--no-focus",
    ]);
    expect(herdrCommandCalls("close")).toHaveLength(0);
  });

  it("moves the same Vim process back for the same cwd", () => {
    setPanes([sourcePane({ cwd: "/tmp/project" })]);

    runScript();
    runScript();
    runScript();

    expect(commandCalls("tab", "create")).toHaveLength(1);
    expect(herdrCommandCalls("run")).toHaveLength(1);
    expect(herdrCommandCalls("move")).toHaveLength(3);
  });

  it("starts separate Vim processes for different directories", () => {
    setPanes([
      sourcePane({ cwd: "/tmp/project-one" }),
      sourcePane({
        pane_id: "w1:p2",
        terminal_id: "term_source_two",
        cwd: "/tmp/project-two",
        tab_id: "w1:t2",
        focused: false,
      }),
    ]);

    runScript({ paneId: "w1:p1" });
    runScript({ paneId: "w1:p2" });

    expect(commandCalls("tab", "create")).toHaveLength(2);
    expect(herdrCommandCalls("run")).toHaveLength(2);
  });

  it("keeps a parked Vim process indefinitely", () => {
    setPanes([sourcePane({ cwd: "/tmp/project" })]);

    runScript({ now: 1_000 });
    runScript({ now: 2_000 });
    runScript({ now: 2 * 60 * 60 * 1_000 + 1_001 });

    expect(herdrCommandCalls("close")).toHaveLength(0);
    expect(commandCalls("tab", "create")).toHaveLength(1);
    expect(herdrCommandCalls("run")).toHaveLength(1);
  });

  it("ignores a visible Vim pane in another tab and workspace", () => {
    setPanes([
      sourcePane(),
      {
        pane_id: "w2:p9",
        terminal_id: "term_other",
        cwd: "/other",
        tab_id: "w2:t9",
        workspace_id: "w2",
        focused: true,
      },
    ]);
    writePaneMarker("w2", "w2:t9", {
      pane_id: "w2:p9",
      terminal_id: "term_other",
    });

    runScript();

    expect(commandCalls("tab", "create")).toHaveLength(1);
    expect(herdrCalls()).not.toContainEqual([
      "pane",
      "move",
      "w2:p9",
      "--new-tab",
      "--workspace",
      "w2",
      "--label",
      "vim-cache",
      "--no-focus",
    ]);
  });

  it("leaves an unrelated Vim pane alone", () => {
    setPanes([
      sourcePane(),
      {
        pane_id: "w1:p8",
        terminal_id: "term_manual",
        cwd: "/current",
        tab_id: "w1:t1",
        workspace_id: "w1",
        focused: false,
        title: "vim",
      },
    ]);

    runScript();

    expect(commandCalls("tab", "create")).toHaveLength(1);
    expect(herdrCommandCalls("close")).not.toContainEqual(["pane", "close", "w1:p8"]);
  });

  it("opens instead of moving a pane whose ID matches stale state", () => {
    setPanes([sourcePane()]);
    writePaneMarker("w1", "w1:t1", {
      pane_id: "w1:p1",
      terminal_id: "old_terminal",
    });

    runScript();

    expect(commandCalls("tab", "create")).toHaveLength(1);
    expect(herdrCommandCalls("move")).not.toContainEqual(
      expect.arrayContaining(["w1:p1", "--new-tab"]),
    );
  });

  it("alternates show, park, and show with spaces in the cwd", () => {
    setPanes([sourcePane({ cwd: "/tmp/a dir" })]);

    runScript();
    runScript();
    runScript();

    expect(commandCalls("tab", "create")).toHaveLength(1);
    expect(herdrCommandCalls("run")).toContainEqual([
      "pane",
      "run",
      "w1:p101",
      "vim",
      "/tmp/a dir",
    ]);
    expect(herdrCommandCalls("move")).toHaveLength(3);
  });
});

/**
 * @param {Partial<Pane>} [overrides]
 * @returns {Pane}
 */
function sourcePane(overrides = {}) {
  return {
    pane_id: "w1:p1",
    terminal_id: "term_source",
    cwd: "/current",
    tab_id: "w1:t1",
    workspace_id: "w1",
    focused: true,
    ...overrides,
  };
}

/** @param {Pane[]} panes */
function setPanes(panes) {
  writeFileSync(panesPath, `${JSON.stringify({ result: { panes } })}\n`);
}

/**
 * @param {{paneId?: string, now?: number}} [options]
 */
function runScript(options = {}) {
  const result = spawnSync(scriptPath, {
    encoding: "utf8",
    env: {
      ...process.env,
      HERDR_BIN_PATH: mockHerdrPath,
      HERDR_COMMAND: "/invalid/herdr-command",
      HERDR_PANE_ID: options.paneId || "w1:p1",
      HERDR_PLUGIN_STATE_DIR: cacheDirectory,
      HERDR_MOCK_COUNTER: counterPath,
      HERDR_MOCK_LOG: herdrLogPath,
      HERDR_MOCK_PANES: panesPath,
      HERDR_NOW_MS: String(options.now ?? 1_000),
      HOME: testDirectory,
    },
  });

  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
}

/** @returns {string[][]} */
function herdrCalls() {
  return readCalls(herdrLogPath);
}

/**
 * @param {string} area
 * @param {string} command
 */
function commandCalls(area, command) {
  return herdrCalls().filter((args) => args[0] === area && args[1] === command);
}

/** @param {string} command */
function herdrCommandCalls(command) {
  return commandCalls("pane", command);
}

/** @param {string} path */
function readCalls(path) {
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => /** @type {string[]} */ (JSON.parse(line)));
}

function clearHerdrCalls() {
  writeFileSync(herdrLogPath, "");
}

/**
 * @param {string} workspaceId
 * @param {string} tabId
 * @param {{pane_id: string, terminal_id: string}} marker
 */
function writePaneMarker(workspaceId, tabId, marker) {
  const stateDirectory = join(cacheDirectory, "pane-markers");
  mkdirSync(stateDirectory, { recursive: true });
  const scope = `${encodeURIComponent(workspaceId)}__${encodeURIComponent(tabId)}`;
  writeFileSync(join(stateDirectory, `${scope}.json`), JSON.stringify(marker));
}
