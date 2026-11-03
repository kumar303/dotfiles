// @ts-check

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { writeFileAtomically } from "./atomic-file.js";

/** @typedef {import('./store.js').WorkspaceEntry} WorkspaceEntry */
/** @typedef {'todo' | 'done'} WorkspaceState */
/** @typedef {{workspaceId?: string, directories: string[], state: WorkspaceState}} StateRecord */

/** @param {WorkspaceEntry} entry */
function directories(entry) {
  return [
    ...new Set([entry.dir, ...(entry.workspaceDirectories ?? [])].map((dir) => resolve(dir))),
  ];
}

/** @param {string} stateDirectory @returns {StateRecord[]} */
function readStates(stateDirectory) {
  const file = join(stateDirectory, "workspace-state.jsonl");
  if (!existsSync(file)) return [];
  const records = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    try {
      const record = JSON.parse(line);
      if (
        ["todo", "done"].includes(record?.state) &&
        Array.isArray(record.directories) &&
        record.directories.every((/** @type {unknown} */ dir) => typeof dir === "string")
      )
        records.push(record);
    } catch {
      // Ignore incomplete writes.
    }
  }
  return records;
}

/** @param {import('./store.js').WorkspaceHistory} history @param {string} stateDirectory */
export function applyWorkspaceStates(history, stateDirectory) {
  const records = readStates(stateDirectory).reverse();
  /** @param {WorkspaceEntry} entry @returns {WorkspaceEntry} */
  const apply = (entry) => {
    const paths = directories(entry);
    const record = records.find((candidate) =>
      entry.workspaceId
        ? candidate.workspaceId === entry.workspaceId
        : candidate.directories.some((dir) => paths.includes(dir)),
    );
    return { ...entry, state: record?.state ?? "todo" };
  };
  return { today: history.today.map(apply), earlier: history.earlier.map(apply) };
}

/** @param {WorkspaceEntry} entry @param {string} stateDirectory @param {WorkspaceState} state */
export function setWorkspaceState(entry, stateDirectory, state) {
  mkdirSync(stateDirectory, { recursive: true });
  const record = { workspaceId: entry.workspaceId, directories: directories(entry), state };
  appendFileSync(join(stateDirectory, "workspace-state.jsonl"), `\n${JSON.stringify(record)}\n`, {
    mode: 0o600,
  });
}

/** @param {WorkspaceEntry} entry @param {string} stateDirectory */
export function recordWorkspaceActivation(entry, stateDirectory) {
  const file = join(stateDirectory, "active-workspace.json");
  if (existsSync(file)) {
    const previous = JSON.parse(readFileSync(file, "utf8"));
    if (previous.workspaceId === entry.workspaceId && entry.workspaceId) return;
  }
  setWorkspaceState(entry, stateDirectory, "todo");
  writeFileAtomically(file, `${JSON.stringify({ workspaceId: entry.workspaceId })}\n`);
}
