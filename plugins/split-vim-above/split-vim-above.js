#!/usr/bin/env node
// @ts-check

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

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
/** @typedef {{result: {process_info: {foreground_processes: Array<{name?: string, argv0?: string}>}}}} PaneProcessInfoResponse */
/** @typedef {{pane_id: string, terminal_id: string}} PaneMarker */
/** @typedef {["leaf", number] | ["row" | "col", VimLayout[]]} VimLayout */
/** @typedef {{lnum: number, col: number, topline: number, leftcol: number}} VimView */
/** @typedef {{file: string, view: VimView, focused: boolean}} RestoredWindow */
/** @typedef {["leaf", RestoredWindow] | ["row" | "col", RestoredLayout[]]} RestoredLayout */
/** @typedef {{layout: VimLayout, windows: Array<{id: number, file: string, view: VimView}>, focused: number}} VimState */

const herdrCommand = process.env.HERDR_BIN_PATH || "herdr";
const stateHome = process.env.XDG_STATE_HOME || join(process.env.HOME || "", ".local", "state");
const pluginStateDirectory =
  process.env.HERDR_PLUGIN_STATE_DIR ||
  join(stateHome, "herdr", "plugins", "kumar303.split-vim-above");
const paneMarkerDirectory = join(pluginStateDirectory, "pane-markers");
const vimLayoutDirectory = join(pluginStateDirectory, "vim-layouts");
const fileOptionIndex = process.argv.indexOf("--file");
const requestedFileArgument = fileOptionIndex >= 0 ? process.argv[fileOptionIndex + 1] : undefined;
if (fileOptionIndex >= 0 && !requestedFileArgument) throw new Error("--file requires a path");

/**
 * @param {string[]} args
 * @param {{allowFailure?: boolean}} [options]
 */
function runHerdrProcess(args, options = {}) {
  const result = spawnSync(herdrCommand, args, { encoding: "utf8", env: process.env });
  if (result.error) throw new Error(`could not run ${herdrCommand}: ${result.error.message}`);
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

/** @param {Pane[]} panes */
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

/** @template T @param {string} path @returns {T | null} */
function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return /** @type {T} */ (JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

/** @param {string} path @param {unknown} value */
function writeJsonAtomically(path, value) {
  const temporaryPath = `${path}.${process.pid}`;
  writeFileSync(temporaryPath, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  renameSync(temporaryPath, path);
}

/** @param {string} lockDirectory */
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

/** @param {string} workspaceId */
function vimLayoutPath(workspaceId) {
  const id = createHash("sha256").update(workspaceId).digest("hex").slice(0, 16);
  return join(vimLayoutDirectory, `${id}.json`);
}

/** @param {Pane} pane */
function requireTerminalId(pane) {
  if (!pane.terminal_id) throw new Error("could not determine the Vim pane terminal ID");
  return pane.terminal_id;
}

/** @param {Pane} pane @param {Pane} sourcePane */
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

/** @param {string} value */
function vimSingleQuoted(value) {
  if (/[\r\n]/.test(value)) throw new Error("file path must not contain a newline");
  return value.replaceAll("'", "''");
}

/** @param {Pane} pane @param {string} file */
function openFileInVim(pane, file) {
  runHerdr(["pane", "send-keys", pane.pane_id, "esc"]);
  runHerdr([
    "pane",
    "send-text",
    pane.pane_id,
    `:execute (empty(filter(getbufinfo({'bufloaded': 1}), '!empty(v:val.name) && getbufvar(v:val.bufnr, "&buftype") ==# ""')) ? 'edit ' : 'rightbelow vsplit ') . fnameescape('${vimSingleQuoted(file)}')`,
  ]);
  runHerdr(["pane", "send-keys", pane.pane_id, "enter"]);
}

/** @param {unknown} layout @returns {layout is VimLayout} */
function validVimLayout(layout) {
  if (!Array.isArray(layout) || layout.length !== 2) return false;
  if (layout[0] === "leaf") return Number.isInteger(layout[1]);
  return (
    (layout[0] === "row" || layout[0] === "col") &&
    Array.isArray(layout[1]) &&
    layout[1].every(validVimLayout)
  );
}

/** @param {unknown} view @returns {view is VimView} */
function validVimView(view) {
  if (!view || typeof view !== "object") return false;
  const candidate = /** @type {Partial<VimView>} */ (view);
  return [candidate.lnum, candidate.col, candidate.topline, candidate.leftcol].every(
    Number.isInteger,
  );
}

/** @param {unknown} state @returns {state is VimState} */
function validVimState(state) {
  if (!state || typeof state !== "object") return false;
  const candidate = /** @type {Partial<VimState>} */ (state);
  return (
    validVimLayout(candidate.layout) &&
    Number.isInteger(candidate.focused) &&
    Array.isArray(candidate.windows) &&
    candidate.windows.every(
      (window) =>
        Number.isInteger(window?.id) &&
        typeof window?.file === "string" &&
        validVimView(window.view),
    )
  );
}

/**
 * @param {VimState | null} state
 * @param {string | null} requestedFile
 * @returns {RestoredLayout | null}
 */
function restoredLayout(state, requestedFile) {
  if (!state) {
    return requestedFile
      ? [
          "leaf",
          {
            file: requestedFile,
            view: { lnum: 1, col: 0, topline: 1, leftcol: 0 },
            focused: false,
          },
        ]
      : null;
  }
  const windows = new Map(state.windows.map((window) => [window.id, window]));
  const focusedWindowId = state.focused;
  const defaultView = { lnum: 1, col: 0, topline: 1, leftcol: 0 };

  /** @param {VimLayout} layout @returns {RestoredLayout | null} */
  function restore(layout) {
    if (layout[0] === "leaf") {
      const remembered = windows.get(layout[1]);
      if (!remembered) return null;
      const file = remembered.file;
      const view = remembered.view;
      const focused = requestedFile === null && remembered.id === focusedWindowId;
      return file && existsSync(file) ? ["leaf", { file, view, focused }] : null;
    }

    const children = layout[1].map(restore).filter((child) => child !== null);
    if (children.length === 0) return null;
    if (children.length === 1) return children[0];
    return [layout[0], children];
  }

  const layout = restore(state.layout);
  if (requestedFile) {
    const requestedWindow = /** @type {RestoredLayout} */ ([
      "leaf",
      { file: requestedFile, view: defaultView, focused: true },
    ]);
    return layout ? ["row", [layout, requestedWindow]] : requestedWindow;
  }
  return layout;
}

/** @param {string} path @param {RestoredLayout} layout */
function writeRestoreScript(path, layout) {
  const encodedLayout = vimSingleQuoted(JSON.stringify(layout));
  const script = `let s:layout = json_decode('${encodedLayout}')
let s:focused_window = 0
function! s:restore_layout(layout, window_id) abort
  call win_gotoid(a:window_id)
  if a:layout[0] ==# 'leaf'
    execute 'edit ' . fnameescape(a:layout[1].file)
    call winrestview(a:layout[1].view)
    if a:layout[1].focused
      let s:focused_window = win_getid()
    endif
    return
  endif
  let l:window_ids = [a:window_id]
  for l:index in range(1, len(a:layout[1]) - 1)
    call win_gotoid(l:window_ids[-1])
    if a:layout[0] ==# 'row'
      rightbelow vsplit
    else
      rightbelow split
    endif
    call add(l:window_ids, win_getid())
  endfor
  for l:index in range(0, len(a:layout[1]) - 1)
    call s:restore_layout(a:layout[1][l:index], l:window_ids[l:index])
  endfor
endfunction
call s:restore_layout(s:layout, win_getid())
unlet s:layout
if s:focused_window
  call win_gotoid(s:focused_window)
else
  wincmd t
endif
unlet s:focused_window
`;
  writeFileSync(path, script, { mode: 0o600 });
}

/** @param {Pane} sourcePane @param {string | null} requestedFile @param {string} layoutPath */
function createVimPane(sourcePane, requestedFile, layoutPath) {
  const response = /** @type {TabCreateResponse} */ (
    runHerdr([
      "tab",
      "create",
      "--workspace",
      sourcePane.workspace_id,
      "--cwd",
      sourcePane.cwd,
      "--label",
      "vim",
      "--no-focus",
    ])
  );
  const pane = response.result.root_pane;
  const rememberedState = readJson(layoutPath);
  const state = validVimState(rememberedState) ? rememberedState : null;
  const layout = restoredLayout(state, requestedFile);

  try {
    if (layout && state) {
      const restoreScript = `${layoutPath}.vim`;
      writeRestoreScript(restoreScript, layout);
      runHerdr(["pane", "run", pane.pane_id, "vim", "-S", restoreScript]);
    } else {
      runHerdr([
        "pane",
        "run",
        pane.pane_id,
        "vim",
        layout?.[0] === "leaf" ? layout[1].file : sourcePane.cwd,
      ]);
    }
    return pane;
  } catch (error) {
    runHerdr(["pane", "close", pane.pane_id], { allowFailure: true });
    throw error;
  }
}

/** @param {string} paneId */
function waitForVimInput(paneId) {
  const waiter = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const response = /** @type {PaneProcessInfoResponse | null} */ (
      runHerdr(["pane", "process-info", "--pane", paneId], { allowFailure: true })
    );
    const processes = response?.result?.process_info?.foreground_processes;
    if (
      Array.isArray(processes) &&
      processes.some((process) =>
        [process.name, process.argv0].some(
          (name) => typeof name === "string" && name.split("/").at(-1)?.toLowerCase() === "vim",
        ),
      )
    ) {
      return;
    }
    Atomics.wait(waiter, 0, 0, 25);
  }
  throw new Error("Vim did not regain terminal input after Escape; the pane remains open");
}

/** @param {Pane} pane @param {string} layoutPath */
function saveLayoutAndClose(pane, layoutPath) {
  const capturePath = `${layoutPath}.capture.${process.pid}`;
  rmSync(capturePath, { force: true });
  const command = `:call writefile([json_encode({'layout': winlayout(), 'focused': win_getid(), 'windows': map(getwininfo(), '{"id": v:val.winid, "file": fnamemodify(bufname(v:val.bufnr), ":p"), "view": {"lnum": getcurpos(v:val.winid)[1], "col": getcurpos(v:val.winid)[2] - 1, "topline": v:val.topline, "leftcol": v:val.leftcol}}')})], '${vimSingleQuoted(capturePath)}')`;
  runHerdr(["pane", "send-keys", pane.pane_id, "esc"]);
  waitForVimInput(pane.pane_id);
  runHerdr(["pane", "send-text", pane.pane_id, command]);
  runHerdr(["pane", "send-keys", pane.pane_id, "enter"]);

  const waiter = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + 2_000;
  let capturedState = null;
  while (Date.now() < deadline) {
    const candidate = readJson(capturePath);
    if (validVimState(candidate)) {
      capturedState = candidate;
      break;
    }
    Atomics.wait(waiter, 0, 0, 25);
  }
  rmSync(capturePath, { force: true });
  if (!capturedState) {
    throw new Error("Vim did not save its split layout; the pane remains open");
  }

  writeJsonAtomically(layoutPath, capturedState);
  runHerdr(["pane", "send-keys", pane.pane_id, "esc"]);
  runHerdr(["pane", "send-text", pane.pane_id, ":qa!"]);
  runHerdr(["pane", "send-keys", pane.pane_id, "enter"]);
  runHerdr(["pane", "close", pane.pane_id]);
}

function main() {
  const paneList = runHerdr(/** @type {string[]} */ (["pane", "list"]));
  const panes = /** @type {PaneListResponse} */ (paneList).result.panes;
  const sourcePane = findSourcePane(panes);
  if (!sourcePane?.pane_id || !sourcePane.tab_id || !sourcePane.workspace_id || !sourcePane.cwd) {
    throw new Error("could not determine the focused pane, tab, and cwd");
  }
  const requestedFile = requestedFileArgument
    ? resolve(sourcePane.cwd, requestedFileArgument)
    : null;

  mkdirSync(paneMarkerDirectory, { recursive: true });
  mkdirSync(vimLayoutDirectory, { recursive: true });
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
    const layoutPath = vimLayoutPath(sourcePane.workspace_id);

    if (markedPane) {
      if (requestedFile) {
        openFileInVim(markedPane, requestedFile);
        runHerdr(["pane", "focus", "--direction", "up", "--pane", sourcePane.pane_id]);
        return;
      }
      saveLayoutAndClose(markedPane, layoutPath);
      rmSync(paneMarkerFile, { force: true });
      return;
    }

    rmSync(paneMarkerFile, { force: true });
    const vimPane = createVimPane(sourcePane, requestedFile, layoutPath);
    const movedPane = showPane(vimPane, sourcePane);
    writeJsonAtomically(paneMarkerFile, {
      pane_id: movedPane.pane_id,
      terminal_id: requireTerminalId(movedPane),
    });
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
