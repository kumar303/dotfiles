// @ts-check

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @type {string} */
let testDirectory;
/** @type {string} */
let homeDirectory;
/** @type {string} */
let binDirectory;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "dotfiles-setup-"));
  homeDirectory = join(testDirectory, "home");
  binDirectory = join(testDirectory, "bin");
  mkdirSync(homeDirectory);
  mkdirSync(binDirectory);
  writeExecutable(join(binDirectory, "npm"), "#!/bin/sh\nexit 0\n");
  writeExecutable(join(binDirectory, "herdr"), "#!/bin/sh\nexit 0\n");
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("setup", () => {
  it("replaces a dangling parent symlink before linking nested files", () => {
    const vimDirectory = join(homeDirectory, ".vim");
    symlinkSync(join(homeDirectory, "missing-vim"), vimDirectory);

    runSetup("y\n");

    expect(lstatSync(vimDirectory).isDirectory()).toBe(true);
    expect(readlinkSync(join(vimDirectory, "workflows", "list-symbols.vim"))).toBe(
      join(repositoryRoot, "dotfiles", ".vim", "workflows", "list-symbols.vim"),
    );
  });

  it("recognizes an existing zsh include with an equivalent path", () => {
    const zshrcPath = join(homeDirectory, ".zshrc");
    writeFileSync(zshrcPath, "source ~/.config/zsh/dotfiles.zsh\n");

    runSetup();

    expect(readFileSync(zshrcPath, "utf8")).toBe("source ~/.config/zsh/dotfiles.zsh\n");
  });

  it("includes the shared zsh additions once and makes the workspace helper usable", () => {
    const zshrcPath = join(homeDirectory, ".zshrc");
    writeFileSync(zshrcPath, "export EXISTING_SETTING=1\n");

    runSetup();
    runSetup();

    const sourceLine = 'source "$HOME/.config/zsh/dotfiles.zsh"';
    const zshrc = readFileSync(zshrcPath, "utf8");
    expect(zshrc).toContain("export EXISTING_SETTING=1");
    expect(zshrc.split(sourceLine)).toHaveLength(2);

    const additionsPath = join(homeDirectory, ".config", "zsh", "dotfiles.zsh");
    expect(readlinkSync(additionsPath)).toBe(
      join(repositoryRoot, "dotfiles", ".config", "zsh", "dotfiles.zsh"),
    );

    const otherDirectory = join(testDirectory, "other workspace");
    mkdirSync(otherDirectory);
    const result = spawnSync(
      "zsh",
      [
        "-c",
        'herdr() { printf "%s\\n" "$@"; }; source "$1"; herdr-workspace-create .; herdr-workspace-create "$2"',
        "zsh",
        additionsPath,
        otherDirectory,
      ],
      { cwd: homeDirectory, encoding: "utf8" },
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      `workspace\ncreate\n--cwd\n${realpathSync(homeDirectory)}\n--focus\nworkspace\ncreate\n--cwd\n${realpathSync(otherDirectory)}\n--focus\n`,
    );
  });
});

/** @param {string} [input] */
function runSetup(input = "") {
  const result = spawnSync("bash", [join(repositoryRoot, "setup.sh")], {
    cwd: repositoryRoot,
    encoding: "utf8",
    input,
    env: {
      ...process.env,
      HOME: homeDirectory,
      PATH: `${binDirectory}:${process.env.PATH}`,
    },
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
}

/**
 * @param {string} path
 * @param {string} content
 */
function writeExecutable(path, content) {
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}
