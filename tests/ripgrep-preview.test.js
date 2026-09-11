// @ts-check

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const previewPath = join(repositoryRoot, "dotfiles", ".vim", "bin", "ripgrep-preview");

/** @type {string} */
let testDirectory;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "ripgrep-preview-"));
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("ripgrep-preview", () => {
  it("prints a bounded snippet starting at the matching line", () => {
    const sourceFile = join(testDirectory, "source.ts");
    writeFileSync(
      sourceFile,
      "const one = 1;\nconst two = 2;\nconst three = 3;\nconst four = 4;\n",
    );

    const result = spawnSync(previewPath, [sourceFile, "2", "2", "80"], { encoding: "utf8" });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("\x1b[38;2");
    const plainOutput = result.stdout.replace(/\x1b\[[0-9;]*m/g, "");
    expect(plainOutput).toContain("2 const two = 2;");
    expect(plainOutput).toContain("3 const three = 3;");
    expect(plainOutput).not.toContain("const one");
    expect(plainOutput).not.toContain("const four");
  });
});
