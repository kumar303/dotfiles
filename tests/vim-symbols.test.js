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

  it("places a wide symbol popup toward the outside of the source split", () => {
    const resultPath = join(testDirectory, "popup-layout.json");
    const result = spawnSync(
      "vim",
      [
        "-Nu",
        vimrcPath,
        "-n",
        "-es",
        "-c",
        "set columns=180 lines=40",
        "-c",
        "vsplit",
        "-c",
        "wincmd h",
        "-c",
        "let left = SymbolPopupLayout()",
        "-c",
        "wincmd l",
        "-c",
        "let right = SymbolPopupLayout()",
        "-c",
        "call writefile([json_encode({'left': left, 'right': right})], $VIM_TEST_RESULT)",
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
    const layout = JSON.parse(readFileSync(resultPath, "utf8"));
    expect(layout.left).toMatchObject({ side: "right", triangle: "◀" });
    expect(layout.left.width).toBe(Math.floor(layout.left.pane_width * 0.95));
    expect(layout.left.width).toBeLessThan(layout.left.pane_width);
    expect(layout.left.height).toBe(Math.floor(layout.left.pane_height * 0.8));
    expect(layout.left.col).toBe(layout.left.pane_col + layout.left.pane_width + 1);
    expect(layout.right).toMatchObject({ side: "left", triangle: "▶" });
    expect(layout.right.width).toBe(Math.floor(layout.right.pane_width * 0.95));
    expect(layout.right.width).toBeLessThan(layout.right.pane_width);
    expect(layout.right.height).toBe(Math.floor(layout.right.pane_height * 0.8));
    expect(layout.right.col + layout.right.width).toBe(layout.right.pane_col - 1);
  });

  it("scrolls the selected symbol within four lines of the top", () => {
    const sourceFile = join(testDirectory, "long-file.ts");
    const resultPath = join(testDirectory, "scroll.json");
    writeFileSync(
      sourceFile,
      Array.from({ length: 100 }, (_, index) => `const line${index + 1} = ${index + 1};`).join(
        "\n",
      ),
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
        "call PositionSymbolWindow(win_getid(), 50)",
        "-c",
        "call writefile([json_encode({'cursor': line('.'), 'top': line('w0')})], $VIM_TEST_RESULT)",
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
    const view = JSON.parse(readFileSync(resultPath, "utf8"));
    expect(view.cursor).toBe(50);
    expect(view.cursor - view.top).toBeLessThanOrEqual(4);
  });
});
