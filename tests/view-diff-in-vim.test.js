// @ts-check

import { execFileSync, execSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = join(repositoryRoot, "dotfiles", ".vim", "bin", "view-diff-in-vim.js");

/** @type {string} */
let testDirectory;
/** @type {string} */
let stateDirectory;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "view-diff-in-vim-"));
  stateDirectory = mkdtempSync(join(tmpdir(), "view-diff-in-vim-state-"));
  git("init -b main");
  git("config user.email test@example.com");
  git("config user.name Test");
  writeFileSync(join(testDirectory, "example.js"), "one\ntwo\nthree\n");
  git("add example.js");
  git("commit -m base");
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
  rmSync(stateDirectory, { recursive: true, force: true });
});

/** @param {string} command */
function git(command) {
  return execSync(`git ${command}`, { cwd: testDirectory, encoding: "utf8" }).trim();
}

/** @param {string[]} arguments_ @param {NodeJS.ProcessEnv} [environment] */
function runText(arguments_, environment = {}) {
  return execFileSync(process.execPath, [scriptPath, ...arguments_], {
    cwd: testDirectory,
    encoding: "utf8",
    env: { ...process.env, ...environment, VIEW_DIFF_IN_VIM_STATE_DIR: stateDirectory },
  });
}

/**
 * @param {string[]} arguments_
 * @returns {any}
 */
function run(arguments_) {
  return JSON.parse(runText(arguments_));
}

describe("view-diff-in-vim entrypoint", () => {
  it("offers the uncommitted diff only when changes exist", () => {
    expect(run(["choices", testDirectory])).toEqual([{ id: "branch", label: "Branch diff" }]);

    writeFileSync(join(testDirectory, "example.js"), "one\nchanged\nthree\n");

    expect(run(["choices", testDirectory])).toEqual([
      { id: "working", label: "Uncommitted diff" },
      { id: "branch", label: "Branch diff" },
    ]);
  });

  it("stores an uncommitted view and reports hunk locations and gutter signs", () => {
    writeFileSync(join(testDirectory, "example.js"), "one\nchanged\nthree\nfour\n");
    writeFileSync(join(testDirectory, "new file.js"), "alpha\nbeta\n");

    const view = run(["start", testDirectory, "working"]);

    expect(view).toMatchObject({ mode: "working", position: 1 });
    expect(view.locations).toMatchObject([
      { kind: "change", line: 2, path: "example.js", text: "changed" },
      { kind: "add", line: 4, path: "example.js", text: "four" },
      { kind: "add", line: 1, path: "new file.js", text: "alpha" },
    ]);
    expect(view.signs).toEqual([
      { kind: "change", line: 2, path: "example.js" },
      { kind: "add", line: 4, path: "example.js" },
      { kind: "add", line: 1, path: "new file.js" },
      { kind: "add", line: 2, path: "new file.js" },
    ]);
    expect(existsSync(run(["state-path", testDirectory]).path)).toBe(true);
  });

  it("recalculates the active diff and selects the location after the cursor", () => {
    writeFileSync(join(testDirectory, "example.js"), "changed one\ntwo\nchanged three\n");
    run(["start", testDirectory, "working"]);
    writeFileSync(join(testDirectory, "example.js"), "changed one\ntwo\nchanged three\nfour\n");

    const view = run(["refresh", testDirectory, "example.js", "1"]);

    expect(view.locations.map((/** @type {{line: number}} */ location) => location.line)).toEqual([
      1, 3,
    ]);
    expect(view.signs).toContainEqual({
      kind: "change",
      line: 4,
      path: "example.js",
    });
    expect(view.position).toBe(2);
  });

  it("omits deleted lines from files that still exist", () => {
    writeFileSync(join(testDirectory, "example.js"), "one\nthree\n");

    const view = run(["start", testDirectory, "working"]);

    expect(view.locations).toEqual([]);
    expect(view.signs).toEqual([]);
  });

  it("reports paths relative to a nested workspace", () => {
    const workspace = join(testDirectory, "packages", "app");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(join(workspace, "nested.js"), "before\n");
    git("add packages/app/nested.js");
    git("commit -m nested");
    writeFileSync(join(workspace, "nested.js"), "after\n");

    const view = run(["start", workspace, "working"]);

    expect(view.locations).toContainEqual(
      expect.objectContaining({
        kind: "change",
        line: 1,
        path: "nested.js",
        text: "after",
      }),
    );
    expect(view.signs).toContainEqual({ kind: "change", line: 1, path: "nested.js" });
  });

  it("uses GitStream state to compare the branch with its branch point", () => {
    const base = git("rev-parse HEAD");
    git("checkout -b feature");
    writeFileSync(join(testDirectory, "example.js"), "one\nbranch\nthree\n");
    git("add example.js");
    git("commit -m feature");
    writeFileSync(join(testDirectory, "example.js"), "one\nworking branch\nthree\n");
    git(`update-ref refs/remotes/company/trunk ${base}`);
    mkdirSync(join(testDirectory, ".git", ".gs"), { recursive: true });
    writeFileSync(
      join(testDirectory, ".git", ".gs", "state.json"),
      JSON.stringify({
        version: 1,
        branches: { feature: { parent: "trunk" } },
        trunks: { trunk: { remote: "company", target: "trunk" } },
      }),
    );

    const view = run(["start", testDirectory, "branch"]);

    expect(view).toMatchObject({
      base: { commit: base, name: "company/trunk" },
      mode: "branch",
      position: 1,
    });
    expect(view.locations).toMatchObject([
      { kind: "change", line: 2, path: "example.js", text: "working branch" },
    ]);
  });

  it("omits files deleted by a branch diff", () => {
    writeFileSync(join(testDirectory, "kept.js"), "before\n");
    git("add kept.js");
    git("commit -m kept");
    git("checkout -b feature");
    git("rm example.js");
    writeFileSync(join(testDirectory, "kept.js"), "after\n");
    git("add kept.js");
    git("commit -m changes");

    const view = run(["start", testDirectory, "branch"]);

    expect(view.locations).toMatchObject([
      { kind: "change", line: 1, path: "kept.js", text: "after" },
    ]);
    expect(view.signs).toEqual([{ kind: "change", line: 1, path: "kept.js" }]);
  });

  it("calculates the Git diff once while producing locations and cached hunks", () => {
    writeFileSync(join(testDirectory, "example.js"), "one\nchanged\nthree\n");
    const binDirectory = join(testDirectory, "bin");
    const gitLog = join(testDirectory, "git-calls");
    const realGit = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
    mkdirSync(binDirectory);
    const wrapper = join(binDirectory, "git");
    writeFileSync(
      wrapper,
      `#!/bin/sh
if [ "$1" = diff ]; then printf 'diff\\n' >> "$VIEW_DIFF_GIT_LOG"; fi
exec "${realGit}" "$@"
`,
    );
    chmodSync(wrapper, 0o755);

    const view = JSON.parse(
      runText(["start", testDirectory, "working"], {
        PATH: `${binDirectory}:${process.env.PATH}`,
        VIEW_DIFF_GIT_LOG: gitLog,
      }),
    );

    expect(readFileSync(gitLog, "utf8").trim().split("\n")).toEqual(["diff"]);
    expect(view.locations[0].hunk).toContain("+changed");
  });

  it("includes only the selected diff hunk in the calculated view", () => {
    const original = Array.from({ length: 15 }, (_, index) => `line ${index + 1}`);
    writeFileSync(join(testDirectory, "example.js"), `${original.join("\n")}\n`);
    git("add example.js");
    git("commit -m long-file");
    const changed = [...original];
    changed[0] = "changed one";
    changed[14] = "changed fifteen";
    writeFileSync(join(testDirectory, "example.js"), `${changed.join("\n")}\n`);

    const view = run(["start", testDirectory, "working"]);
    const preview = view.locations.find(
      (/** @type {{line: number}} */ location) => location.line === 1,
    ).hunk;

    expect(preview).toContain("diff --git");
    expect(preview).toContain("changed one");
    expect(preview).not.toContain("changed fifteen");
  });

  it("includes an untracked file as an added diff hunk", () => {
    writeFileSync(join(testDirectory, "new file.js"), "alpha\nbeta\n");

    const view = run(["start", testDirectory, "working"]);
    const preview = view.locations.find(
      (/** @type {{path: string}} */ location) => location.path === "new file.js",
    ).hunk;

    expect(preview).toContain("--- /dev/null");
    expect(preview).toContain("+++ new file.js");
    expect(preview).toContain("+alpha");
  });

  it("persists hidden test files until the diff session clears", () => {
    writeFileSync(join(testDirectory, "example.js"), "changed\n");
    writeFileSync(join(testDirectory, "example.test.js"), "before\n");
    git("add example.test.js");
    git("commit -m test-file");
    writeFileSync(join(testDirectory, "example.test.js"), "after\n");
    run(["start", testDirectory, "working"]);

    expect(run(["toggle-tests", testDirectory])).toEqual({ hideTests: true });
    const hidden = run(["refresh", testDirectory, "", "0"]);
    expect(hidden.hideTests).toBe(true);
    expect(hidden.locations.map((/** @type {{path: string}} */ location) => location.path)).toEqual(
      ["example.js"],
    );

    expect(run(["toggle-tests", testDirectory])).toEqual({ hideTests: false });
    expect(run(["refresh", testDirectory, "", "0"]).locations).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "example.test.js" })]),
    );
    run(["clear", testDirectory]);
    expect(run(["refresh", testDirectory, "", "0"])).toEqual({ active: false });
  });

  it("clears only the state for the selected workspace", () => {
    writeFileSync(join(testDirectory, "example.js"), "changed\n");
    run(["start", testDirectory, "working"]);
    const statePath = run(["state-path", testDirectory]).path;

    expect(run(["clear", testDirectory])).toEqual({ cleared: true });
    expect(existsSync(statePath)).toBe(false);
    expect(run(["refresh", testDirectory, "example.js", "1"])).toEqual({ active: false });
  });
});
