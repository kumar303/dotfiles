// @ts-check

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = join(repositoryRoot, "plugins", "workspace-leaf-name", "workspace-leaf-name.js");
const mockHerdrPath = join(repositoryRoot, "tests", "fixtures", "mock-herdr.js");

/** @type {string} */
let testDirectory;
/** @type {string} */
let herdrLogPath;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "workspace-leaf-name-"));
  herdrLogPath = join(testDirectory, "herdr-calls.log");
  writeFileSync(herdrLogPath, "");
  writeFileSync(join(testDirectory, "panes.json"), '{"result":{"panes":[]}}\n');
  writeFileSync(join(testDirectory, "counter"), "100\n");
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("workspace-leaf-name", () => {
  it("renames a created workspace to its directory leaf", () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        HERDR_BIN_PATH: mockHerdrPath,
        HERDR_MOCK_COUNTER: join(testDirectory, "counter"),
        HERDR_MOCK_LOG: herdrLogPath,
        HERDR_MOCK_PANES: join(testDirectory, "panes.json"),
        HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify({
          workspace_id: "w7",
          workspace_cwd: "/tmp/project/checkout-web",
        }),
      },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(herdrCalls()).toEqual([["workspace", "rename", "w7", "checkout-web"]]);
  });
});

/** @returns {string[][]} */
function herdrCalls() {
  return readFileSync(herdrLogPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
