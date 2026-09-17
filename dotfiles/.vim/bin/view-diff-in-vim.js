#!/usr/bin/env node
// @ts-check

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** @typedef {"working" | "branch"} DiffMode */
/** @typedef {"add" | "change"} ChangeKind */
/** @typedef {{commit: string, name: string}} BranchBase */
/** @typedef {{kind: ChangeKind, line: number, path: string}} Sign */
/** @typedef {Sign & {text: string, hunk: string}} Location */
/** @typedef {{version: 1, workspace: string, mode: DiffMode, hideTests: boolean}} StoredState */
/** @typedef {{active: true, base?: BranchBase, hideTests: boolean, locations: Location[], mode: DiffMode, position: number, signs: Sign[]}} View */

const stateDirectory =
  process.env.VIEW_DIFF_IN_VIM_STATE_DIR ?? join(homedir(), ".cache", "view-diff-in-vim");

/**
 * @param {string} cwd
 * @param {string[]} arguments_
 * @param {{allowFailure?: boolean, encoding?: "buffer" | "utf8"}} [options]
 * @returns {Buffer | string}
 */
function git(cwd, arguments_, options = {}) {
  try {
    return execFileSync("git", arguments_, {
      cwd,
      encoding: options.encoding === "buffer" ? "buffer" : "utf8",
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10_000,
    });
  } catch (error) {
    if (options.allowFailure) return options.encoding === "buffer" ? Buffer.alloc(0) : "";
    const detail =
      error && typeof error === "object" && "stderr" in error
        ? String(error.stderr).trim()
        : String(error);
    throw new Error(detail || `git ${arguments_.join(" ")} failed`);
  }
}

/** @param {string} workspace */
function repositoryRoot(workspace) {
  const output = String(git(workspace, ["rev-parse", "--show-toplevel"])).trim();
  return resolve(output);
}

/** @param {string} workspace */
function statePath(workspace) {
  const key = createHash("sha256").update(resolve(workspace)).digest("hex").slice(0, 24);
  return join(stateDirectory, `${key}.json`);
}

/** @param {string} workspace @param {DiffMode} mode @param {boolean} hideTests */
function storeState(workspace, mode, hideTests) {
  mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  /** @type {StoredState} */
  const state = { version: 1, workspace: resolve(workspace), mode, hideTests };
  writeFileSync(statePath(workspace), `${JSON.stringify(state)}\n`, { mode: 0o600 });
}

/** @param {string} workspace @returns {StoredState | null} */
function loadState(workspace) {
  const path = statePath(workspace);
  if (!existsSync(path)) return null;
  const value = /** @type {unknown} */ (JSON.parse(readFileSync(path, "utf8")));
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("workspace" in value) ||
    value.workspace !== resolve(workspace) ||
    !("mode" in value) ||
    (value.mode !== "working" && value.mode !== "branch") ||
    ("hideTests" in value && typeof value.hideTests !== "boolean")
  ) {
    return null;
  }
  return {
    version: 1,
    workspace: value.workspace,
    mode: value.mode,
    hideTests: "hideTests" in value ? value.hideTests === true : false,
  };
}

/** @param {string} cwd */
function currentBranch(cwd) {
  return String(git(cwd, ["branch", "--show-current"], { allowFailure: true })).trim();
}

/**
 * @param {string} log
 * @param {string} branch
 * @returns {BranchBase | null}
 */
function parseRemoteBranchPoint(log, branch) {
  for (const line of log.split("\n")) {
    if (!line.trim()) continue;
    const commit = line.slice(0, 40);
    const decorations = line.match(/\((.+)\)/)?.[1];
    if (!decorations) continue;
    for (const reference of decorations.split(",").map((value) => value.trim())) {
      if (branch && reference === `origin/${branch}`) continue;
      if (reference.startsWith("origin/")) return { commit, name: reference };
    }
  }
  return null;
}

/**
 * @param {string} cwd
 * @param {string} branch
 * @returns {string[]}
 */
function branchCandidates(cwd, branch) {
  /** @type {string[]} */
  const candidates = [];
  try {
    const commonDirectory = String(
      git(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]),
    ).trim();
    const state = JSON.parse(readFileSync(join(commonDirectory, ".gs", "state.json"), "utf8"));
    if (state.version !== 1)
      throw new Error(`Unsupported GitStream state version: ${state.version}`);
    const parent = state.branches?.[branch]?.parent;
    if (!parent) throw new Error(`No GitStream parent recorded for ${branch}`);
    const trunk = state.trunks?.[parent];
    candidates.push(trunk?.remote && trunk?.target ? `${trunk.remote}/${trunk.target}` : parent);
  } catch {
    // Repositories without GitStream state use the normal remote candidates below.
  }
  const originHead = String(
    git(cwd, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], {
      allowFailure: true,
    }),
  ).trim();
  if (originHead) candidates.push(originHead);
  candidates.push("origin/main", "origin/master", "main", "master");
  return [...new Set(candidates)];
}

/** @param {string} cwd @returns {BranchBase} */
function findBranchBase(cwd) {
  const branch = currentBranch(cwd);
  const log = String(
    git(
      cwd,
      [
        "log",
        "--format=%H%d",
        "--decorate=short",
        "--decorate-refs=refs/remotes/",
        "--first-parent",
        "-n",
        "1000",
      ],
      { allowFailure: true },
    ),
  );
  const branchPoint = parseRemoteBranchPoint(log, branch);
  if (branchPoint) return branchPoint;

  for (const candidate of branchCandidates(cwd, branch)) {
    const valid = String(
      git(cwd, ["rev-parse", "--verify", "--quiet", `${candidate}^{commit}`], {
        allowFailure: true,
      }),
    ).trim();
    if (!valid) continue;
    const commit = String(
      git(cwd, ["merge-base", "HEAD", candidate], { allowFailure: true }),
    ).trim();
    if (commit) return { commit, name: candidate };
  }
  throw new Error("Could not determine the branch point");
}

/** @param {string} cwd */
function untrackedFiles(cwd) {
  const output = /** @type {Buffer} */ (
    git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"], {
      encoding: "buffer",
    })
  );
  return output.toString("utf8").split("\0").filter(Boolean);
}

/** @param {string} root @param {string} path @param {number} line */
function lineText(root, path, line) {
  const file = join(root, path);
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf8").split(/\r?\n/)[line - 1] ?? "";
}

/**
 * @param {string} diff
 * @param {string} root
 * @returns {{locations: Location[], signs: Sign[]}}
 */
function parseDiff(diff, root) {
  /** @type {Location[]} */
  const locations = [];
  /** @type {Sign[]} */
  const signs = [];
  const lines = diff.split("\n");
  /** @type {string[]} */
  let headers = [];
  let path = "";
  let deletedFile = false;

  for (let index = 0; index < lines.length; index += 1) {
    const diffLine = lines[index];
    if (diffLine.startsWith("diff --git ")) {
      headers = [diffLine];
      path = "";
      deletedFile = false;
      continue;
    }
    if (diffLine.startsWith("+++ ")) {
      path = diffLine.slice(4);
      deletedFile = path === "/dev/null";
    }
    const match = diffLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (!match) {
      if (headers.length > 0) headers.push(diffLine);
      continue;
    }
    let end = index + 1;
    while (
      end < lines.length &&
      !lines[end].startsWith("@@ ") &&
      !lines[end].startsWith("diff --git ")
    ) {
      end += 1;
    }
    if (!path || deletedFile) {
      index = end - 1;
      continue;
    }
    const hunk = [...headers, ...lines.slice(index, end)].join("\n");
    let newLine = Number(match[1]);
    let deletedLines = 0;
    /** @type {number[]} */
    let addedLines = [];
    /** @type {ChangeKind} */
    let firstKind = "change";
    let firstLine = 0;
    const flushChange = () => {
      if (addedLines.length === 0) {
        deletedLines = 0;
        return;
      }
      /** @type {ChangeKind} */
      const kind = deletedLines === 0 ? "add" : "change";
      const line = Math.max(1, addedLines[0]);
      if (firstLine === 0) {
        firstKind = kind;
        firstLine = line;
      }
      for (const addedLine of addedLines) signs.push({ kind, line: addedLine, path });
      deletedLines = 0;
      addedLines = [];
    };
    for (const contentLine of lines.slice(index + 1, end)) {
      if (contentLine.startsWith("-")) {
        deletedLines += 1;
      } else if (contentLine.startsWith("+")) {
        addedLines.push(newLine);
        newLine += 1;
      } else if (contentLine.startsWith(" ")) {
        flushChange();
        newLine += 1;
      }
    }
    flushChange();
    if (firstLine > 0) {
      locations.push({
        kind: firstKind,
        line: firstLine,
        path,
        text: lineText(root, path, firstLine).trim(),
        hunk,
      });
    }
    index = end - 1;
  }
  return { locations, signs };
}

/**
 * @param {string} root
 * @param {string[]} paths
 * @returns {{locations: Location[], signs: Sign[]}}
 */
function untrackedChanges(root, paths) {
  /** @type {Location[]} */
  const locations = [];
  /** @type {Sign[]} */
  const signs = [];
  for (const path of paths) {
    const lines = readFileSync(join(root, path), "utf8").split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();
    const count = Math.max(1, lines.length);
    const hunk = addedFileDiff(path, lines.join("\n"));
    locations.push({ kind: "add", line: 1, path, text: lines[0]?.trim() ?? "", hunk });
    for (let line = 1; line <= count; line += 1) signs.push({ kind: "add", line, path });
  }
  return { locations, signs };
}

/**
 * @param {string} root
 * @param {DiffMode} mode
 * @param {number} unified
 * @param {string} [path]
 */
function diffCommand(root, mode, unified, path) {
  /** @type {BranchBase | undefined} */
  let base;
  const arguments_ = [
    "diff",
    `--unified=${unified}`,
    "--no-color",
    "--no-ext-diff",
    "--find-renames",
    "--no-prefix",
  ];
  if (mode === "working") {
    const hasHead = String(
      git(root, ["rev-parse", "--verify", "HEAD"], { allowFailure: true }),
    ).trim();
    if (hasHead) arguments_.push("HEAD");
  } else {
    base = findBranchBase(root);
    arguments_.push(base.commit);
  }
  arguments_.push("--");
  if (path) arguments_.push(path);
  return { arguments_, base };
}

/**
 * @param {string} root
 * @param {DiffMode} mode
 * @returns {{base?: BranchBase, locations: Location[], signs: Sign[]}}
 */
function calculate(root, mode) {
  const { arguments_, base } = diffCommand(root, mode, 3);
  const diff = String(git(root, arguments_));
  const parsed = parseDiff(diff, root);
  const untracked = untrackedChanges(root, untrackedFiles(root));
  return {
    ...(base ? { base } : {}),
    locations: [...parsed.locations, ...untracked.locations],
    signs: [...parsed.signs, ...untracked.signs],
  };
}

/** @param {string} path @param {string} content */
function addedFileDiff(path, content) {
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return [
    `diff --git ${path} ${path}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ ${path}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
    "",
  ].join("\n");
}

/**
 * @param {{base?: BranchBase, locations: Location[], signs: Sign[]}} result
 * @param {string} repository
 * @param {string} workspace
 */
function makeWorkspaceRelative(result, repository, workspace) {
  /** @param {string} path */
  const rebase = (path) => relative(workspace, resolve(repository, path));
  return {
    ...(result.base ? { base: result.base } : {}),
    locations: result.locations.map((location) => ({
      ...location,
      path: rebase(location.path),
    })),
    signs: result.signs.map((sign) => ({ ...sign, path: rebase(sign.path) })),
  };
}

/**
 * @param {Location[]} locations
 * @param {string} root
 * @param {string} currentFile
 * @param {number} currentLine
 */
function nextPosition(locations, root, currentFile, currentLine) {
  if (locations.length === 0) return 0;
  const unresolvedFile = isAbsolute(currentFile)
    ? resolve(currentFile)
    : resolve(root, currentFile);
  const absoluteFile = existsSync(unresolvedFile) ? realpathSync(unresolvedFile) : unresolvedFile;
  const path = relative(root, absoluteFile);
  const after = locations.findIndex(
    (location) => location.path === path && location.line > currentLine,
  );
  if (after >= 0) return after + 1;
  let lastInFile = -1;
  for (let index = locations.length - 1; index >= 0; index -= 1) {
    if (locations[index].path === path) {
      lastInFile = index;
      break;
    }
  }
  return lastInFile >= 0 && lastInFile + 1 < locations.length ? lastInFile + 2 : 1;
}

/**
 * @param {string} workspace
 * @param {DiffMode} mode
 * @param {string} [currentFile]
 * @param {number} [currentLine]
 * @param {boolean} [hideTests]
 * @returns {View}
 */
function buildView(workspace, mode, currentFile = "", currentLine = 0, hideTests = false) {
  const workspaceRoot = realpathSync(workspace);
  const root = repositoryRoot(workspaceRoot);
  const result = makeWorkspaceRelative(calculate(root, mode), root, workspaceRoot);
  const locations = hideTests
    ? result.locations.filter((location) => !location.path.includes("test"))
    : result.locations;
  return {
    active: true,
    ...result,
    hideTests,
    locations,
    mode,
    position: currentFile ? nextPosition(locations, workspaceRoot, currentFile, currentLine) : 1,
  };
}

/** @param {unknown} value */
function output(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

/** @param {string[]} arguments_ */
function main(arguments_) {
  const [command, workspaceArgument, ...rest] = arguments_;
  if (!command || !workspaceArgument)
    throw new Error("Usage: view-diff-in-vim.js <command> <workspace>");
  const workspace = resolve(workspaceArgument);

  if (command === "state-path") {
    output({ path: statePath(workspace) });
    return;
  }
  if (command === "choices") {
    repositoryRoot(workspace);
    const status = String(git(workspace, ["status", "--porcelain", "--untracked-files=normal"]));
    output([
      ...(status.trim() ? [{ id: "working", label: "Uncommitted diff" }] : []),
      { id: "branch", label: "Branch diff" },
    ]);
    return;
  }
  if (command === "clear") {
    rmSync(statePath(workspace), { force: true });
    output({ cleared: true });
    return;
  }
  if (command === "toggle-tests") {
    const state = loadState(workspace);
    if (!state) throw new Error("No active Vim diff session");
    state.hideTests = !state.hideTests;
    storeState(workspace, state.mode, state.hideTests);
    output({ hideTests: state.hideTests });
    return;
  }
  if (command === "start") {
    const mode = rest[0];
    if (mode !== "working" && mode !== "branch") throw new Error(`Unknown diff mode: ${mode}`);
    const view = buildView(workspace, mode);
    storeState(workspace, mode, false);
    output(view);
    return;
  }
  if (command === "refresh") {
    const state = loadState(workspace);
    if (!state) {
      output({ active: false });
      return;
    }
    output(buildView(workspace, state.mode, rest[0] ?? "", Number(rest[1] ?? 0), state.hideTests));
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
