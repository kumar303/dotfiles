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
  testDirectory = mkdtempSync(join(tmpdir(), "vim-symbols-"));
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("CurrentFileSymbols", () => {
  it("omits data and alias symbols", () => {
    const sourceFile = join(testDirectory, "example.ts");
    const resultPath = join(testDirectory, "symbols.json");
    writeFileSync(
      sourceFile,
      "type UserId = string;\ninterface User { id: UserId }\nfunction loadUser() {}\n",
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
        "call writefile([json_encode(CurrentFileSymbols())], $VIM_TEST_RESULT)",
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
    const symbols = /** @type {string[]} */ (JSON.parse(readFileSync(resultPath, "utf8")));
    expect(symbols.some((symbol) => symbol.includes("UserId"))).toBe(false);
    expect(symbols.some((symbol) => symbol.includes(" id"))).toBe(false);
    expect(symbols.some((symbol) => symbol.includes("User"))).toBe(true);
    expect(symbols.some((symbol) => symbol.includes("loadUser"))).toBe(true);
  });
});
