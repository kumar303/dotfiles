// @ts-check

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "smol-toml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDirectory = join(repositoryRoot, "plugins", "workspace-default-tabs");
const mockHerdrPath = join(repositoryRoot, "tests", "fixtures", "mock-herdr.js");

/** @type {string} */
let testDirectory;
/** @type {string} */
let herdrLogPath;
/** @type {string} */
let herdrStatePath;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "workspace-default-tabs-"));
  herdrLogPath = join(testDirectory, "herdr-calls.log");
  herdrStatePath = join(testDirectory, "panes.json");
  writeFileSync(herdrLogPath, "");
  writeFileSync(
    herdrStatePath,
    `${JSON.stringify({
      result: {
        panes: [
          {
            pane_id: "w7:p1",
            tab_id: "w7:t1",
            workspace_id: "w7",
            cwd: "/tmp/project/new-workspace",
            focused: true,
          },
        ],
      },
    })}\n`,
  );
  writeFileSync(join(testDirectory, "counter"), "100\n");
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("workspace-default-tabs", () => {
  it("creates agent and shell tabs and focuses agent after workspace creation", () => {
    emitPluginEvent("workspace.created", {
      workspace_id: "w7",
      workspace_cwd: "/tmp/project/new-workspace",
      tab_id: "w7:t1",
    });

    expect(herdrCalls()).toEqual([
      ["tab", "rename", "w7:t1", "agent"],
      [
        "tab",
        "create",
        "--workspace",
        "w7",
        "--cwd",
        "/tmp/project/new-workspace",
        "--label",
        "shell",
        "--no-focus",
      ],
      ["tab", "focus", "w7:t1"],
    ]);
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
    env: {
      ...process.env,
      HERDR_BIN_PATH: mockHerdrPath,
      HERDR_MOCK_COUNTER: join(testDirectory, "counter"),
      HERDR_MOCK_LOG: herdrLogPath,
      HERDR_MOCK_PANES: herdrStatePath,
      HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify(context),
    },
  });

  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
}

/** @returns {string[][]} */
function herdrCalls() {
  return readFileSync(herdrLogPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
