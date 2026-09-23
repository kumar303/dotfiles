#!/usr/bin/env node
// @ts-check

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { openPickerPopup } from "./herdr.js";

const sync = spawn(
  process.execPath,
  [fileURLToPath(new URL("./sync-workspaces.js", import.meta.url))],
  {
    detached: true,
    env: process.env,
    stdio: "ignore",
  },
);
sync.unref();
openPickerPopup();
