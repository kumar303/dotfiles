// @ts-check

import { execFileSync } from "node:child_process";

/** @typedef {(args: string[]) => unknown} HerdrRunner */

/**
 * @typedef {object} AgentInfo
 * @property {string} paneId
 * @property {string} label
 * @property {string} status
 */

/**
 * @param {string} workspaceId
 * @param {HerdrRunner} [run]
 * @returns {AgentInfo[]}
 */
export function listWorkspaceAgents(workspaceId, run = runHerdr) {
  const response = /** @type {any} */ (run(["agent", "list"]));
  const agents = response?.result?.agents;
  if (!Array.isArray(agents)) throw new Error("Herdr agent list lacks agents");

  return agents.flatMap((agent) => {
    if (agent?.workspace_id !== workspaceId || typeof agent?.pane_id !== "string") {
      return [];
    }
    return [
      {
        paneId: agent.pane_id,
        label: firstString(agent.name, agent.display_agent, agent.agent, agent.pane_id),
        status: typeof agent.agent_status === "string" ? agent.agent_status : "unknown",
      },
    ];
  });
}

/**
 * @param {string} paneId
 * @param {string} prompt
 * @param {HerdrRunner} [run]
 */
export function promptAgent(paneId, prompt, run = runHerdr) {
  run(["agent", "prompt", paneId, prompt]);
}

/**
 * @param {string[]} args
 * @returns {unknown}
 */
export function runHerdr(args) {
  const output = execFileSync(requiredEnvironment("HERDR_BIN_PATH"), args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10000,
  });
  return JSON.parse(output);
}

/** @param {...unknown} values */
function firstString(...values) {
  const value = values.find((candidate) => typeof candidate === "string" && candidate.length > 0);
  return typeof value === "string" ? value : "agent";
}

/** @param {string} name */
function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing environment variable: ${name}`);
  return value;
}
