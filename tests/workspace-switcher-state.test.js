// @ts-check

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkspacePickerModel } from "../plugins/workspace-switcher/model.js";
import {
  applyWorkspaceStates,
  recordWorkspaceActivation,
  setWorkspaceState,
} from "../plugins/workspace-switcher/workspace-state.js";

/** @type {string} */
let directory;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "workspace-state-"));
});
afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

/** @param {string} [workspaceId] @returns {import('../plugins/workspace-switcher/store.js').WorkspaceEntry} */
function entry(workspaceId) {
  return {
    dir: join(directory, "project"),
    branch: null,
    lastFocused: Date.now(),
    ...(workspaceId ? { workspaceId } : {}),
  };
}

/** @param {import('../plugins/workspace-switcher/store.js').WorkspaceEntry[]} entries */
function model(entries) {
  return new WorkspacePickerModel(applyWorkspaceStates({ today: entries, earlier: [] }, directory));
}

describe("workspace todo and done states", () => {
  it("defaults existing history and new workspaces to todo without a migration", () => {
    expect(model([entry(), entry("w1")]).entries.map((item) => item.state)).toEqual([
      "todo",
      "todo",
    ]);
  });

  it("keeps separate workspace states even when their directories match", () => {
    setWorkspaceState(entry("w1"), directory, "done");
    const picker = model([entry("w1"), entry("w2")]);
    expect(picker.entries.map((item) => item.workspaceId)).toEqual(["w2"]);
    picker.startSearch();
    expect(picker.entries.map((item) => item.state)).toEqual(["done", "todo"]);
    picker.clearSearch();
    expect(picker.entries.map((item) => item.workspaceId)).toEqual(["w2"]);
  });

  it("retains done after cwd changes and for history after closing a workspace", () => {
    const original = entry("w1");
    setWorkspaceState(original, directory, "done");
    expect(model([{ ...original, dir: join(directory, "changed") }]).entries).toEqual([]);
    expect(model([entry()]).entries).toEqual([]);
    expect(model([entry("new-workspace")]).entries[0].state).toBe("todo");
  });

  it("resets done on workspace activation but not on repeated pane focus", () => {
    const workspace = entry("w1");
    recordWorkspaceActivation(workspace, directory);
    setWorkspaceState(workspace, directory, "done");
    recordWorkspaceActivation(workspace, directory);
    expect(model([workspace]).entries).toEqual([]);
    recordWorkspaceActivation(entry("w2"), directory);
    recordWorkspaceActivation(workspace, directory);
    expect(model([workspace]).entries[0].state).toBe("todo");
  });

  it("ignores an incomplete state record and retains the previous valid state", () => {
    const workspace = entry("w1");
    setWorkspaceState(workspace, directory, "done");
    writeFileSync(join(directory, "workspace-state.jsonl"), '{"unfinished":', { flag: "a" });
    expect(model([workspace]).entries).toEqual([]);
    setWorkspaceState(workspace, directory, "todo");
    expect(model([workspace]).entries[0].state).toBe("todo");
  });
});
