// @ts-check

import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  it("opens the current line on the main branch of the origin repository", () => {
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
    execFileSync("git", [
      "-C",
      repository,
      "remote",
      "add",
      "origin",
      "git@github.com:owner/repo.git",
    ]);

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
      "https://github.com/owner/repo/blob/main/a%20directory/example.js#L2",
    );
  });
});
