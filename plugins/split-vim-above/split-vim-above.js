#!/usr/bin/env node
// @ts-check

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

/**
 * @typedef {object} Pane
 * @property {string} pane_id
 * @property {string} [terminal_id]
 * @property {string} cwd
 * @property {string} tab_id
 * @property {string} workspace_id
 * @property {boolean} [focused]
 */

/** @typedef {{result: {panes: Pane[]}}} PaneListResponse */
/** @typedef {{result: {pane: Pane}}} PaneResponse */
/** @typedef {{result: {root_pane: Pane}}} TabCreateResponse */
/** @typedef {{result: {move_result: {pane: Pane}}}} PaneMoveResponse */
/** @typedef {{pane_id: string, terminal_id: string}} PaneMarker */
/**
 * @typedef {object} VimSession
 * @property {string} cwd
 * @property {string} workspace_id
 * @property {string} pane_id
 * @property {string} terminal_id
 */

const herdrCommand = process.env.HERDR_BIN_PATH || "herdr";
const pluginStateDirectory = process.env.HERDR_PLUGIN_STATE_DIR || "";
const paneMarkerDirectory = join(pluginStateDirectory, "pane-markers");
const vimSessionDirectory = join(pluginStateDirectory, "vim-sessions");

/**
 * @param {string[]} args
 * @param {{allowFailure?: boolean}} [options]
 */
function runHerdrProcess(args, options = {}) {
  const result = spawnSync(herdrCommand, args, {
    encoding: "utf8",
    env: process.env,
  });

  if (result.error) {
    throw new Error(`could not run ${herdrCommand}: ${result.error.message}`);
  }
  if (result.status !== 0 && !options.allowFailure) {
    const detail = result.stderr.trim();
    throw new Error(`herdr ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return result;
}

/**
 * @template T
 * @param {string[]} args
 * @param {{allowFailure?: boolean}} [options]
 * @returns {T | null}
 */
function runHerdr(args, options = {}) {
  const result = runHerdrProcess(args, options);
  if (result.status !== 0) return null;

  const output = result.stdout.trim();
  if (!output) return /** @type {T} */ ({});

  try {
    return /** @type {T} */ (JSON.parse(output));
  } catch {
    throw new Error(`herdr ${args.join(" ")} returned invalid JSON`);
  }
}

/**
 * @param {Pane[]} panes
 * @returns {Pane | undefined}
 */
function findSourcePane(panes) {
  for (const candidate of [process.env.HERDR_ACTIVE_PANE_ID, process.env.HERDR_PANE_ID]) {
    if (!candidate) continue;
    const pane = panes.find(({ pane_id }) => pane_id === candidate);
    if (pane) return pane;
  }

  const current = runHerdr(/** @type {string[]} */ (["pane", "current"]), {
    allowFailure: true,
  });
  const currentPane = /** @type {PaneResponse | null} */ (current)?.result?.pane;
  if (currentPane?.focused) return currentPane;

  return panes.find(
    (pane) =>
      pane.focused &&
      (!process.env.HERDR_ACTIVE_TAB_ID || pane.tab_id === process.env.HERDR_ACTIVE_TAB_ID) &&
      (!process.env.HERDR_ACTIVE_WORKSPACE_ID ||
        pane.workspace_id === process.env.HERDR_ACTIVE_WORKSPACE_ID),
  );
}

/**
 * @template T
 * @param {string} path
 * @returns {T | null}
 */
function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return /** @type {T} */ (JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

/**
 * @param {string} path
 * @param {unknown} value
 */
function writeJsonAtomically(path, value) {
  const temporaryPath = `${path}.${process.pid}`;
  writeFileSync(temporaryPath, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  renameSync(temporaryPath, path);
}

/**
 * @param {string} lockDirectory
 * @returns {boolean}
 */
function acquireLock(lockDirectory) {
  try {
    mkdirSync(lockDirectory);
  } catch {
    let lockPid = 0;
    try {
      lockPid = Number.parseInt(readFileSync(join(lockDirectory, "pid"), "utf8"), 10);
      process.kill(lockPid, 0);
      return false;
    } catch {
      rmSync(lockDirectory, { recursive: true, force: true });
      mkdirSync(lockDirectory);
    }
  }

  writeFileSync(join(lockDirectory, "pid"), `${process.pid}\n`);
  return true;
}

/**
 * @param {string} workspaceId
 * @param {string} cwd
 */
function vimSessionIdentity(workspaceId, cwd) {
  const id = createHash("sha256").update(`${workspaceId}\0${cwd}`).digest("hex").slice(0, 16);
  return {
    stateFile: join(vimSessionDirectory, `${id}.json`),
  };
}

/**
 * @param {Partial<VimSession> | null} session
 * @returns {session is VimSession}
 */
function validVimSession(session) {
  return Boolean(session?.cwd && session.workspace_id && session.pane_id && session.terminal_id);
}

/**
 * @param {Pane[]} panes
 * @param {Partial<VimSession>} session
 */
function findSessionPane(panes, session) {
  return panes.find(
    (pane) => pane.pane_id === session.pane_id && pane.terminal_id === session.terminal_id,
  );
}

/** @param {Pane} pane */
function requireTerminalId(pane) {
  if (!pane.terminal_id) throw new Error("could not determine the Vim pane terminal ID");
  return pane.terminal_id;
}

/**
 * @param {Pane} pane
 * @param {string} workspaceId
 */
function parkPane(pane, workspaceId) {
  const response = /** @type {PaneMoveResponse} */ (
    runHerdr([
      "pane",
      "move",
      pane.pane_id,
      "--new-tab",
      "--workspace",
      workspaceId,
      "--label",
      "vim-cache",
      "--no-focus",
    ])
  );
  return response.result.move_result.pane;
}

/**
 * @param {Pane} pane
 * @param {Pane} sourcePane
 */
function showPane(pane, sourcePane) {
  const response = /** @type {PaneMoveResponse} */ (
    runHerdr([
      "pane",
      "move",
      pane.pane_id,
      "--tab",
      sourcePane.tab_id,
      "--target-pane",
      sourcePane.pane_id,
      "--split",
      "down",
      "--ratio",
      "0.8",
      "--focus",
    ])
  );
  const movedPane = response.result.move_result.pane;
  runHerdr(["pane", "swap", "--pane", movedPane.pane_id, "--direction", "up"]);
  return movedPane;
}

/**
 * @param {Pane} sourcePane
 */
function createVimPane(sourcePane) {
  const response = /** @type {TabCreateResponse} */ (
    runHerdr([
      "tab",
      "create",
      "--workspace",
      sourcePane.workspace_id,
      "--cwd",
      sourcePane.cwd,
      "--label",
      "vim-cache",
      "--no-focus",
    ])
  );
  const pane = response.result.root_pane;

  try {
    runHerdr(["pane", "run", pane.pane_id, "vim", sourcePane.cwd]);
    return pane;
  } catch (error) {
    runHerdr(["pane", "close", pane.pane_id], { allowFailure: true });
    throw error;
  }
}

/**
 * @param {Pane[]} panes
 * @param {Pane} markedPane
 */
function findSessionStateForPane(panes, markedPane) {
  for (const entry of readdirSync(vimSessionDirectory)) {
    if (!entry.endsWith(".json")) continue;
    const stateFile = join(vimSessionDirectory, entry);
    const state = /** @type {Partial<VimSession> | null} */ (readJson(stateFile));
    if (!validVimSession(state)) continue;
    const pane = findSessionPane(panes, /** @type {Partial<VimSession>} */ (state));
    if (pane?.pane_id === markedPane.pane_id) {
      return { state: /** @type {VimSession} */ (state), stateFile };
    }
  }
  return null;
}

function main() {
  if (!pluginStateDirectory) {
    throw new Error("HERDR_PLUGIN_STATE_DIR is not set");
  }
  const paneList = runHerdr(/** @type {string[]} */ (["pane", "list"]));
  const panes = /** @type {PaneListResponse} */ (paneList).result.panes;
  const sourcePane = findSourcePane(panes);

  if (!sourcePane?.pane_id || !sourcePane.tab_id || !sourcePane.workspace_id || !sourcePane.cwd) {
    throw new Error("could not determine the focused pane, tab, and cwd");
  }

  mkdirSync(paneMarkerDirectory, { recursive: true });
  mkdirSync(vimSessionDirectory, { recursive: true });
  try {
    chmodSync(pluginStateDirectory, 0o700);
  } catch {
    // A restrictive mode is best effort on filesystems without POSIX modes.
  }

  const scope = `${encodeURIComponent(sourcePane.workspace_id)}__${encodeURIComponent(sourcePane.tab_id)}`;
  const paneMarkerFile = join(paneMarkerDirectory, `${scope}.json`);
  const paneLockDirectory = `${paneMarkerFile}.lock`;
  if (!acquireLock(paneLockDirectory)) return;

  try {
    const marker = /** @type {Partial<PaneMarker> | null} */ (readJson(paneMarkerFile));
    const markedPane = marker
      ? panes.find(
          (pane) =>
            pane.pane_id === marker.pane_id &&
            pane.terminal_id === marker.terminal_id &&
            pane.tab_id === sourcePane.tab_id &&
            pane.workspace_id === sourcePane.workspace_id,
        )
      : undefined;

    if (markedPane) {
      const sessionRecord = findSessionStateForPane(panes, markedPane);
      const parkedPane = parkPane(markedPane, sourcePane.workspace_id);
      const stateFile =
        sessionRecord?.stateFile ||
        vimSessionIdentity(sourcePane.workspace_id, markedPane.cwd).stateFile;
      writeJsonAtomically(stateFile, {
        cwd: sessionRecord?.state.cwd || markedPane.cwd,
        workspace_id: sourcePane.workspace_id,
        pane_id: parkedPane.pane_id,
        terminal_id: requireTerminalId(parkedPane),
      });
      rmSync(paneMarkerFile, { force: true });
      return;
    }
    rmSync(paneMarkerFile, { force: true });

    const identity = vimSessionIdentity(sourcePane.workspace_id, sourcePane.cwd);
    const sessionLockDirectory = `${identity.stateFile}.lock`;
    if (!acquireLock(sessionLockDirectory)) return;

    try {
      const state = /** @type {Partial<VimSession> | null} */ (readJson(identity.stateFile));
      let vimPane = validVimSession(state)
        ? findSessionPane(panes, /** @type {Partial<VimSession>} */ (state))
        : undefined;
      if (!vimPane) {
        rmSync(identity.stateFile, { force: true });
        vimPane = createVimPane(sourcePane);
      }

      let movedPane;
      try {
        movedPane = showPane(vimPane, sourcePane);
      } catch (error) {
        if (vimPane.tab_id !== sourcePane.tab_id) {
          parkPane(vimPane, sourcePane.workspace_id);
        }
        throw error;
      }

      writeJsonAtomically(identity.stateFile, {
        cwd: sourcePane.cwd,
        workspace_id: sourcePane.workspace_id,
        pane_id: movedPane.pane_id,
        terminal_id: requireTerminalId(movedPane),
      });
      writeJsonAtomically(paneMarkerFile, {
        pane_id: movedPane.pane_id,
        terminal_id: requireTerminalId(movedPane),
      });
    } finally {
      rmSync(sessionLockDirectory, { recursive: true, force: true });
    }
  } finally {
    rmSync(paneLockDirectory, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`split-vim-above: ${message}`);
  process.exitCode = 1;
}
