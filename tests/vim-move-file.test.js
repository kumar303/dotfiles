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
  testDirectory = mkdtempSync(join(tmpdir(), "vim-move-file-"));
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("MoveCurrentFileWindow", () => {
  it("preserves the cursor and scroll position", () => {
    const sourceFile = join(testDirectory, "source.ts");
    const targetFile = join(testDirectory, "target.ts");
    const resultPath = join(testDirectory, "view.json");
    const scriptPath = join(testDirectory, "view.vim");
    writeFileSync(
      sourceFile,
      Array.from({ length: 200 }, (_, index) => `line ${index + 1}`).join("\n"),
    );
    writeFileSync(targetFile, "target\n");
    writeFileSync(
      scriptPath,
      `set lines=30 columns=120
execute 'edit ' . fnameescape($VIM_TEST_SOURCE)
execute 'vsplit ' . fnameescape($VIM_TEST_TARGET)
wincmd h
call cursor(150, 1)
normal! zt
let before = winsaveview()
call MoveCurrentFileWindow('l')
let after = winsaveview()
call writefile([json_encode({'before': before, 'after': after})], $VIM_TEST_RESULT)
qa!
`,
    );

    const result = spawnSync("vim", ["-Nu", vimrcPath, "-n", "-es", "-S", scriptPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        VIM_TEST_RESULT: resultPath,
        VIM_TEST_SOURCE: sourceFile,
        VIM_TEST_TARGET: targetFile,
      },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const views = JSON.parse(readFileSync(resultPath, "utf8"));
    expect(views.after.lnum).toBe(views.before.lnum);
    expect(views.after.topline).toBe(views.before.topline);
    expect(views.after.leftcol).toBe(views.before.leftcol);
  });

  it.each([
    ["C.ts", "h", ["A.ts", "C.ts"]],
    ["A.ts", "l", ["A.ts", "C.ts"]],
    ["A.ts", "h", ["A.ts", "B.ts", "C.ts"]],
    ["C.ts", "l", ["A.ts", "B.ts", "C.ts"]],
  ])("moves %s toward %s", (currentFile, direction, expectedFiles) => {
    const files = ["A.ts", "B.ts", "C.ts"].map((name) => join(testDirectory, name));
    for (const file of files) writeFileSync(file, `${file}\n`);

    const resultPath = join(testDirectory, "result.json");
    const scriptPath = join(testDirectory, "test.vim");
    writeFileSync(
      scriptPath,
      `execute 'edit ' . fnameescape($VIM_TEST_A)
execute 'vsplit ' . fnameescape($VIM_TEST_B)
execute 'vsplit ' . fnameescape($VIM_TEST_C)
if $VIM_TEST_CURRENT ==# 'A.ts'
    wincmd t
endif
call MoveCurrentFileWindow($VIM_TEST_DIRECTION)
let files = []
for window_number in range(1, winnr('$'))
    call add(files, fnamemodify(bufname(winbufnr(window_number)), ':t'))
endfor
call writefile([json_encode({'files': files, 'current': expand('%:t')})], $VIM_TEST_RESULT)
qa!
`,
    );

    const result = spawnSync("vim", ["-Nu", vimrcPath, "-n", "-es", "-S", scriptPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        VIM_TEST_A: files[0],
        VIM_TEST_B: files[1],
        VIM_TEST_C: files[2],
        VIM_TEST_CURRENT: currentFile,
        VIM_TEST_DIRECTION: direction,
        VIM_TEST_RESULT: resultPath,
      },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(resultPath, "utf8"))).toEqual({
      files: expectedFiles,
      current: currentFile,
    });
  });
});
