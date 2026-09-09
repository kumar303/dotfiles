// @ts-check

import { filterWorkspaces } from "./store.js";

/** @typedef {import("./store.js").WorkspaceEntry} WorkspaceEntry */
/** @typedef {import("./store.js").WorkspaceHistory} WorkspaceHistory */

export class WorkspacePickerModel {
  /** @param {WorkspaceHistory} history */
  constructor(history) {
    this.history = history;
    this.searchMode = false;
    this.searchQuery = "";
    this.selectedIndex = 0;
  }

  /** @returns {WorkspaceHistory} */
  get filteredHistory() {
    return {
      today: filterWorkspaces(this.history.today, this.searchQuery),
      earlier: filterWorkspaces(this.history.earlier, this.searchQuery),
    };
  }

  /** @returns {WorkspaceEntry[]} */
  get entries() {
    const history = this.filteredHistory;
    return [...history.today, ...history.earlier];
  }

  startSearch() {
    this.searchMode = true;
    this.searchQuery = "";
    this.selectedIndex = 0;
  }

  /** @param {string} value */
  appendSearch(value) {
    this.searchQuery += value;
    this.selectedIndex = 0;
  }

  backspaceSearch() {
    if (this.searchQuery.length <= 1) {
      this.clearSearch();
    } else {
      this.searchQuery = this.searchQuery.slice(0, -1);
      this.selectedIndex = 0;
    }
  }

  clearSearch() {
    this.searchMode = false;
    this.searchQuery = "";
    this.selectedIndex = 0;
  }

  /** @param {number} offset */
  move(offset) {
    const length = this.entries.length;
    if (!length) return;
    this.selectedIndex = (this.selectedIndex + offset + length) % length;
  }

  /** @returns {WorkspaceEntry | undefined} */
  selectedEntry() {
    return this.entries[this.selectedIndex];
  }
}
