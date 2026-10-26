// @ts-check

import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const vimrcPath = join(repositoryRoot, "dotfiles", ".vimrc");

/** @type {string} */
let testDirectory;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "vim-github-"));
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("OpenCurrentFileOnGitHub", () => {
  it.each([
    ["GitHub", "git@github.com:owner/repo.git", "owner/repo"],
    ["Gitstream", "https://gitstream.shopify.io/shop/world.git", "shop/world"],
    ["Delta", "https://delta.shopify.io/shop/world.git", "shop/world"],
  ])("opens a %s origin on GitHub's main branch", (_name, remote, githubRepository) => {
    const { sourceFile, openLog } = createRepository(remote);

    const result = spawnSync(
      "vim",
      [
        "-Nu",
        vimrcPath,
        "-n",
        "-es",
        sourceFile,
        "-c",
        "call cursor(2, 1)",
        "-c",
        "call OpenCurrentFileOnGitHub()",
        "-c",
        "qa!",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          OPEN_LOG: openLog,
          PATH: `${testDirectory}:${process.env.PATH}`,
        },
      },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(readFileSync(openLog, "utf8")).toBe(
      `https://github.com/${githubRepository}/blob/main/a%20directory/example.js#L2`,
    );
  });

  it.each([
    ["one selected line", "2GV", "#L2"],
    ["part of a line", "2G0v2l", "#L2"],
    ["a forward line range", "1GV3G", "#L1-L3"],
    ["a backward line range", "3GV1G", "#L1-L3"],
    ["a block selection", "1G0\\<C-v>2j", "#L1-L3"],
  ])("opens %s with Ctrl+G", (_name, selection, fragment) => {
    const { sourceFile, openLog } = createRepository("https://delta.shopify.io/shop/world.git");
    const result = spawnSync(
      "vim",
      [
        "-Nu",
        vimrcPath,
        "-i",
        "NONE",
        "-n",
        "-es",
        sourceFile,
        "-c",
        `call feedkeys("${selection}\\<C-g>", 'xt')`,
        "-c",
        "qa!",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          OPEN_LOG: openLog,
          PATH: `${testDirectory}:${process.env.PATH}`,
          VIM_OPEN_FILE_SWITCHER_STATE_DIR: join(testDirectory, "history"),
        },
      },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(existsSync(openLog)).toBe(true);
    expect(readFileSync(openLog, "utf8")).toBe(
      `https://github.com/shop/world/blob/main/a%20directory/example.js${fragment}`,
    );
  });
});

/** @param {string} remote */
function createRepository(remote) {
  const repository = join(testDirectory, "project");
  const sourceDirectory = join(repository, "a directory");
  const sourceFile = join(sourceDirectory, "example.js");
  const openLog = join(testDirectory, "open.log");
  const fakeOpen = join(testDirectory, "open");

  execFileSync("mkdir", ["-p", sourceDirectory]);
  writeFileSync(sourceFile, "one\ntwo\nthree\n");
  writeFileSync(fakeOpen, '#!/bin/sh\nprintf "%s" "$1" > "$OPEN_LOG"\n');
  chmodSync(fakeOpen, 0o755);
  execFileSync("git", ["init", "-q", repository]);
  execFileSync("git", ["-C", repository, "remote", "add", "origin", remote]);
  return { sourceFile, openLog };
}
