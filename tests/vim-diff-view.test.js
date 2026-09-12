// @ts-check

import { execSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const vimrcPath = join(repositoryRoot, "dotfiles", ".vimrc");

/** @type {string} */
let testDirectory;
/** @type {string} */
let stateDirectory;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "vim-diff-view-"));
  stateDirectory = mkdtempSync(join(tmpdir(), "vim-diff-view-state-"));
  git("init -b main");
  git("config user.email test@example.com");
  git("config user.name Test");
  writeFileSync(join(testDirectory, "example.js"), "one\ntwo\nthree\n");
  writeFileSync(join(testDirectory, "other.js"), "other\n");
  git("add .");
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

/** @param {string} body */
function runVim(body) {
  const resultPath = join(stateDirectory, "vim-result.json");
  const scriptPath = join(stateDirectory, "test.vim");
  writeFileSync(scriptPath, `${body}\nqa!\n`);
  const result = spawnSync("vim", ["-Nu", vimrcPath, "-n", "-es", "-S", scriptPath], {
    cwd: testDirectory,
    encoding: "utf8",
    env: {
      ...process.env,
      VIEW_DIFF_IN_VIM_STATE_DIR: stateDirectory,
      VIM_TEST_RESULT: resultPath,
    },
  });
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  return JSON.parse(readFileSync(resultPath, "utf8"));
}

describe("Vim diff view", () => {
  it("opens the first hunk in working-tree contents and marks changed lines", () => {
    writeFileSync(join(testDirectory, "example.js"), "one\nchanged\nthree\n");

    const result = runVim(`
let view = json_decode(ViewDiffCommand(['start', g:fzf_file_picker_root, 'working']))
call ApplyDiffView(view)
let placed = sign_getplaced(bufnr(), {'group': 'view-diff-in-vim'})[0].signs
call writefile([json_encode({'file': expand('%:t'), 'line': line('.'), 'text': getline('.'), 'top': line('w0'), 'signs': placed})], $VIM_TEST_RESULT)
`);

    expect(result).toMatchObject({ file: "example.js", line: 2, text: "changed" });
    expect(result.line - result.top).toBeLessThanOrEqual(1);
    expect(result.signs).toEqual([expect.objectContaining({ lnum: 2, name: "ViewDiffChange" })]);
  });

  it("opens the first changed file that still has working-tree contents", () => {
    rmSync(join(testDirectory, "example.js"));
    writeFileSync(join(testDirectory, "other.js"), "changed other\n");

    const result = runVim(`
let view = json_decode(ViewDiffCommand(['start', g:fzf_file_picker_root, 'working']))
call ApplyDiffView(view)
call writefile([json_encode({'file': expand('%:t'), 'text': getline('.')})], $VIM_TEST_RESULT)
`);

    expect(result).toEqual({ file: "other.js", text: "changed other" });
  });

  it("clears an Explore buffer before it refreshes an active diff", () => {
    const result = runVim(`
call ViewDiffCommand(['start', g:fzf_file_picker_root, 'branch'])
Explore
let before = {'file': expand('%:p'), 'filetype': &filetype}
call OpenDiffView()
call writefile([json_encode({'after': {'file': expand('%:p'), 'filetype': &filetype}, 'before': before})], $VIM_TEST_RESULT)
`);

    expect(result.before.file).not.toBe("");
    expect(result.before.filetype).toBe("netrw");
    expect(result.after).toEqual({ file: "", filetype: "" });
  });

  it("opens an unopened changed file in a right-hand split", () => {
    const result = runVim(`
execute 'edit ' . fnameescape(g:fzf_file_picker_root . '/example.js')
call OpenDiffLocation({'path': 'other.js', 'line': 1})
let first_count = winnr('$')
call OpenDiffLocation({'path': 'other.js', 'line': 1})
call writefile([json_encode({'count': winnr('$'), 'first_count': first_count, 'file': expand('%:t')})], $VIM_TEST_RESULT)
`);

    expect(result).toEqual({ count: 2, first_count: 2, file: "other.js" });
  });

  it("uses FileToolLayout and binds ctrl+opt+d", () => {
    const result = runVim(`
set columns=180 lines=40
let window = DiffViewPopupWindow(6)
call writefile([json_encode({'mapping': maparg('<C-M-d>', 'n'), 'window': window, 'layout': FileToolLayout(), 'options': DiffViewLocationOptions(2)})], $VIM_TEST_RESULT)
`);

    expect(result.mapping).toContain("OpenDiffView");
    expect(result.window).toMatchObject({
      width: result.layout.width,
      xoffset: result.layout.xoffset,
      yoffset: result.layout.yoffset,
    });
    expect(result.options).toContain("--expect=enter,X");
    expect(result.options).toContain("--bind=load:pos(2)");
  });

  it("clears the active workspace state and gutter signs with X", () => {
    writeFileSync(join(testDirectory, "example.js"), "one\nchanged\nthree\n");

    const result = runVim(`
let view = json_decode(ViewDiffCommand(['start', g:fzf_file_picker_root, 'working']))
call ApplyDiffView(view)
call DiffViewResults(['X', '1\texample.js\t2\tchange\texample.js:2'])
let refreshed = json_decode(ViewDiffCommand(['refresh', g:fzf_file_picker_root, expand('%:p'), line('.')]))
let placed = sign_getplaced(bufnr(), {'group': 'view-diff-in-vim'})[0].signs
call writefile([json_encode({'refreshed': refreshed, 'signs': placed})], $VIM_TEST_RESULT)
`);

    expect(result).toEqual({ refreshed: { active: false }, signs: [] });
  });
});
