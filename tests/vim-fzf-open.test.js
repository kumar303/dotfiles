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
  testDirectory = mkdtempSync(join(tmpdir(), "vim-fzf-open-"));
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("fzf result opening", () => {
  it.each([
    ["file", "enter", ["A.ts", "B.ts"]],
    ["file", "ctrl-o", ["B.ts"]],
    ["ripgrep", "enter", ["A.ts", "B.ts"]],
    ["ripgrep", "ctrl-o", ["B.ts"]],
  ])("opens a %s result for %s", (picker, key, expectedFiles) => {
    const firstFile = join(testDirectory, "A.ts");
    const secondFile = join(testDirectory, "B.ts");
    const resultPath = join(testDirectory, "result.json");
    const scriptPath = join(testDirectory, "test.vim");
    writeFileSync(firstFile, "first\n");
    writeFileSync(secondFile, "one\ntwo\n");
    writeFileSync(
      scriptPath,
      `execute 'edit ' . fnameescape($VIM_TEST_FIRST)
call cursor(1, 1)
if $VIM_TEST_PICKER ==# 'file'
    call OpenFileResults([$VIM_TEST_KEY, 'B.ts'])
else
    call OpenRipgrepResults([$VIM_TEST_KEY, 'B.ts:2:1:two'])
endif
let files = []
for window_number in range(1, winnr('$'))
    call add(files, fnamemodify(bufname(winbufnr(window_number)), ':t'))
endfor
call writefile([json_encode({'files': files, 'current': expand('%:t'), 'line': line('.')})], $VIM_TEST_RESULT)
qa!
`,
    );

    const result = spawnSync("vim", ["-Nu", vimrcPath, "-n", "-es", "-S", scriptPath], {
      cwd: testDirectory,
      encoding: "utf8",
      env: {
        ...process.env,
        VIM_TEST_FIRST: firstFile,
        VIM_TEST_KEY: key,
        VIM_TEST_PICKER: picker,
        VIM_TEST_RESULT: resultPath,
      },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const opened = JSON.parse(readFileSync(resultPath, "utf8"));
    expect(opened.files).toEqual(expectedFiles);
    expect(opened.current).toBe("B.ts");
    if (picker === "ripgrep") expect(opened.line).toBe(2);
  });
});
