// @ts-check

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "smol-toml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDirectory = join(repositoryRoot, "plugins", "workspace-switcher");
const mockHerdrPath = join(repositoryRoot, "tests", "fixtures", "mock-herdr.js");
const mockTerminalPath = join(repositoryRoot, "tests", "fixtures", "mock-terminal.js");

/** @type {string} */
let testDirectory;
/** @type {string} */
let stateDirectory;
/** @type {string} */
let herdrLogPath;
/** @type {string} */
let herdrStatePath;
/** @type {string} */
let herdrConfigPath;
/** @type {NodeJS.ProcessEnv} */
let pluginEnvironment;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "workspace-switcher-"));
  stateDirectory = join(testDirectory, "plugin-state");
  herdrLogPath = join(testDirectory, "herdr-calls.log");
  herdrStatePath = join(testDirectory, "herdr-state.json");
  herdrConfigPath = join(testDirectory, "config.toml");
  mkdirSync(stateDirectory);
  writeFileSync(herdrLogPath, "");
  writeFileSync(join(testDirectory, "counter"), "100\n");
  writeHerdrSnapshot({ workspaces: [], panes: [] });
  pluginEnvironment = {
    ...process.env,
    COLORTERM: "truecolor",
    HERDR_BIN_PATH: mockHerdrPath,
    HERDR_CONFIG_PATH: herdrConfigPath,
    HERDR_MOCK_COUNTER: join(testDirectory, "counter"),
    HERDR_MOCK_LOG: herdrLogPath,
    HERDR_MOCK_PANES: herdrStatePath,
    HERDR_PLUGIN_CONTEXT_JSON: "{}",
    HERDR_PLUGIN_STATE_DIR: stateDirectory,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${mockTerminalPath}`]
      .filter(Boolean)
      .join(" "),
    TERM: "xterm-256color",
  };
  writeFileSync(herdrConfigPath, '[theme]\nname = "one-light"\n');
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("workspace-switcher plugin", () => {
  it("records branch history, deduplicates directories, and orders by recent focus", async () => {
    const checkout = createGitDirectory("checkout-web", "feature/payment");
    const dotfiles = createGitDirectory("dotfiles", "main");
    writeHerdrSnapshot({
      workspaces: [
        { workspace_id: "w1", focused: true, number: 1 },
        { workspace_id: "w2", focused: false, number: 2 },
      ],
      panes: [
        { workspace_id: "w1", cwd: checkout, focused: true },
        { workspace_id: "w2", cwd: dotfiles, focused: true },
      ],
    });

    runPlugin("record-workspace.js", { workspace_cwd: checkout });
    runPlugin("record-workspace.js", { workspace_cwd: dotfiles });
    runPlugin("record-workspace.js", { workspace_cwd: checkout });
    clearHerdrCalls();
    await runPicker("\r");

    expect(herdrCalls()).toEqual([
      ["api", "snapshot"],
      ["api", "snapshot"],
      ["workspace", "focus", "w2"],
    ]);
    expect(historyEntries().filter((entry) => entry.dir === checkout)).toHaveLength(3);
    expect(historyEntries().at(-1)).toMatchObject({
      dir: checkout,
      branch: "feature/payment",
    });
  });

  it("seeds current workspaces only on the first plugin event", () => {
    const current = createGitDirectory("current", "main");
    const other = createGitDirectory("other", "develop");
    const later = createGitDirectory("later", "release");
    writeHerdrSnapshot({
      workspaces: [
        { workspace_id: "w1", focused: false, number: 1 },
        { workspace_id: "w2", focused: true, number: 2 },
      ],
      panes: [
        { workspace_id: "w1", cwd: other, focused: true },
        { workspace_id: "w2", cwd: current, focused: true },
      ],
    });
    runPlugin("record-workspace.js", { workspace_cwd: current });

    writeHerdrSnapshot({
      workspaces: [{ workspace_id: "w3", focused: true, number: 1 }],
      panes: [{ workspace_id: "w3", cwd: later, focused: true }],
    });
    runPlugin("record-workspace.js", { workspace_cwd: current });

    expect(historyEntries().map((entry) => entry.dir)).toEqual([current, other, current, current]);
    expect(historyEntries().some((entry) => entry.dir === later)).toBe(false);
  });

  it("records a manually created workspace before it receives further use", async () => {
    const existing = createGitDirectory("existing", "main");
    const created = createGitDirectory("created", "feature/new-workspace");
    writeHistory([{ dir: existing, branch: "main", lastFocused: Date.now() - 1 }]);
    writeHerdrSnapshot({
      workspaces: [
        { workspace_id: "w1", focused: false, number: 1 },
        { workspace_id: "w2", focused: true, number: 2 },
      ],
      panes: [
        { workspace_id: "w1", cwd: existing, focused: true },
        { workspace_id: "w2", cwd: created, focused: true },
      ],
    });

    emitPluginEvent("workspace.created", {
      workspace_id: "w2",
      workspace_cwd: created,
    });
    clearHerdrCalls();
    await runPicker("/created\r");

    expect(historyEntries().at(-1)).toMatchObject({
      dir: created,
      branch: "feature/new-workspace",
    });
    expect(herdrCalls()).toEqual([
      ["api", "snapshot"],
      ["api", "snapshot"],
      ["workspace", "focus", "w2"],
    ]);
  });

  it("searches directory paths and branches before it opens a workspace", async () => {
    const checkout = createGitDirectory("checkout-web", "feature/payment");
    const dotfiles = createGitDirectory("dotfiles", "main");
    writeHistory([
      { dir: dotfiles, branch: "main", lastFocused: Date.now() },
      { dir: checkout, branch: "feature/payment", lastFocused: Date.now() - 1 },
    ]);
    writeHerdrSnapshot({
      workspaces: [
        { workspace_id: "w1", focused: true, number: 1 },
        { workspace_id: "w2", focused: false, number: 2 },
      ],
      panes: [
        { workspace_id: "w1", cwd: dotfiles, focused: true },
        { workspace_id: "w2", cwd: checkout, focused: true },
      ],
    });

    await runPicker("/payment\r");

    expect(herdrCalls()).toEqual([
      ["api", "snapshot"],
      ["api", "snapshot"],
      ["workspace", "focus", "w2"],
    ]);
  });

  it("starts on the last used workspace without changing history order", async () => {
    const current = join(testDirectory, "current");
    const previous = join(testDirectory, "previous");
    const older = join(testDirectory, "older");
    writeHistory([
      { dir: current, branch: null, lastFocused: Date.now() },
      { dir: previous, branch: null, lastFocused: Date.now() - 1 },
      { dir: older, branch: null, lastFocused: Date.now() - 2 },
    ]);
    writeHerdrSnapshot({
      workspaces: [
        { workspace_id: "w1", focused: true, number: 1 },
        { workspace_id: "w2", focused: false, number: 2 },
        { workspace_id: "w3", focused: false, number: 3 },
      ],
      panes: [
        { workspace_id: "w1", cwd: current, focused: true },
        { workspace_id: "w2", cwd: previous, focused: true },
        { workspace_id: "w3", cwd: older, focused: true },
      ],
    });

    const result = await runPicker("\r");
    const text = stripTerminalControls(result.stdout);

    expect(text.indexOf("current")).toBeLessThan(text.indexOf("previous"));
    expect(text.indexOf("previous")).toBeLessThan(text.indexOf("older"));
    expect(herdrCalls()).toEqual([
      ["api", "snapshot"],
      ["api", "snapshot"],
      ["workspace", "focus", "w2"],
    ]);
  });

  it("wraps upward from the first workspace to the last workspace", async () => {
    const first = join(testDirectory, "first");
    const last = join(testDirectory, "last");
    writeHistory([
      { dir: first, branch: null, lastFocused: Date.now() },
      { dir: last, branch: null, lastFocused: Date.now() - 1 },
    ]);

    await runPicker("\x1b[A\r");

    expect(herdrCalls()).toEqual([
      ["api", "snapshot"],
      ["api", "snapshot"],
      ["workspace", "create", "--cwd", last, "--focus"],
    ]);
  });

  it("renders Today and Earlier sections in the popup", async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    writeHistory([
      { dir: join(testDirectory, "dotfiles"), branch: "main", lastFocused: now.getTime() },
      {
        dir: join(testDirectory, "checkout-web"),
        branch: null,
        lastFocused: yesterday.getTime(),
      },
    ]);

    const result = await runPicker("\r");
    const text = stripTerminalControls(result.stdout);

    expect(text).toContain("Today");
    expect(text).toContain("dotfiles");
    expect(text).toContain("[main]");
    expect(text).toContain("Earlier");
    expect(text).toContain("checkout-web");
  });

  it("restores the Today heading when g returns from the bottom", async () => {
    const now = Date.now();
    writeHistory(
      Array.from({ length: 50 }, (_, index) => ({
        dir: join(testDirectory, `workspace-${String(index).padStart(2, "0")}`),
        branch: null,
        lastFocused: now - index,
      })),
    );

    const result = await runPicker("Gg\r");
    const lastToday = result.stdout.lastIndexOf("Today");
    const lastBottomWorkspace = result.stdout.lastIndexOf("workspace-49");

    expect(lastToday).toBeGreaterThan(lastBottomWorkspace);
  });

  it("renders a key legend at the bottom of the picker", async () => {
    const remembered = join(testDirectory, "remembered");
    writeHistory([{ dir: remembered, branch: null, lastFocused: Date.now() }]);

    const result = await runPicker("\r");

    expect(stripTerminalControls(result.stdout)).toContain(
      "↑/↓ select  •  g/G top/bottom  •  d/u page  •  enter open  •  / search  •  esc close",
    );
  });

  it("opens its picker through Herdr's plugin pane command", () => {
    runPlugin("open.js");

    expect(herdrCalls()).toEqual([
      [
        "plugin",
        "pane",
        "open",
        "--plugin",
        "kumar303.workspace-switcher",
        "--entrypoint",
        "picker",
      ],
    ]);
  });

  it("focuses an open workspace when a pane uses the selected directory", async () => {
    const nested = join(testDirectory, "one", "nested");
    writeHistory([{ dir: nested, branch: null, lastFocused: Date.now() }]);
    writeHerdrSnapshot({
      workspaces: [{ workspace_id: "w1", focused: true, number: 1 }],
      panes: [{ workspace_id: "w1", cwd: nested, focused: true }],
    });

    await runPicker("\r");

    expect(herdrCalls()).toEqual([
      ["api", "snapshot"],
      ["api", "snapshot"],
      ["workspace", "focus", "w1"],
    ]);
  });

  it("creates a workspace when the selected directory is not open", async () => {
    const remembered = join(testDirectory, "remembered");
    writeHistory([{ dir: remembered, branch: null, lastFocused: Date.now() }]);

    await runPicker("\r");

    expect(herdrCalls()).toEqual([
      ["api", "snapshot"],
      ["api", "snapshot"],
      ["workspace", "create", "--cwd", remembered, "--focus"],
    ]);
  });

  it("applies Herdr's built-in theme and custom color overrides", async () => {
    const remembered = join(testDirectory, "remembered");
    const second = join(testDirectory, "second");
    writeHistory([
      { dir: remembered, branch: "main", lastFocused: Date.now() },
      { dir: second, branch: null, lastFocused: Date.now() - 1 },
    ]);
    writeFileSync(
      herdrConfigPath,
      '[theme]\nname = "one-light"\n\n[theme.custom]\naccent = "#ff0000"\npanel_bg = "#0000ff"\noverlay0 = "#00ff00"\ntext = "#123456"\n',
    );

    const result = await runPicker("\r");

    expect(result.stdout).toContain("\x1b[44;32mToday");
    expect(result.stdout).toContain("\x1b[44;31m   > remembered");
    expect(result.stdout).toContain("\x1b[44;38;5;236m     second");
  });

  it("applies Herdr's dark auto-switch theme when the terminal reports no appearance", async () => {
    const remembered = join(testDirectory, "remembered");
    writeHistory([{ dir: remembered, branch: null, lastFocused: Date.now() }]);
    writeFileSync(
      herdrConfigPath,
      '[theme]\nauto_switch = true\ndark_name = "one-dark"\nlight_name = "one-light"\n\n[theme.custom.dark]\naccent = "#ff00ff"\n',
    );

    const result = await runPicker("\r");

    expect(result.stdout).toContain("\x1b[48;5;236;35m   > remembered");
  });
});

/**
 * @param {string} eventName
 * @param {Record<string, unknown>} context
 */
function emitPluginEvent(eventName, context) {
  const manifest = /** @type {any} */ (
    parse(readFileSync(join(pluginDirectory, "herdr-plugin.toml"), "utf8"))
  );
  const event = manifest.events?.find((/** @type {any} */ candidate) => candidate.on === eventName);
  expect(event, `missing ${eventName} plugin event`).toBeDefined();
  const [command, ...args] = event.command;
  const result = spawnSync(command, args, {
    cwd: pluginDirectory,
    encoding: "utf8",
    env: { ...pluginEnvironment, HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify(context) },
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
}

/**
 * @param {string} script
 * @param {Record<string, unknown>} [context]
 */
function runPlugin(script, context = {}) {
  const result = spawnSync(process.execPath, [join(pluginDirectory, script)], {
    cwd: pluginDirectory,
    encoding: "utf8",
    env: { ...pluginEnvironment, HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify(context) },
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
}

/**
 * @param {string} input
 * @returns {{stdout: string, stderr: string}}
 */
function runPicker(input) {
  const result = spawnSync(process.execPath, [join(pluginDirectory, "picker.js")], {
    cwd: pluginDirectory,
    encoding: "utf8",
    env: pluginEnvironment,
    input,
    timeout: 10000,
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  return { stdout: result.stdout, stderr: result.stderr };
}

/** @param {{workspaces: unknown[], panes: unknown[]}} snapshot */
function writeHerdrSnapshot(snapshot) {
  writeFileSync(
    herdrStatePath,
    `${JSON.stringify({ result: { panes: snapshot.panes, snapshot } })}\n`,
  );
}

/** @param {Array<{dir: string, branch: string | null, lastFocused: number}>} entries */
function writeHistory(entries) {
  writeFileSync(
    join(stateDirectory, "workspaces.jsonl"),
    entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n",
  );
}

/** @returns {Array<{dir: string, branch: string | null, lastFocused: number}>} */
function historyEntries() {
  return readFileSync(join(stateDirectory, "workspaces.jsonl"), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/** @returns {string[][]} */
function herdrCalls() {
  return readFileSync(herdrLogPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function clearHerdrCalls() {
  writeFileSync(herdrLogPath, "");
}

/**
 * @param {string} name
 * @param {string} branch
 */
function createGitDirectory(name, branch) {
  const directory = join(testDirectory, name);
  mkdirSync(directory);
  const result = spawnSync("git", ["init", "--quiet", "--initial-branch", branch], {
    cwd: directory,
    encoding: "utf8",
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  return directory;
}

/** @param {string} value */
function stripTerminalControls(value) {
  return value
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\r\x00-\x08\x0b-\x1f\x7f]/g, "");
}
