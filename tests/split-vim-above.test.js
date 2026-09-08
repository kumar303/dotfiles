// @ts-check

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = join(repositoryRoot, "plugins", "split-vim-above", "split-vim-above.js");
const mockHerdrPath = join(repositoryRoot, "tests", "fixtures", "mock-herdr.js");

/** @typedef {Record<string, unknown>} Pane */
/** @typedef {["leaf", number] | ["row" | "col", VimLayout[]]} VimLayout */
/** @typedef {{layout: VimLayout, windows: Array<{id: number, file: string}>}} VimState */

/** @type {string} */
let testDirectory;
/** @type {string} */
let herdrLogPath;
/** @type {string} */
let panesPath;
/** @type {string} */
let counterPath;
/** @type {string} */
let stateDirectory;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "split-vim-above-"));
  herdrLogPath = join(testDirectory, "herdr-calls.log");
  panesPath = join(testDirectory, "panes.json");
  counterPath = join(testDirectory, "counter");
  stateDirectory = join(testDirectory, "state");
  mkdirSync(stateDirectory);
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
      "vim",
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

  it("saves the Vim split files and closes the pane when toggled off", () => {
    const vimState = layoutState([
      [11, "/tmp/project/a.js"],
      [22, "/tmp/project/b.js"],
    ]);
    setPanes([sourcePane({ cwd: "/tmp/project" })]);
    runScript();
    clearHerdrCalls();

    runScript({ vimState });

    expect(herdrCommandCalls("send-text")[0]?.[3]).toContain(":call writefile(");
    expect(herdrCommandCalls("send-text")).toContainEqual(["pane", "send-text", "w1:p101", ":qa!"]);
    expect(herdrCalls()).toContainEqual(["pane", "close", "w1:p101"]);
    expect(herdrCommandCalls("move")).toHaveLength(0);
    expect(readLayoutState("w1", "/tmp/project")).toEqual(vimState);
  });

  it("starts a new Vim process with the remembered split files and layout", () => {
    const a = createFile("project/a.js");
    const b = createFile("project/b.js");
    const c = createFile("project/c.js");
    const vimState = /** @type {VimState} */ ({
      layout: [
        "col",
        [
          ["leaf", 11],
          [
            "row",
            [
              ["leaf", 22],
              ["leaf", 33],
            ],
          ],
        ],
      ],
      windows: [
        { id: 11, file: a },
        { id: 22, file: b },
        { id: 33, file: c },
      ],
    });
    const cwd = join(testDirectory, "project");
    setPanes([sourcePane({ cwd })]);

    runScript();
    runScript({ vimState });
    clearHerdrCalls();
    runScript();

    const run = herdrCommandCalls("run")[0];
    expect(run?.slice(0, 5)).toEqual(["pane", "run", "w1:p102", "vim", "-S"]);
    const restoreScript = readFileSync(String(run?.[5]), "utf8");
    expect(restoreScript).toContain(
      JSON.stringify([
        "col",
        [
          ["leaf", a],
          [
            "row",
            [
              ["leaf", b],
              ["leaf", c],
            ],
          ],
        ],
      ]),
    );
  });

  it("ignores remembered files that no longer exist", () => {
    const existing = createFile("project/a.js");
    const missing = join(testDirectory, "project", "missing.js");
    const cwd = join(testDirectory, "project");
    setPanes([sourcePane({ cwd })]);
    writeLayoutState(
      "w1",
      cwd,
      layoutState([
        [11, existing],
        [22, missing],
      ]),
    );

    runScript();

    expect(herdrCommandCalls("run").at(-1)).toEqual(["pane", "run", "w1:p101", "vim", existing]);
    expect(herdrCalls().flat()).not.toContain(missing);
  });

  it("uses --file in place of the leftmost remembered split", () => {
    const first = createFile("project/a.js");
    const second = createFile("project/b.js");
    const requested = createFile("project/requested.js");
    const cwd = join(testDirectory, "project");
    setPanes([sourcePane({ cwd })]);
    writeLayoutState(
      "w1",
      cwd,
      layoutState([
        [11, first],
        [22, second],
      ]),
    );

    runScript({ filePath: requested });

    const restoreScript = restoreScriptFromLastRun();
    expect(restoreScript).toContain(requested);
    expect(restoreScript).toContain(second);
    expect(restoreScript).not.toContain(first);
  });

  it("starts separate Vim processes and stores layouts for different directories", () => {
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
    writePaneMarker("w2", "w2:t9", { pane_id: "w2:p9", terminal_id: "term_other" });

    runScript();

    expect(commandCalls("tab", "create")).toHaveLength(1);
    expect(herdrCommandCalls("close")).not.toContainEqual(["pane", "close", "w2:p9"]);
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

    expect(herdrCommandCalls("close")).not.toContainEqual(["pane", "close", "w1:p8"]);
  });

  it("starts Vim with a requested file when no layout was remembered", () => {
    setPanes([sourcePane({ cwd: "/tmp/project" })]);

    runScript({ filePath: "src/file.ts" });

    expect(herdrCommandCalls("run")).toContainEqual([
      "pane",
      "run",
      "w1:p101",
      "vim",
      "/tmp/project/src/file.ts",
    ]);
  });
});

/** @param {Array<[number, string]>} windows */
function layoutState(windows) {
  return /** @type {VimState} */ ({
    layout: ["row", windows.map(([id]) => ["leaf", id])],
    windows: windows.map(([id, file]) => ({ id, file })),
  });
}

/** @param {Partial<Pane>} [overrides] */
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
 * @param {{paneId?: string, filePath?: string, vimState?: VimState}} [options]
 */
function runScript(options = {}) {
  const args = options.filePath ? ["--file", options.filePath] : [];
  const result = spawnSync(scriptPath, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      HERDR_BIN_PATH: mockHerdrPath,
      HERDR_PANE_ID: options.paneId || "w1:p1",
      HERDR_PLUGIN_STATE_DIR: stateDirectory,
      HERDR_MOCK_COUNTER: counterPath,
      HERDR_MOCK_LOG: herdrLogPath,
      HERDR_MOCK_PANES: panesPath,
      HERDR_MOCK_VIM_LAYOUT: options.vimState ? JSON.stringify(options.vimState) : "",
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

/** @param {string} area @param {string} command */
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

/** @param {string} relativePath */
function createFile(relativePath) {
  const path = join(testDirectory, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "");
  return path;
}

/** @param {string} workspaceId @param {string} cwd */
function layoutStatePath(workspaceId, cwd) {
  const id = createHash("sha256").update(`${workspaceId}\0${cwd}`).digest("hex").slice(0, 16);
  return join(stateDirectory, "vim-layouts", `${id}.json`);
}

/** @param {string} workspaceId @param {string} cwd @param {VimState} state */
function writeLayoutState(workspaceId, cwd, state) {
  const path = layoutStatePath(workspaceId, cwd);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state)}\n`);
}

/** @param {string} workspaceId @param {string} cwd */
function readLayoutState(workspaceId, cwd) {
  return JSON.parse(readFileSync(layoutStatePath(workspaceId, cwd), "utf8"));
}

function restoreScriptFromLastRun() {
  const run = herdrCommandCalls("run").at(-1);
  expect(run?.slice(3, 5)).toEqual(["vim", "-S"]);
  return readFileSync(String(run?.[5]), "utf8");
}

/**
 * @param {string} workspaceId
 * @param {string} tabId
 * @param {{pane_id: string, terminal_id: string}} marker
 */
function writePaneMarker(workspaceId, tabId, marker) {
  const markerDirectory = join(stateDirectory, "pane-markers");
  mkdirSync(markerDirectory, { recursive: true });
  const scope = `${encodeURIComponent(workspaceId)}__${encodeURIComponent(tabId)}`;
  writeFileSync(join(markerDirectory, `${scope}.json`), JSON.stringify(marker));
}
