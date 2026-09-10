// @ts-check

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  filterWorkspaces,
  readWorkspaceHistory,
  recordWorkspace,
  seedWorkspaceHistory,
} from "../plugins/workspace-switcher/store.js";
import {
  currentWorkspaceDirectories,
  openPickerPopup,
  openWorkspace,
} from "../plugins/workspace-switcher/herdr.js";
import { WorkspacePickerModel } from "../plugins/workspace-switcher/model.js";
import {
  readHerdrConfig,
  resolveWorkspaceSwitcherTheme,
} from "../plugins/workspace-switcher/theme.js";
import { buildWorkspaceRows } from "../plugins/workspace-switcher/view.js";

/** @type {string} */
let stateDirectory;

beforeEach(() => {
  stateDirectory = mkdtempSync(join(tmpdir(), "workspace-switcher-"));
});

afterEach(() => {
  delete process.env.HERDR_CONFIG_PATH;
  rmSync(stateDirectory, { recursive: true, force: true });
});

describe("workspace history", () => {
  it("deduplicates directories and moves a focused workspace to the top", () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    recordWorkspace("/projects/checkout-web", stateDirectory, {
      branch: "older",
      now: yesterday.getTime(),
    });
    recordWorkspace("/projects/dotfiles", stateDirectory, {
      branch: "main",
      now: today.getTime(),
    });
    recordWorkspace("/projects/checkout-web", stateDirectory, {
      branch: "newer",
      now: today.getTime() + 1,
    });

    const history = readWorkspaceHistory(stateDirectory, today.getTime() + 2);
    expect(history.today.map(({ dir, branch }) => [basename(dir), branch])).toEqual([
      ["checkout-web", "newer"],
      ["dotfiles", "main"],
    ]);
    expect(history.earlier).toEqual([]);
  });

  it("seeds current workspaces only when history does not exist", () => {
    expect(
      seedWorkspaceHistory(
        [
          { dir: "/projects/current", branch: "main" },
          { dir: "/projects/other", branch: null },
        ],
        stateDirectory,
        100,
      ),
    ).toBe(true);
    expect(seedWorkspaceHistory([{ dir: "/projects/new" }], stateDirectory, 200)).toBe(false);

    expect(readWorkspaceHistory(stateDirectory, 201).today.map(({ dir }) => basename(dir))).toEqual(
      ["current", "other"],
    );
  });

  it("filters by directory and branch", () => {
    const entries = [
      { dir: "/projects/checkout-web", branch: "feature/payment", lastFocused: 2 },
      { dir: "/projects/dotfiles", branch: "main", lastFocused: 1 },
    ];

    expect(filterWorkspaces(entries, "payment")).toEqual([entries[0]]);
    expect(filterWorkspaces(entries, "dot")).toEqual([entries[1]]);
  });

  it("searches with slash input and keeps the selected entry in range", () => {
    const history = {
      today: [
        { dir: "/projects/checkout-web", branch: "feature/payment", lastFocused: 2 },
        { dir: "/projects/dotfiles", branch: "main", lastFocused: 1 },
      ],
      earlier: [],
    };
    const model = new WorkspacePickerModel(history);

    model.startSearch();
    model.appendSearch("payment");
    expect(model.entries.map(({ dir }) => basename(dir))).toEqual(["checkout-web"]);
    expect(model.searchQuery).toBe("payment");
    model.move(1);
    expect(model.selectedEntry()?.dir).toBe("/projects/checkout-web");
    model.clearSearch();
    expect(model.entries).toEqual(history.today);
  });

  it("renders the Today and Earlier sections like brain", () => {
    const today = { dir: "/projects/dotfiles", branch: "main", lastFocused: 2 };
    const earlier = { dir: "/projects/checkout-web", branch: null, lastFocused: 1 };

    expect(buildWorkspaceRows({ today: [today], earlier: [earlier] }, 0)).toEqual([
      { kind: "heading", text: "Today" },
      { entry: today, kind: "entry", selected: true, text: "   > dotfiles [main]" },
      { kind: "spacer", text: "" },
      { kind: "heading", text: "Earlier" },
      { entry: earlier, kind: "entry", selected: false, text: "     checkout-web" },
    ]);
  });
});

describe("workspace switcher theme", () => {
  it("reads Herdr's configured theme", () => {
    const configPath = join(stateDirectory, "config.toml");
    writeFileSync(configPath, '[theme]\nname = "nord"\n\n[theme.custom]\naccent = "#123456"\n');
    process.env.HERDR_CONFIG_PATH = configPath;

    expect(readHerdrConfig()).toMatchObject({
      theme: { name: "nord", custom: { accent: "#123456" } },
    });
  });

  it("resolves Herdr's built-in theme and custom colors", () => {
    expect(
      resolveWorkspaceSwitcherTheme({
        theme: {
          name: "one-light",
          custom: { accent: "#123456", overlay0: "rgb(12, 34, 56)" },
        },
      }),
    ).toEqual({
      accent: "#123456",
      background: "#fafafa",
      error: "#e45649",
      muted: "#0c2238",
      text: "#383a42",
    });
  });

  it("applies the active auto-switch mode after shared custom colors", () => {
    const config = {
      theme: {
        auto_switch: true,
        dark_name: "one-dark",
        light_name: "one-light",
        custom: {
          text: "#111111",
          light: { text: "#222222", accent: "#333333" },
        },
      },
    };

    expect(resolveWorkspaceSwitcherTheme(config, "light")).toMatchObject({
      accent: "#333333",
      text: "#222222",
    });
    expect(resolveWorkspaceSwitcherTheme(config, "dark")).toMatchObject({
      accent: "#61afef",
      text: "#111111",
    });
  });
});

describe("Herdr workspaces", () => {
  const snapshot = {
    workspaces: [
      { workspace_id: "w1", focused: false, number: 1 },
      { workspace_id: "w2", focused: true, number: 2 },
    ],
    panes: [
      { workspace_id: "w1", cwd: "/projects/one", focused: true },
      { workspace_id: "w1", cwd: "/projects/one/nested", focused: false },
      { workspace_id: "w2", cwd: "/projects/two", focused: true },
    ],
  };

  it("lists one directory per workspace with the focused workspace first", () => {
    expect(currentWorkspaceDirectories(snapshot)).toEqual([
      { dir: "/projects/two", workspaceId: "w2" },
      { dir: "/projects/one", workspaceId: "w1" },
    ]);
  });

  it("focuses an existing workspace when any pane uses the directory", () => {
    /** @type {string[][]} */
    const calls = [];
    openWorkspace("/projects/one/nested", snapshot, (args) => {
      calls.push(args);
      return {};
    });

    expect(calls).toEqual([["workspace", "focus", "w1"]]);
  });

  it("opens the picker as a plugin popup", () => {
    /** @type {string[][]} */
    const calls = [];
    openPickerPopup((args) => {
      calls.push(args);
      return {};
    });

    expect(calls).toEqual([
      [
        "plugin",
        "pane",
        "open",
        "--plugin",
        "kumar303.workspace-switcher",
        "--entrypoint",
        "picker",
      ],
    ]);
  });

  it("creates a workspace for a remembered directory that is not open", () => {
    /** @type {string[][]} */
    const calls = [];
    openWorkspace("/projects/three", snapshot, (args) => {
      calls.push(args);
      return {};
    });

    expect(calls).toEqual([["workspace", "create", "--cwd", "/projects/three", "--focus"]]);
  });
});
