// @ts-check

import { Buffer } from "node:buffer";
import * as childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import * as net from "node:net";
import * as path from "node:path";
import process from "node:process";
import { Readable, Writable } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import * as tty from "node:tty";
import * as url from "node:url";
import * as util from "node:util";
import { setRuntime } from "@unblessed/core";

setRuntime({
  fs,
  path,
  process,
  buffer: { Buffer },
  url,
  util,
  stream: { Readable, Writable },
  stringDecoder: { StringDecoder },
  events: { EventEmitter },
  processes: { childProcess },
  networking: { net, tty },
});
