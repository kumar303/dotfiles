// @ts-check

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const vimrcPath = join(repositoryRoot, "dotfiles", ".vimrc");
const vimRuntimePath = join(repositoryRoot, "dotfiles", ".vim");

/** @type {string} */
let testDirectory;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "dotfiles-vim-"));
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("Vim", () => {
  it("renders TypeScript generic calls without disabling syntax highlighting", () => {
    const sourcePath = join(testDirectory, "index.ts");
    const resultPath = join(testDirectory, "result");
    const scriptPath = join(testDirectory, "check.vim");
    writeFileSync(
      sourcePath,
      [
        "async function render() {",
        "  await ctx.ui.custom<void>(() => {",
        ...Array(50).fill("    renderLine();"),
        "  });",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      scriptPath,
      [
        "set nomore",
        "set redrawtime=100",
        `execute 'edit ' . fnameescape('${vimString(sourcePath)}')`,
        "normal! G",
        "redraw!",
        "let failed = execute('messages') =~# \"'redrawtime' exceeded\"",
        `call writefile([failed ? 'failed' : 'ok'], '${vimString(resultPath)}')`,
        "qa!",
        "",
      ].join("\n"),
    );

    const result = spawnSync(
      "vim",
      [
        "-Nu",
        vimrcPath,
        "-i",
        "NONE",
        "-n",
        "-N",
        "--cmd",
        `execute 'set runtimepath^=' . fnameescape('${vimString(vimRuntimePath)}')`,
        "-S",
        scriptPath,
      ],
      { encoding: "utf8", timeout: 5000 },
    );

    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(resultPath, "utf8")).toBe("ok\n");
  });
});

/** @param {string} value */
function vimString(value) {
  return value.replaceAll("'", "''");
}
