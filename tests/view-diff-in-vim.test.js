// @ts-check

import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
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

/**
 * @param {string[]} arguments_
 * @returns {any}
 */
function run(arguments_) {
  return JSON.parse(
    execFileSync(process.execPath, [scriptPath, ...arguments_], {
      cwd: testDirectory,
      encoding: "utf8",
      env: { ...process.env, VIEW_DIFF_IN_VIM_STATE_DIR: stateDirectory },
    }),
  );
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
    expect(view.locations).toEqual([
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

    expect(view.locations).toContainEqual({
      kind: "change",
      line: 1,
      path: "nested.js",
      text: "after",
    });
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
    expect(view.locations).toEqual([
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

    expect(view.locations).toEqual([{ kind: "change", line: 1, path: "kept.js", text: "after" }]);
    expect(view.signs).toEqual([{ kind: "change", line: 1, path: "kept.js" }]);
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
