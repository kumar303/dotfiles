// @ts-check

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
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
        VIM_OPEN_FILE_SWITCHER_STATE_DIR: join(testDirectory, "state"),
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

  it("opens a recent file that no longer has a window", () => {
    const firstFile = join(testDirectory, "first.ts");
    const secondFile = join(testDirectory, "second.ts");
    const resultPath = join(testDirectory, "result.json");
    const scriptPath = join(testDirectory, "test.vim");
    writeFileSync(firstFile, "first\n");
    writeFileSync(secondFile, "second\n");
    writeFileSync(
      scriptPath,
      `execute 'edit ' . fnameescape($VIM_TEST_FIRST)
enew
execute 'edit ' . fnameescape($VIM_TEST_SECOND)
let state = OpenFileSwitcherState()
let recent = filter(copy(state.entries), 'v:val =~# "first.ts"')[0]
call OpenFileSwitcherResults(['enter', recent])
call writefile([json_encode({'entries': state.entries, 'focused': expand('%:t'), 'windows': winnr('$')})], $VIM_TEST_RESULT)
qa!
`,
    );

    const result = spawnSync("vim", ["-Nu", vimrcPath, "-n", "-es", "-S", scriptPath], {
      cwd: testDirectory,
      encoding: "utf8",
      env: {
        ...process.env,
        VIM_OPEN_FILE_SWITCHER_STATE_DIR: join(testDirectory, "state"),
        VIM_TEST_FIRST: firstFile,
        VIM_TEST_SECOND: secondFile,
        VIM_TEST_RESULT: resultPath,
      },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const state = JSON.parse(readFileSync(resultPath, "utf8"));
    expect(state.entries).toHaveLength(2);
    expect(state.entries[0]).toMatch(/^\d+\t.*second\.ts$/);
    expect(state.entries[1]).toMatch(/^0\t.*first\.ts$/);
    expect(state.focused).toBe("first.ts");
    expect(state.windows).toBe(2);
  });

  it("keeps recent files separate between workspace directories", () => {
    const stateDirectory = join(testDirectory, "state");
    const workspaces = [join(testDirectory, "one"), join(testDirectory, "two")];
    const statePaths = [];

    for (const workspace of workspaces) {
      const file = join(workspace, "example.ts");
      const resultPath = join(workspace, "result.json");
      const scriptPath = join(workspace, "test.vim");
      mkdirSync(workspace);
      writeFileSync(file, `${workspace}\n`);
      writeFileSync(
        scriptPath,
        `execute 'edit ' . fnameescape($VIM_TEST_FILE)
call writefile([json_encode({'files': OpenFileSwitcherRecentFiles(), 'statePath': OpenFileSwitcherStatePath()})], $VIM_TEST_RESULT)
qa!
`,
      );

      const result = spawnSync("vim", ["-Nu", vimrcPath, "-n", "-es", "-S", scriptPath], {
        cwd: workspace,
        encoding: "utf8",
        env: {
          ...process.env,
          VIM_OPEN_FILE_SWITCHER_STATE_DIR: stateDirectory,
          VIM_TEST_FILE: file,
          VIM_TEST_RESULT: resultPath,
        },
      });

      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      const state = JSON.parse(readFileSync(resultPath, "utf8"));
      expect(state.files).toEqual([realpathSync(file)]);
      statePaths.push(state.statePath);
    }

    expect(new Set(statePaths).size).toBe(2);
  });

  it("stores ten de-duplicated recent files for each workspace", () => {
    const files = Array.from({ length: 12 }, (_, index) =>
      join(testDirectory, `file-${index + 1}.ts`),
    );
    for (const file of files) writeFileSync(file, `${file}\n`);
    const resultPath = join(testDirectory, "result.json");
    const scriptPath = join(testDirectory, "test.vim");
    writeFileSync(
      scriptPath,
      `for file in split($VIM_TEST_FILES, "\\n")
    execute 'edit ' . fnameescape(file)
endfor
execute 'edit ' . fnameescape($VIM_TEST_REOPEN)
call writefile([json_encode({'files': OpenFileSwitcherRecentFiles(), 'statePath': OpenFileSwitcherStatePath()})], $VIM_TEST_RESULT)
qa!
`,
    );
    const stateDirectory = join(testDirectory, "state");

    const result = spawnSync("vim", ["-Nu", vimrcPath, "-n", "-es", "-S", scriptPath], {
      cwd: testDirectory,
      encoding: "utf8",
      env: {
        ...process.env,
        VIM_OPEN_FILE_SWITCHER_STATE_DIR: stateDirectory,
        VIM_TEST_FILES: files.join("\n"),
        VIM_TEST_REOPEN: files[4],
        VIM_TEST_RESULT: resultPath,
      },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    const state = JSON.parse(readFileSync(resultPath, "utf8"));
    expect(state.files).toHaveLength(10);
    expect(state.files[0]).toBe(realpathSync(files[4]));
    expect(new Set(state.files).size).toBe(10);
    expect(state.files).not.toContain(realpathSync(files[0]));
    expect(state.files).not.toContain(realpathSync(files[1]));
    expect(dirname(state.statePath)).toBe(stateDirectory);
  });
});
