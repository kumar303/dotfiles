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
    writeFileSync(sourceFile, "one\ntwo\nthree\nfour\n");

    const result = spawnSync(previewPath, [sourceFile, "2", "2"], { encoding: "utf8" });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("     2  two\n     3  three\n");
  });
});
