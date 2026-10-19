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
  testDirectory = mkdtempSync(join(tmpdir(), "vim-ripgrep-"));
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("visual ripgrep", () => {
  it.each([
    ["spaces", "two words", "two words"],
    ["single quotes", "a 'quoted' value", "a 'quoted' value"],
    ["double quotes", 'a "quoted" value', 'a "quoted" value'],
    ["shell punctuation", "two words; echo unexpected", "two words; echo unexpected"],
    ["regular expressions", "two\\s+words", "two words"],
  ])("searches the selection as one argument with %s", (_name, selection, matchingText) => {
    const scriptPath = join(testDirectory, "search.vim");
    const resultPath = join(testDirectory, "result.json");
    writeFileSync(join(testDirectory, "match.txt"), `${matchingText}\n`);
    writeFileSync(join(testDirectory, "other.txt"), "two\nwords\nunrelated\n");
    writeFileSync(
      scriptPath,
      `function! RunRipgrep(name, command)
    let g:search_output = systemlist(a:command)
    let g:search_status = v:shell_error
endfunction
call setline(1, $VIM_TEST_SELECTION)
call feedkeys("gg0v$\\<C-r>\\<CR>", 'xt')
call writefile([json_encode({'output': g:search_output, 'status': g:search_status})], $VIM_TEST_RESULT)
qa!
`,
    );

    const result = spawnSync(
      "vim",
      ["-Nu", vimrcPath, "-i", "NONE", "-n", "-es", "-S", scriptPath],
      {
        cwd: testDirectory,
        encoding: "utf8",
        env: {
          ...process.env,
          VIM_TEST_SELECTION: selection,
          VIM_TEST_RESULT: resultPath,
          VIM_OPEN_FILE_SWITCHER_STATE_DIR: join(testDirectory, "history"),
        },
      },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const search = JSON.parse(readFileSync(resultPath, "utf8"));
    expect(search.status).toBe(0);
    expect(search.output).toEqual([`match.txt:1:1:${matchingText}`]);
  });
});
