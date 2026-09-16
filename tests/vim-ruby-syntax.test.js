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
  testDirectory = mkdtempSync(join(tmpdir(), "vim-ruby-syntax-"));
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("Ruby syntax", () => {
  it("recovers after a string with nested interpolation", () => {
    const sourcePath = join(testDirectory, "example.rb");
    const resultPath = join(testDirectory, "result.json");
    const scriptPath = join(testDirectory, "test.vim");
    writeFileSync(
      sourcePath,
      `def validate
  errors.add(
    message: "Unknown #{keys.map { |key| ":#{key}" }.join}",
  )
  false
end

def other
  true
end
`,
    );
    writeFileSync(
      scriptPath,
      `execute 'edit ' . fnameescape($VIM_TEST_SOURCE)
call writefile([json_encode({'false': synIDattr(synID(5, 3, 1), 'name'), 'definition': synIDattr(synID(8, 1, 1), 'name'), 'true': synIDattr(synID(9, 3, 1), 'name')})], $VIM_TEST_RESULT)
qa!
`,
    );

    const result = spawnSync("vim", ["-Nu", vimrcPath, "-n", "-es", "-S", scriptPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        VIM_TEST_RESULT: resultPath,
        VIM_TEST_SOURCE: sourcePath,
      },
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(resultPath, "utf8"))).toEqual({
      false: "rubyBoolean",
      definition: "rubyDefine",
      true: "rubyBoolean",
    });
  });
});
