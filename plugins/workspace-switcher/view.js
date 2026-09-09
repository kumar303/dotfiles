// @ts-check

import { basename } from "node:path";

/** @typedef {import("./store.js").WorkspaceEntry} WorkspaceEntry */
/** @typedef {import("./store.js").WorkspaceHistory} WorkspaceHistory */

/**
 * @typedef {object} HeadingRow
 * @property {"heading"} kind
 * @property {string} text
 */

/**
 * @typedef {object} SpacerRow
 * @property {"spacer"} kind
 * @property {string} text
 */

/**
 * @typedef {object} EntryRow
 * @property {"entry"} kind
 * @property {string} text
 * @property {WorkspaceEntry} entry
 * @property {boolean} selected
 */

/** @typedef {HeadingRow | SpacerRow | EntryRow} WorkspaceRow */

/**
 * @param {WorkspaceHistory} history
 * @param {number} selectedIndex
 * @returns {WorkspaceRow[]}
 */
export function buildWorkspaceRows(history, selectedIndex) {
  /** @type {WorkspaceRow[]} */
  const rows = [{ kind: "heading", text: "Today" }];
  let index = 0;
  for (const entry of history.today) {
    rows.push(entryRow(entry, index === selectedIndex));
    index += 1;
  }
  rows.push({ kind: "spacer", text: "" }, { kind: "heading", text: "Earlier" });
  for (const entry of history.earlier) {
    rows.push(entryRow(entry, index === selectedIndex));
    index += 1;
  }
  return rows;
}

/**
 * @param {WorkspaceEntry} entry
 * @param {boolean} selected
 * @returns {EntryRow}
 */
function entryRow(entry, selected) {
  const branch = entry.branch ? ` [${entry.branch}]` : "";
  return {
    kind: "entry",
    text: `${selected ? "   > " : "     "}${basename(entry.dir)}${branch}`,
    entry,
    selected,
  };
}
