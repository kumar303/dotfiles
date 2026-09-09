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
  testDirectory = mkdtempSync(join(tmpdir(), "vim-import-jump-"));
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("JumpToImport", () => {
  it("opens a multiline aliased import and jumps to the symbol", () => {
    const sourceDirectory = join(testDirectory, "src");
    const targetDirectory = join(sourceDirectory, "utilities");
    const sourceFile = join(sourceDirectory, "current.ts");
    const targetFile = join(targetDirectory, "target.ts");
    const resultPath = join(testDirectory, "result.json");
    mkdirSync(targetDirectory, { recursive: true });
    writeFileSync(
      sourceFile,
      "import {\n  targetFunction as localTarget,\n} from '~/utilities/target';\n\nvoid localTarget();\n",
    );
    writeFileSync(targetFile, "const preceding = true;\n\nexport function targetFunction() {}\n");
    writeFileSync(
      join(testDirectory, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "~/*": ["./src/*"] } } }),
    );

    const result = spawnSync(
      "vim",
      [
        "-Nu",
        vimrcPath,
        "-n",
        "-es",
        sourceFile,
        "-c",
        "call cursor(2, 25)",
        "-c",
        "call JumpToImport()",
        "-c",
        "call writefile([json_encode({'windows': winnr('$'), 'file': expand('%:p'), 'line': line('.')})], $VIM_TEST_RESULT)",
        "-c",
        "qa!",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, VIM_TEST_RESULT: resultPath },
      },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(resultPath, "utf8"))).toEqual({
      windows: 2,
      file: realpathSync(targetFile),
      line: 3,
    });
  });
});
