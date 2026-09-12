#!/usr/bin/env node
// @ts-check

import { readFileSync, rmSync } from "node:fs";
import { followUpAgent, listWorkspaceAgents, promptAgent } from "./herdr-agent.js";

const [command, ...args] = process.argv.slice(2);

if (command === "list") {
  const [workspaceId] = args;
  if (!workspaceId) throw new Error("usage: agent-prompt.js list WORKSPACE_ID");
  process.stdout.write(`${JSON.stringify(listWorkspaceAgents(workspaceId))}\n`);
} else if (command === "send") {
  const [target, promptPath, mode = "steer"] = args;
  if (!target || !promptPath || !["steer", "follow-up"].includes(mode)) {
    throw new Error("usage: agent-prompt.js send TARGET PROMPT_FILE [steer|follow-up]");
  }
  try {
    const prompt = readFileSync(promptPath, "utf8").replace(/\n$/, "");
    if (mode === "follow-up") followUpAgent(target, prompt);
    else promptAgent(target, prompt);
  } finally {
    rmSync(promptPath, { force: true });
  }
} else {
  throw new Error("usage: agent-prompt.js list|send ...");
}
