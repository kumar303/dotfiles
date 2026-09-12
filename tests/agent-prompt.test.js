// @ts-check

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const promptScriptPath = join(repositoryRoot, "dotfiles", ".vim", "bin", "agent-prompt.js");
const vimrcPath = join(repositoryRoot, "dotfiles", ".vimrc");
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
/** @type {NodeJS.ProcessEnv} */
let pluginEnvironment;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "agent-prompt-"));
  stateDirectory = join(testDirectory, "plugin-state");
  herdrLogPath = join(testDirectory, "herdr-calls.log");
  herdrStatePath = join(testDirectory, "herdr-state.json");
  mkdirSync(stateDirectory);
  writeFileSync(herdrLogPath, "");
  writeFileSync(join(testDirectory, "counter"), "100\n");
  writeHerdrState({ agents: [], panes: [], processName: "zsh" });
  pluginEnvironment = {
    ...process.env,
    HERDR_BIN_PATH: mockHerdrPath,
    HERDR_PROMPT_WORKSPACE_ID: "w1",
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
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("Vim agent prompt", () => {
  it("captures a relative Vim location and optional visual selection", () => {
    const sourceDirectory = join(testDirectory, "src");
    const sourcePath = join(sourceDirectory, "example.ts");
    const normalContextPath = join(testDirectory, "normal-context.json");
    const visualContextPath = join(testDirectory, "visual-context.json");
    const scriptPath = join(testDirectory, "capture.vim");
    mkdirSync(sourceDirectory);
    writeFileSync(sourcePath, "alpha\nbeta value\ngamma\n");
    writeFileSync(
      scriptPath,
      `execute 'edit ' . fnameescape($VIM_TEST_SOURCE)
normal! 3G
let context_path = CaptureAgentPromptContext(0)
call writefile(readfile(context_path), $VIM_TEST_NORMAL_CONTEXT)
normal! 2G0v4l
let context_path = CaptureAgentPromptContext(1)
call writefile(readfile(context_path), $VIM_TEST_VISUAL_CONTEXT)
qa!
`,
    );

    const result = spawnSync("vim", ["-Nu", vimrcPath, "-n", "-es", "-S", scriptPath], {
      cwd: testDirectory,
      encoding: "utf8",
      env: {
        ...process.env,
        HERDR_PANE_ID: "w1:p2",
        VIM_TEST_NORMAL_CONTEXT: normalContextPath,
        VIM_TEST_SOURCE: sourcePath,
        VIM_TEST_VISUAL_CONTEXT: visualContextPath,
      },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const context = JSON.parse(readFileSync(visualContextPath, "utf8"));
    expect(JSON.parse(readFileSync(normalContextPath, "utf8"))).toEqual({
      file: "src/example.ts",
      line: 3,
      selection: "",
    });
    expect(context).toEqual({
      file: "src/example.ts",
      line: 2,
      selection: "beta ",
    });
  });

  it("opens a terminal popup from Vim with the captured context", () => {
    const sourcePath = join(testDirectory, "example.ts");
    const resultPath = join(testDirectory, "popup.json");
    const scriptPath = join(testDirectory, "open.vim");
    writeFileSync(sourcePath, "alpha\nbeta\n");
    writeFileSync(
      scriptPath,
      `execute 'edit ' . fnameescape($VIM_TEST_SOURCE)
normal! 2G
let g:agent_prompt_command = ['sh', '-c', 'sleep 1']
let popup = OpenAgentPrompt(0)
call writefile([json_encode({'mapping': maparg('<C-a>', 'n'), 'popup': popup_getpos(popup)})], $VIM_TEST_RESULT)
call popup_close(popup)
qa!
`,
    );

    const result = spawnSync("vim", ["-Nu", vimrcPath, "-n", "-es", "-S", scriptPath], {
      cwd: testDirectory,
      encoding: "utf8",
      env: {
        ...pluginEnvironment,
        HERDR_PANE_ID: "w1:p2",
        HERDR_TAB_ID: "w1:t1",
        HERDR_WORKSPACE_ID: "w1",
        VIM_TEST_RESULT: resultPath,
        VIM_TEST_SOURCE: sourcePath,
      },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const state = JSON.parse(readFileSync(resultPath, "utf8"));
    expect(state.mapping).toContain("OpenAgentPrompt(0)");
    expect(state.popup.visible).toBe(1);
    expect(state.popup.width).toBeGreaterThan(0);
    expect(state.popup.height).toBeGreaterThan(0);
    expect(herdrCalls()).toEqual([]);
  });

  it("auto-selects the sole workspace agent and sends the completed prompt", () => {
    writeHerdrState({
      agents: [agent("w1:p1", "w1", "pi")],
      panes: [],
      processName: "zsh",
    });
    writeContext({
      file: "src/example.ts",
      line: 7,
      selection: "const answer = 42;",
    });

    const result = runPrompt("Explain this\r");

    const text = stripTerminalControls(result.stdout);
    expect(text).toContain("src/example.ts:7");
    expect(text).toContain("> const answer = 42;");
    expect(herdrCalls()).toEqual([
      ["agent", "list"],
      ["agent", "prompt", "w1:p1", "src/example.ts:7\n> const answer = 42;\n\nExplain this"],
    ]);
  });

  it("uses Up and Down to select among workspace agents", () => {
    writeHerdrState({
      agents: [
        agent("w1:p1", "w1", "planner"),
        agent("w1:p3", "w1", "reviewer"),
        agent("w2:p1", "w2", "other"),
      ],
      panes: [],
      processName: "zsh",
    });

    const result = runPrompt("\x1b[BReview this\r");
    const text = stripTerminalControls(result.stdout);

    expect(text).toContain("planner");
    expect(text).toContain("reviewer");
    expect(text).not.toContain("other");
    expect(text).toMatch(/↑\/↓.*agent.*•.*enter.*send.*•.*esc.*close/s);
    expect(herdrCalls()).toEqual([
      ["agent", "list"],
      ["agent", "prompt", "w1:p3", "Review this"],
    ]);
  });

  it("closes on Escape without sending a prompt", () => {
    writeHerdrState({
      agents: [agent("w1:p1", "w1", "pi")],
      panes: [],
      processName: "zsh",
    });

    runPrompt("Do not send\x1b");

    expect(herdrCalls()).toEqual([["agent", "list"]]);
  });
});

/**
 * @param {string} paneId
 * @param {string} workspaceId
 * @param {string} name
 */
function agent(paneId, workspaceId, name) {
  return {
    agent: "pi",
    agent_status: "idle",
    name,
    pane_id: paneId,
    workspace_id: workspaceId,
  };
}

/** @param {{file: string, line: number, selection: string}} context */
function writeContext(context) {
  const path = join(stateDirectory, "context-w1_p2.json");
  writeFileSync(path, `${JSON.stringify(context)}\n`);
  pluginEnvironment.HERDR_PROMPT_CONTEXT_FILE = path;
}

/** @param {string} input */
function runPrompt(input) {
  const result = spawnSync(process.execPath, [promptScriptPath], {
    cwd: testDirectory,
    encoding: "utf8",
    env: pluginEnvironment,
    input,
    timeout: 10000,
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  return { stdout: result.stdout, stderr: result.stderr };
}

/**
 * @param {{agents: unknown[], panes: unknown[], processName: string}} state
 */
function writeHerdrState(state) {
  writeFileSync(
    herdrStatePath,
    `${JSON.stringify({
      result: {
        agents: state.agents,
        panes: state.panes,
        process_name: state.processName,
        snapshot: { panes: state.panes, workspaces: [] },
      },
    })}\n`,
  );
}

/** @returns {string[][]} */
function herdrCalls() {
  return readFileSync(herdrLogPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

/** @param {string} value */
function stripTerminalControls(value) {
  return value
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\r\x00-\x08\x0b-\x1f\x7f]/g, "");
}
