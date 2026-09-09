// @ts-check

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const resolverPath = join(repositoryRoot, "dotfiles", ".vim", "import-resolver.js");

/** @type {string} */
let testDirectory;
/** @type {string} */
let sourceFile;

beforeEach(() => {
  testDirectory = mkdtempSync(join(tmpdir(), "import-resolver-"));
  mkdirSync(join(testDirectory, "src", "utilities"), { recursive: true });
  sourceFile = join(testDirectory, "src", "current.ts");
  writeFileSync(sourceFile, "");
  writeFileSync(join(testDirectory, "src", "relative.ts"), "");
  writeFileSync(join(testDirectory, "src", "utilities", "aliased.ts"), "");
  writeFileSync(
    join(testDirectory, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { paths: { "~/*": ["./src/*"] } } }),
  );
});

afterEach(() => {
  rmSync(testDirectory, { recursive: true, force: true });
});

describe("import-resolver", () => {
  it.each([
    ["./relative", "src/relative.ts"],
    ["~/utilities/aliased", "src/utilities/aliased.ts"],
  ])("resolves %s", (specifier, expectedPath) => {
    const result = spawnSync(process.execPath, [resolverPath, sourceFile, specifier], {
      encoding: "utf8",
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(realpathSync(join(testDirectory, expectedPath)));
  });
});
