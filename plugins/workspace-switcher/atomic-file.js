// @ts-check

import { randomUUID } from "node:crypto";
import { closeSync, fsyncSync, openSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/**
 * Replace a file with one same-directory rename. The old file remains intact until
 * the complete replacement reaches disk.
 *
 * @param {string} file
 * @param {string} contents
 */
export function writeFileAtomically(file, contents) {
  const directory = dirname(file);
  const temporary = join(directory, `.${basename(file)}.${process.pid}.${randomUUID()}.tmp`);
  let descriptor;
  let failure;
  try {
    descriptor = openSync(temporary, "wx", 0o600);
    writeFileSync(descriptor, contents, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    renameSync(temporary, file);
    syncDirectory(directory);
  } catch (error) {
    failure = error;
  }

  try {
    if (descriptor !== undefined) closeSync(descriptor);
  } catch (error) {
    failure ??= error;
  }
  try {
    rmSync(temporary, { force: true });
  } catch (error) {
    failure ??= error;
  }
  if (failure) throw failure;
}

/** @param {string} directory */
function syncDirectory(directory) {
  const descriptor = openSync(directory, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}
