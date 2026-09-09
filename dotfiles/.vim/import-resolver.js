#!/usr/bin/env node
// @ts-check

import { ResolverFactory } from "oxc-resolver";

const sourceFile = process.argv[2];
const specifier = process.argv[3];
if (!sourceFile || !specifier) throw new Error("usage: import-resolver.js SOURCE_FILE SPECIFIER");

const resolver = new ResolverFactory({
  conditionNames: ["browser", "import", "module", "default"],
  extensionAlias: {
    ".js": [".ts", ".tsx", ".js"],
    ".mjs": [".mts", ".mjs"],
    ".cjs": [".cts", ".cjs"],
  },
  extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"],
  mainFields: ["browser", "module", "main"],
  tsconfig: "auto",
});
const result = resolver.resolveFileSync(sourceFile, specifier);
if (!result.path) throw new Error(result.error || `could not resolve ${specifier}`);

process.stdout.write(`${result.path}\n`);
