// @ts-check

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = join(repositoryRoot, "dotfiles", ".vim", "bin", "diff-view-search-action");

/** @param {string} key @param {"enabled" | "disabled"} state */
function action(key, state) {
  return execFileSync(scriptPath, {
    encoding: "utf8",
    env: { ...process.env, FZF_INPUT_STATE: state, FZF_KEY: key },
  }).trim();
}

describe("diff view search action", () => {
  it("enters search mode with slash and lets slash become query text while searching", () => {
    expect(action("/", "disabled")).toBe("enable-search+change-prompt(Search> )");
    expect(action("/", "enabled")).toBe("put(/)");
  });

  it("leaves search mode with escape without closing the picker", () => {
    expect(action("esc", "enabled")).toBe("disable-search+change-prompt(Change> )");
    expect(action("esc", "disabled")).toBe("abort");
  });

  it("leaves search mode while moving down", () => {
    expect(action("down", "enabled")).toBe("down+disable-search+change-prompt(Change> )");
    expect(action("down", "disabled")).toBe("down");
  });

  it("uses action keys outside search mode and inserts them while searching", () => {
    expect(action("t", "disabled")).toBe("print(t)+accept");
    expect(action("t", "enabled")).toBe("put(t)");
    expect(action("X", "disabled")).toBe("print(X)+accept");
    expect(action("X", "enabled")).toBe("put(X)");
  });
});
