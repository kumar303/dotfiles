// @ts-check

import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createMarkdownRenderer,
  startMarkdownPreview,
} from "../dotfiles/.vim/bin/markdown-preview.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/** @type {string} */
let directory;
/** @type {Awaited<ReturnType<typeof startMarkdownPreview>> | undefined} */
let preview;
/** @type {AbortController[]} */
let controllers;
/** @type {number | undefined} */
let detachedPid;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "markdown-preview-"));
  controllers = [];
});
afterEach(async () => {
  controllers.forEach((controller) => controller.abort());
  await preview?.stop();
  preview = undefined;
  if (detachedPid) {
    try {
      process.kill(detachedPid);
    } catch {}
  }
  detachedPid = undefined;
  rmSync(directory, { recursive: true, force: true });
});

/** @param {() => boolean | Promise<boolean>} condition */
async function waitFor(condition) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Markdown preview did not reach the expected state");
}

/** @param {string} url */
async function listen(url) {
  const controller = new AbortController();
  controllers.push(controller);
  const response = await fetch(new URL("events", url), { signal: controller.signal });
  const reader = /** @type {ReadableStream<Uint8Array>} */ (response.body).getReader();
  let text = "";
  void (async () => {
    try {
      for (;;) {
        const result = await reader.read();
        if (result.done) break;
        text += new TextDecoder().decode(result.value);
      }
    } catch {}
  })();
  return () => text;
}

describe("Markdown browser preview", () => {
  it("renders GFM, headings, alerts, Mermaid, and highlighted language aliases safely", async () => {
    const renderer = await createMarkdownRenderer();
    const html = await renderer.render(
      `# Hello world\n\n| Name | Value |\n| --- | --- |\n| A | B |\n\n- [x] Done\n\n~~removed~~\n\n> [!NOTE]\n> Important detail\n\n\`\`\`tsx\nconst node = <div>Hello</div>;\n\`\`\`\n\n\`\`\`ruby\ndef hello; end\n\`\`\`\n\n\`\`\`mermaid\ngraph TD; A-->B\n\`\`\`\n\n\`\`\`unknown-language\n<plain>\n\`\`\`\n<script>alert('bad')</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">bad</a>`,
    );
    expect(html).toContain('id="hello-world"');
    expect(html).toContain("<table>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("<del>removed</del>");
    expect(html).toContain("markdown-alert-note");
    expect(html).toContain('class="mermaid"');
    expect(html).toContain("graph TD; A--&gt;B");
    expect(html).toContain('class="pl-');
    expect(html).toContain("&lt;plain&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onerror=");
    expect(html).not.toContain("javascript:");
  });

  it("uses a free loopback port and serves local CSS, scripts, and Mermaid modules", async () => {
    const file = join(directory, "hello.md");
    writeFileSync(file, "# Hello\n");
    preview = await startMarkdownPreview(file);
    const url = preview.url;
    expect(new URL(url).hostname).toBe("127.0.0.1");
    expect(Number(new URL(url).port)).toBeGreaterThan(0);
    const page = await fetch(url);
    const html = await page.text();
    expect(html).toContain("markdown-body");
    expect(html).toContain('nonce="');
    expect(html.indexOf('window.addEventListener("error"')).toBeLessThan(
      html.indexOf('type="module"'),
    );
    expect(page.headers.get("content-security-policy")).toContain("script-src 'self'");
    for (const asset of [
      "github.css",
      "highlight.css",
      "preview.css",
      "preview.js",
      "mermaid/mermaid.esm.min.mjs",
    ]) {
      const response = await fetch(new URL(asset, url));
      expect(response.status).toBe(200);
      expect((await response.text()).length).toBeGreaterThan(100);
    }
    expect((await fetch(new URL("mermaid/%2e%2e%2fpackage.json", url))).status).toBe(404);
    const content = await (await fetch(new URL("content", url))).json();
    expect(content.html).toContain("Hello</h1>");
  });

  it("watches atomic saves and pushes changes to the browser", async () => {
    const file = join(directory, "hello.md");
    writeFileSync(file, "# Before\n");
    preview = await startMarkdownPreview(file);
    const events = await listen(preview.url);
    await waitFor(() => events().includes("event: ready"));
    const replacement = join(directory, "replacement");
    writeFileSync(replacement, "# After\n");
    renameSync(replacement, file);
    await waitFor(() => events().includes("event: change"));
    const content = await (await fetch(new URL("content", preview.url))).json();
    expect(content.html).toContain("After</h1>");
  });

  it("shows goodbye and shuts down after inactivity despite browser requests", async () => {
    const file = join(directory, "hello.md");
    writeFileSync(file, "# Hello\n");
    preview = await startMarkdownPreview(file, { idleMs: 150 });
    const url = preview.url;
    const events = await listen(url);
    await fetch(url);
    await waitFor(() => events().includes("event: goodbye"));
    expect(events()).toContain("Goodbye!");
    await waitFor(async () => {
      try {
        await fetch(url);
        return false;
      } catch {
        return true;
      }
    });
  });

  it("resets inactivity only when the previewed file's contents change", async () => {
    const file = join(directory, "hello.md");
    writeFileSync(file, "# Hello\n");
    preview = await startMarkdownPreview(file, { idleMs: 400 });
    const url = preview.url;
    const events = await listen(url);
    await new Promise((resolve) => setTimeout(resolve, 200));
    writeFileSync(file, "# Changed\n");
    await waitFor(() => events().includes("event: change"));
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(events()).not.toContain("goodbye");
    writeFileSync(file, "# Changed\n");
    writeFileSync(join(directory, "unrelated.md"), "unrelated");
    await waitFor(() => events().includes("goodbye"));
  });

  it("shows an error for a non-Markdown file and exits after serving the page", async () => {
    const file = join(directory, "example.ts");
    writeFileSync(file, "const x = 1");
    preview = await startMarkdownPreview(file);
    const url = preview.url;
    const page = await (await fetch(url)).text();
    expect(page).toContain("the file is not Markdown");
    expect(page).not.toContain('src="');
    await waitFor(async () => {
      try {
        await fetch(url);
        return false;
      } catch {
        return true;
      }
    });
  });

  it("reports watcher startup errors without hiding the Markdown content", async () => {
    const file = join(directory, "hello.md");
    writeFileSync(file, "# Still visible\n");
    preview = await startMarkdownPreview(file, {
      watchDirectory() {
        throw new Error("watch setup failed");
      },
    });
    const events = await listen(preview.url);
    await waitFor(() => events().includes("watch setup failed"));
    expect(events()).toContain("Auto-reloading stopped:");
    const content = await (await fetch(new URL("content", preview.url))).json();
    expect(content.html).toContain("Still visible</h1>");
  });

  it("reports watcher runtime errors to current and reconnected pages", async () => {
    const file = join(directory, "hello.md");
    writeFileSync(file, "# Hello\n");
    const watcher = Object.assign(new EventEmitter(), { close() {} });
    preview = await startMarkdownPreview(file, {
      watchDirectory: () => /** @type {import("node:fs").FSWatcher} */ (watcher),
    });
    const events = await listen(preview.url);
    await waitFor(() => events().includes("ready"));
    watcher.emit("error", new Error("watch descriptor failed"));
    await waitFor(() => events().includes("watch descriptor failed"));
    const reconnected = await listen(preview.url);
    await waitFor(() => reconnected().includes("watch descriptor failed"));
  });

  it("returns renderer errors to the page and retries renderer initialization", async () => {
    const file = join(directory, "hello.md");
    writeFileSync(file, "# Hello\n");
    let calls = 0;
    preview = await startMarkdownPreview(file, {
      async createRenderer() {
        calls += 1;
        if (calls === 1) throw new Error("highlighter initialization failed");
        return {
          async render() {
            return "<p>Recovered</p>";
          },
        };
      },
    });
    const response = await fetch(new URL("content", preview.url));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "highlighter initialization failed" });
    const recovered = await (await fetch(new URL("content", preview.url))).json();
    expect(recovered.html).toContain("Recovered");
  });

  it("reports file read errors and recovers when identical contents return", async () => {
    const file = join(directory, "hello.md");
    writeFileSync(file, "# Hello\n");
    preview = await startMarkdownPreview(file);
    const events = await listen(preview.url);
    await waitFor(() => events().includes("ready"));
    rmSync(file);
    await waitFor(() => events().includes("event: change"));
    const response = await fetch(new URL("content", preview.url));
    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain("ENOENT");
    const previousEvents = events().length;
    writeFileSync(file, "# Hello\n");
    await waitFor(() => events().length > previousEvents);
    expect((await fetch(new URL("content", preview.url))).status).toBe(200);
  });

  it("launches from Vim and keeps serving after Vim exits", async () => {
    const bin = join(directory, "bin");
    mkdirSync(bin);
    const opened = join(directory, "opened");
    const pid = join(directory, "pid");
    const opener = join(bin, process.platform === "darwin" ? "open" : "xdg-open");
    writeFileSync(
      opener,
      '#!/bin/sh\nprintf "%s" "$1" > "$PREVIEW_TEST_URL"\nprintf "%s" "$PPID" > "$PREVIEW_TEST_PID"\n',
    );
    chmodSync(opener, 0o755);
    const file = join(directory, "hello.md");
    writeFileSync(file, "# Detached\n");
    const result = spawnSync(
      "vim",
      [
        "-Nu",
        join(root, "dotfiles", ".vimrc"),
        "-n",
        "-es",
        file,
        "-c",
        "call PreviewMarkdown()",
        "-c",
        "qa!",
      ],
      {
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          PREVIEW_TEST_URL: opened,
          PREVIEW_TEST_PID: pid,
        },
        encoding: "utf8",
        timeout: 5000,
      },
    );
    expect(result.status).toBe(0);
    await waitFor(() => {
      try {
        return readFileSync(opened, "utf8").startsWith("http");
      } catch {
        return false;
      }
    });
    detachedPid = Number(readFileSync(pid, "utf8"));
    const url = readFileSync(opened, "utf8");
    const content = await (await fetch(new URL("content", url))).json();
    expect(content.html).toContain("Detached</h1>");
  });
});
