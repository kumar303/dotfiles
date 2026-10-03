// @ts-check

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const vimrcPath = join(dirname(fileURLToPath(import.meta.url)), "..", "dotfiles", ".vimrc");

/** @type {string} */
let testDirectory;
/** @type {string} */
let file;
/** @type {string} */
let resultPath;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "vim-file-reload-"));
  file = join(testDirectory, "example.txt");
  resultPath = join(testDirectory, "result.json");
  writeFileSync(file, "old\n");
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

/** @param {string[]} commands */
function runVim(commands) {
  const result = spawnSync(
    "vim",
    [
      "-Nu",
      vimrcPath,
      "-n",
      "-es",
      file,
      ...commands.flatMap((command) => ["-c", command]),
      "-c",
      "call writefile([json_encode({'text': getline(1), 'modified': &modified, 'before': get(g:, 'reload_before', v:null)})], $VIM_TEST_RESULT)",
      "-c",
      "qa!",
    ],
    { encoding: "utf8", env: { ...process.env, VIM_TEST_RESULT: resultPath } },
  );
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  return JSON.parse(readFileSync(resultPath, "utf8"));
}

describe("external file reload", () => {
  it("reloads an unmodified buffer after an external change outside Insert mode", () => {
    expect(runVim(["call writefile(['new text'], expand('%:p'))", "checktime"])).toMatchObject({
      text: "new text",
      modified: 0,
    });
  });

  it("waits until Insert mode ends before reloading", () => {
    expect(
      runVim([
        "doautocmd InsertEnter",
        "call writefile(['new text'], expand('%:p'))",
        "checktime",
        "let g:reload_before = getline(1)",
        "doautocmd InsertLeave",
      ]),
    ).toMatchObject({ before: "old", text: "new text", modified: 0 });
  });

  it("keeps unsaved edits when the file changes during Insert mode", () => {
    expect(
      runVim([
        "doautocmd InsertEnter",
        "call setline(1, 'unsaved edit')",
        "call writefile(['new text'], expand('%:p'))",
        "checktime",
        "doautocmd InsertLeave",
      ]),
    ).toMatchObject({ text: "unsaved edit", modified: 1 });
  });
});
