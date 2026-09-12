// @ts-check

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const vimrcPath = join(repositoryRoot, "dotfiles", ".vimrc");
const mockHerdrPath = join(repositoryRoot, "tests", "fixtures", "mock-herdr.js");

/** @type {string} */
let testDirectory;
/** @type {string} */
let herdrLogPath;
/** @type {string} */
let herdrStatePath;
/** @type {NodeJS.ProcessEnv} */
let vimEnvironment;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "agent-prompt-"));
  herdrLogPath = join(testDirectory, "herdr-calls.log");
  herdrStatePath = join(testDirectory, "herdr-state.json");
  writeFileSync(herdrLogPath, "");
  writeFileSync(join(testDirectory, "counter"), "100\n");
  writeHerdrState([]);
  vimEnvironment = {
    ...process.env,
    HERDR_BIN_PATH: mockHerdrPath,
    HERDR_MOCK_COUNTER: join(testDirectory, "counter"),
    HERDR_MOCK_LOG: herdrLogPath,
    HERDR_MOCK_PANES: herdrStatePath,
    HERDR_PANE_ID: "w1:p2",
    HERDR_TAB_ID: "w1:t1",
    HERDR_WORKSPACE_ID: "w1",
  };
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("Vim agent prompt", () => {
  it("captures the full visual selection with a relative location", () => {
    const sourceDirectory = join(testDirectory, "src");
    const sourcePath = join(sourceDirectory, "example.ts");
    const resultPath = join(testDirectory, "context.json");
    mkdirSync(sourceDirectory);
    writeFileSync(sourcePath, "alpha\nbeta value\ngamma\n");

    runVim(
      `execute 'edit ' . fnameescape($VIM_TEST_SOURCE)
normal! 2G0vG4l
execute "normal! \\<Esc>"
call cursor(2, 1)
call writefile([json_encode(CaptureAgentPromptContext(1))], $VIM_TEST_RESULT)
qa!
`,
      {
        VIM_TEST_RESULT: resultPath,
        VIM_TEST_SOURCE: sourcePath,
      },
    );

    expect(JSON.parse(readFileSync(resultPath, "utf8"))).toEqual({
      file: "src/example.ts",
      line: 2,
      selection: "beta value\ngamma",
    });
  });

  it("builds a clean fzf overlay with the shared light-theme options", () => {
    writeHerdrState(
      [
        agent("w1:p1", "w1", "planner", "w1:t1"),
        agent("w1:p3", "w1", "reviewer", "w1:t2"),
        agent("w2:p1", "w2", "other", "w2:t1"),
      ],
      [
        { label: "agent", number: 1, tab_id: "w1:t1" },
        { number: 2, tab_id: "w1:t2" },
      ],
    );
    const sourcePath = join(testDirectory, "example.ts");
    const resultPath = join(testDirectory, "state.json");
    writeFileSync(sourcePath, "alpha\n");

    runVim(
      `execute 'edit ' . fnameescape($VIM_TEST_SOURCE)
let state = AgentPromptState(0)
call writefile([json_encode({'mapping': maparg('<C-a>', 'n'), 'options': AgentPromptOptions(state), 'state': state})], $VIM_TEST_RESULT)
qa!
`,
      {
        VIM_TEST_RESULT: resultPath,
        VIM_TEST_SOURCE: sourcePath,
      },
    );

    const result = JSON.parse(readFileSync(resultPath, "utf8"));
    expect(result.mapping).toContain("OpenAgentPrompt(0)");
    expect(result.state.entries).toEqual([
      "w1:p1\tplanner  idle  tab:agent",
      "w1:p3\treviewer  idle  tab:2",
    ]);
    expect(result.options).toContain("--phony");
    expect(result.options).toContain("--print-query");
    expect(result.options).toContain("--footer=↑/↓ agent  •  enter send  •  esc close");
    expect(result.options).toContain(
      "--color=fg:#403f53,bg:#fbfbfb,hl:#994cc3,fg+:#403f53,bg+:#d3e8f8,hl+:#994cc3,prompt:#0c969b,pointer:#e64d49,marker:#2aa298,spinner:#4876d6,header:#5f7e97",
    );
    expect(herdrCalls()).toEqual([
      ["agent", "list"],
      ["tab", "list", "--workspace", "w1"],
    ]);
  });

  it("places the fzf overlay beside the source pane like the symbol overlay", () => {
    const resultPath = join(testDirectory, "popup-layout.json");

    runVim(
      `set columns=180 lines=60
let state = {'context': join(['file.ts:1', '> one', '> two', '> three', '> four', '> five', '> six', '> seven'], "\\n"), 'entries': ["w1:p1\\tplanner  idle", "w1:p2\\treviewer  idle", "w1:p3\\ttester  idle", "w1:p4\\twriter  idle"]}
let single = {'actual': AgentPromptPopupWindow(state), 'expected': SymbolPopupLayout()}
vsplit
wincmd h
let left = {'actual': AgentPromptPopupWindow(state), 'expected': SymbolPopupLayout()}
wincmd l
let right = {'actual': AgentPromptPopupWindow(state), 'expected': SymbolPopupLayout()}
call writefile([json_encode({'single': single, 'left': left, 'right': right})], $VIM_TEST_RESULT)
qa!
`,
      { VIM_TEST_RESULT: resultPath },
    );

    const layouts = JSON.parse(readFileSync(resultPath, "utf8"));
    for (const layout of [layouts.single, layouts.left, layouts.right]) {
      expect(layout.actual).toEqual({
        border: layout.expected.border,
        height: 17,
        width: layout.expected.width,
        xoffset: layout.expected.xoffset,
        yoffset: layout.expected.yoffset,
      });
      expect(layout.actual.height).toBeLessThanOrEqual(layout.expected.height);
    }
  });

  it("marks an active overlay until fzf exits", () => {
    const resultPath = join(testDirectory, "active-marker.json");

    runVim(
      `let $HERDR_SPLIT_VIM_STATE_DIR = $VIM_TEST_STATE
call ActivateAgentPrompt()
let marker = g:agent_prompt_marker
let active = filereadable(marker)
call AgentPromptExit(130)
sleep 10m
call writefile([json_encode({'active': active, 'closed': !filereadable(marker), 'marker': marker})], $VIM_TEST_RESULT)
qa!
`,
      { VIM_TEST_RESULT: resultPath, VIM_TEST_STATE: join(testDirectory, "state") },
    );

    expect(JSON.parse(readFileSync(resultPath, "utf8"))).toEqual({
      active: 1,
      closed: 1,
      marker: join(testDirectory, "state", "agent-prompts", "w1__w1_t1"),
    });
  });

  it("auto-selects the sole agent and sends context plus typed text", () => {
    writeHerdrState([agent("w1:p1", "w1", "pi")]);
    const sourcePath = join(testDirectory, "example.ts");
    writeFileSync(sourcePath, "alpha\nbeta\n");

    runVim(
      `execute 'edit ' . fnameescape($VIM_TEST_SOURCE)
normal! 2G
let g:agent_prompt_context = AgentPromptContext(CaptureAgentPromptContext(0))
call AgentPromptResults(['Explain this', "w1:p1\tpi  idle"])
qa!
`,
      { VIM_TEST_SOURCE: sourcePath },
    );

    expect(herdrCalls()).toEqual([["agent", "prompt", "w1:p1", "example.ts:2\n\nExplain this"]]);
  });

  it("sends to the agent selected with fzf navigation", () => {
    const sourcePath = join(testDirectory, "example.ts");
    writeFileSync(sourcePath, "alpha\n");

    runVim(
      `execute 'edit ' . fnameescape($VIM_TEST_SOURCE)
let g:agent_prompt_context = "example.ts:1\\n> alpha"
call AgentPromptResults(['Review this', "w1:p3\treviewer  idle"])
qa!
`,
      { VIM_TEST_SOURCE: sourcePath },
    );

    expect(herdrCalls()).toEqual([
      ["agent", "prompt", "w1:p3", "example.ts:1\n> alpha\n\nReview this"],
    ]);
  });

  it("does not send when fzf closes without a selection", () => {
    runVim(`call AgentPromptResults([])
qa!
`);

    expect(herdrCalls()).toEqual([]);
  });
});

/**
 * @param {string} paneId
 * @param {string} workspaceId
 * @param {string} name
 * @param {string} [tabId]
 */
function agent(paneId, workspaceId, name, tabId = `${workspaceId}:t1`) {
  return {
    agent: "pi",
    agent_status: "idle",
    name,
    pane_id: paneId,
    tab_id: tabId,
    workspace_id: workspaceId,
  };
}

/**
 * @param {string} script
 * @param {NodeJS.ProcessEnv} [environment]
 */
function runVim(script, environment = {}) {
  const scriptPath = join(testDirectory, `test-${Math.random()}.vim`);
  writeFileSync(scriptPath, script);
  const result = spawnSync("vim", ["-Nu", vimrcPath, "-n", "-es", "-S", scriptPath], {
    cwd: testDirectory,
    encoding: "utf8",
    env: { ...vimEnvironment, ...environment },
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
}

/**
 * @param {unknown[]} agents
 * @param {unknown[]} [tabs]
 */
function writeHerdrState(agents, tabs = []) {
  writeFileSync(
    herdrStatePath,
    `${JSON.stringify({
      result: {
        agents,
        panes: [],
        snapshot: { panes: [], workspaces: [] },
        tabs,
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
