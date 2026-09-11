// @ts-check

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const vimrcPath = join(repositoryRoot, "dotfiles", ".vimrc");

/** @type {string} */
let testDirectory;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "vim-open-files-"));
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("open file switcher", () => {
  it("selects the last focused file, focuses it, and closes it", () => {
    const firstFile = join(testDirectory, "first.ts");
    const secondFile = join(testDirectory, "second.ts");
    const resultPath = join(testDirectory, "result.json");
    const scriptPath = join(testDirectory, "test.vim");
    writeFileSync(firstFile, "first\n");
    writeFileSync(secondFile, "second\n");
    writeFileSync(
      scriptPath,
      `execute 'edit ' . fnameescape($VIM_TEST_FIRST)
execute 'vsplit ' . fnameescape($VIM_TEST_SECOND)
let state = OpenFileSwitcherState()
let selected = state.entries[state.position - 1]
call OpenFileSwitcherResults(['enter', selected])
let focused = expand('%:t')
let toggled_state = OpenFileSwitcherState()
let toggled = toggled_state.entries[toggled_state.position - 1]
call OpenFileSwitcherResults(['x', selected])
let files = []
for window_number in range(1, winnr('$'))
    call add(files, fnamemodify(bufname(winbufnr(window_number)), ':t'))
endfor
call writefile([json_encode({'selected': selected, 'focused': focused, 'toggled': toggled, 'files': files})], $VIM_TEST_RESULT)
qa!
`,
    );

    const result = spawnSync("vim", ["-Nu", vimrcPath, "-n", "-es", "-S", scriptPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        VIM_TEST_FIRST: firstFile,
        VIM_TEST_SECOND: secondFile,
        VIM_TEST_RESULT: resultPath,
      },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const state = JSON.parse(readFileSync(resultPath, "utf8"));
    expect(state.selected).toMatch(/^\d+\t.*first\.ts$/);
    expect(state.focused).toBe("first.ts");
    expect(state.toggled).toContain("second.ts");
    expect(state.files).toEqual(["second.ts"]);
  });
});
