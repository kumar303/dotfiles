#!/usr/bin/env node
// @ts-check

import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { basename, dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import { gfmHeadingId } from "marked-gfm-heading-id";
import sanitizeHtml from "sanitize-html";
import { all, createStarryNight } from "@wooorm/starry-night";
import { toHtml } from "hast-util-to-html";

const scriptPath = fileURLToPath(import.meta.url);
const assets = dirname(scriptPath);
const mermaidDirectory = dirname(fileURLToPath(import.meta.resolve("mermaid")));
const cssPath = fileURLToPath(import.meta.resolve("github-markdown-css/github-markdown.css"));
const highlightCssPath = fileURLToPath(import.meta.resolve("@wooorm/starry-night/style/both"));

/** @param {string} text */
function escapeHtml(text) {
  return text.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

/** Reuse GitHub's full Linguist grammar collection across document changes. */
export async function createMarkdownRenderer() {
  const highlighter = await createStarryNight(all);
  const markdown = new Marked({
    gfm: true,
    renderer: {
      code({ text, lang }) {
        const language = lang?.trim().split(/\s+/)[0] ?? "text";
        if (language === "mermaid") return `<pre class="mermaid">${escapeHtml(text)}</pre>`;
        const scope = highlighter.flagToScope(language);
        const highlighted = scope ? toHtml(highlighter.highlight(text, scope)) : escapeHtml(text);
        return `<pre><code>${highlighted}</code></pre>`;
      },
    },
  });
  markdown.use(gfmHeadingId());
  return {
    /** @param {string} source */
    async render(source) {
      const tokens = markdown.lexer(source);
      const html = markdown
        .parser(tokens)
        .replace(
          /<blockquote>\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\n|<br>)/g,
          (_, kind) =>
            `<blockquote class="markdown-alert markdown-alert-${kind.toLowerCase()}"><p class="markdown-alert-title">${kind[0]}${kind.slice(1).toLowerCase()}</p><p>`,
        );
      return sanitizeHtml(html, {
        allowedTags: [
          ...sanitizeHtml.defaults.allowedTags,
          "img",
          "input",
          "details",
          "summary",
          "del",
        ],
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          "*": ["class", "id"],
          pre: ["class", "tabindex"],
          input: ["type", "checked", "disabled"],
          a: ["href", "name", "target", "rel"],
          img: ["src", "alt", "title", "width", "height"],
        },
        transformTags: {
          input: (_tag, attributes) => ({
            tagName: "input",
            attribs: { ...attributes, type: "checkbox", disabled: "" },
          }),
        },
      });
    },
  };
}

/** @param {string} file @param {string} base @param {string | undefined} [error] */
function page(file, base, error) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(basename(file))}</title><link rel="stylesheet" href="${base}github.css"><link rel="stylesheet" href="${base}highlight.css"><link rel="stylesheet" href="${base}preview.css"></head><body><div id="status" role="status">${escapeHtml(error ?? "Loading Markdown…")}</div><article class="markdown-body" id="markdown"></article>${error ? "" : `<script type="module" src="${base}preview.js"></script>`}</body></html>`;
}

/**
 * @param {string} inputFile
 * @param {{idleMs?: number, openBrowser?: (url: string) => void}} [options]
 */
export async function startMarkdownPreview(inputFile, options = {}) {
  const file = resolve(inputFile);
  const base = `/${randomBytes(24).toString("hex")}/`;
  const idleMs = options.idleMs ?? 15 * 60 * 1000;
  const markdownFile = /\.(md|markdown|mdown|mkd|mkdn)$/i.test(file);
  const invalidFileError = markdownFile
    ? undefined
    : `Cannot preview ${basename(file)}: the file is not Markdown. The preview server stopped.`;
  /** @type {Set<import("node:http").ServerResponse>} */
  const clients = new Set();
  /** @type {Awaited<ReturnType<typeof createMarkdownRenderer>> | undefined} */
  let renderer;
  /** @type {Promise<Awaited<ReturnType<typeof createMarkdownRenderer>>> | undefined} */
  let rendererPromise;
  let source = "";
  let fileError = "";
  let revision = 0;
  let stopped = false;
  /** @type {NodeJS.Timeout | undefined} */
  let idleTimer;
  /** @type {NodeJS.Timeout | undefined} */
  let debounce;
  /** @type {import("node:fs").FSWatcher | undefined} */
  let watcher;
  /** @type {{revision: number, html: string} | undefined} */
  let rendered;
  /** @type {Promise<{revision: number, html: string}> | undefined} */
  let rendering;

  const server = createServer(async (request, response) => {
    try {
      if (request.headers.host !== new URL(url).host) {
        response.writeHead(403).end();
        return;
      }
      const path = new URL(request.url ?? "/", url).pathname;
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      );
      if (path === base) {
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        if (invalidFileError)
          response.once("finish", () => {
            void stop(invalidFileError);
          });
        response.end(page(file, base, invalidFileError));
      } else if (path === `${base}events` && markdownFile) {
        response.writeHead(200, { "Content-Type": "text/event-stream", Connection: "keep-alive" });
        clients.add(response);
        response.write(`event: ready\ndata: ${revision}\n\n`);
        request.on("close", () => clients.delete(response));
      } else if (path === `${base}content` && markdownFile) {
        if (fileError) throw new Error(fileError);
        if (rendered?.revision !== revision) {
          rendering ??= (async () => {
            rendererPromise ??= createMarkdownRenderer();
            renderer = await rendererPromise;
            const currentRevision = revision;
            const html = await renderer.render(source);
            return { revision: currentRevision, html };
          })().finally(() => {
            rendering = undefined;
          });
          rendered = await rendering;
        }
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify(rendered));
      } else if (path === `${base}highlight.css`) {
        response.setHeader("Content-Type", "text/css");
        response.end(await readFile(highlightCssPath));
      } else if (path === `${base}github.css`) {
        response.setHeader("Content-Type", "text/css");
        response.end(await readFile(cssPath));
      } else if (path === `${base}preview.js` || path === `${base}preview.css`) {
        response.setHeader("Content-Type", path.endsWith(".js") ? "text/javascript" : "text/css");
        response.end(
          await readFile(
            resolve(
              assets,
              path.endsWith(".js") ? "markdown-preview-browser.js" : "markdown-preview.css",
            ),
          ),
        );
      } else if (path.startsWith(`${base}mermaid/`)) {
        const asset = resolve(
          mermaidDirectory,
          decodeURIComponent(path.slice(`${base}mermaid/`.length)),
        );
        if (
          !asset.startsWith(mermaidDirectory + sep) ||
          ![".mjs", ".js"].includes(extname(asset))
        ) {
          response.writeHead(404).end();
          return;
        }
        response.setHeader("Content-Type", "text/javascript");
        response.end(await readFile(asset));
      } else {
        response.writeHead(404).end();
      }
    } catch (error) {
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      );
    }
  });

  /** @param {string} [message] */
  async function stop(
    message = "Goodbye! No file changes for 15 minutes. The preview server stopped.",
  ) {
    if (stopped) return;
    stopped = true;
    clearTimeout(idleTimer);
    clearTimeout(debounce);
    watcher?.close();
    for (const client of clients) {
      client.end(`event: goodbye\ndata: ${JSON.stringify(message)}\n\n`);
    }
    clients.clear();
    server.closeIdleConnections();
    await new Promise((resolveStop) => server.close(resolveStop));
  }

  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      void stop();
    }, idleMs);
  }

  async function readSource() {
    try {
      const next = await readFile(file, "utf8");
      fileError = "";
      if (next === source) return;
      source = next;
      revision += 1;
      resetIdle();
      for (const client of clients) client.write(`event: change\ndata: ${revision}\n\n`);
    } catch (error) {
      fileError = error instanceof Error ? error.message : String(error);
      for (const client of clients) client.write(`event: change\ndata: ${revision}\n\n`);
    }
  }

  let url = "";
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen(undefined));
  });
  const address = /** @type {import("node:net").AddressInfo} */ (server.address());
  url = `http://127.0.0.1:${address.port}${base}`;
  resetIdle();
  if (markdownFile) {
    await readSource();
    try {
      watcher = watch(dirname(file), (_event, filename) => {
        if (filename !== null && filename.toString() !== basename(file)) return;
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          void readSource();
        }, 60);
      });
      watcher.on("error", () => {
        void stop("Goodbye! The file watcher stopped.");
      });
    } catch {
      fileError ||= "Cannot watch the file's directory.";
    }
  }
  options.openBrowser?.(url);
  return { url, stop };
}

/** @param {string} url */
function openBrowser(url) {
  const command = process.platform === "darwin" ? "open" : "xdg-open";
  const browser = spawn(command, [url], { detached: true, stdio: "ignore" });
  browser.on("error", () => {});
  browser.unref();
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const [mode, file] = process.argv.slice(2);
  if (!file || !["start", "serve"].includes(mode ?? "")) {
    console.error("Usage: markdown-preview.js start <file>");
    process.exitCode = 1;
  } else if (mode === "start") {
    const child = spawn(process.execPath, [scriptPath, "serve", resolve(file)], {
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    child.unref();
  } else {
    await startMarkdownPreview(file, { openBrowser });
  }
}
