#!/usr/bin/env node
// @ts-check

import { readFileSync, rmSync } from "node:fs";
import { listWorkspaceAgents, promptAgent } from "./herdr-agent.js";

const [command, ...args] = process.argv.slice(2);

if (command === "list") {
  const [workspaceId] = args;
  if (!workspaceId) throw new Error("usage: agent-prompt.js list WORKSPACE_ID");
  process.stdout.write(`${JSON.stringify(listWorkspaceAgents(workspaceId))}\n`);
} else if (command === "send") {
  const [target, promptPath] = args;
  if (!target || !promptPath) throw new Error("usage: agent-prompt.js send TARGET PROMPT_FILE");
  try {
    promptAgent(target, readFileSync(promptPath, "utf8").replace(/\n$/, ""));
  } finally {
    rmSync(promptPath, { force: true });
  }
} else {
  throw new Error("usage: agent-prompt.js list|send ...");
}
