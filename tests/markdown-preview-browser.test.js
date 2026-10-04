// @ts-check

import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const bootstrap = readFileSync(
  new URL("../dotfiles/.vim/bin/markdown-preview/bootstrap.js", import.meta.url),
  "utf8",
);
const browser = readFileSync(
  new URL("../dotfiles/.vim/bin/markdown-preview/browser.js", import.meta.url),
  "utf8",
);

function browserContext() {
  /** @type {Map<string, Function>} */
  const windowListeners = new Map();
  /** @type {Map<string, Function>} */
  const streamListeners = new Map();
  const status = { textContent: "Loading Markdown…" };
  const article = { innerHTML: "", querySelectorAll: () => [] };
  const stream = {
    close: vi.fn(),
    onerror: /** @type {Function | undefined} */ (undefined),
    addEventListener: (/** @type {string} */ name, /** @type {Function} */ listener) =>
      streamListeners.set(name, listener),
  };
  const context = {
    Error,
    URL,
    CustomEvent,
    document: {
      getElementById: (/** @type {string} */ id) => (id === "status" ? status : article),
    },
    window: {
      addEventListener: (/** @type {string} */ name, /** @type {Function} */ listener) =>
        windowListeners.set(name, listener),
      dispatchEvent: (/** @type {CustomEvent} */ event) => windowListeners.get(event.type)?.(event),
    },
    EventSource: function () {
      return stream;
    },
    fetch: vi.fn(async () => ({ ok: true, json: async () => ({ html: "<h1>Rendered</h1>" }) })),
  };
  runInNewContext(bootstrap, context);
  runInNewContext(
    browser.replace("import.meta.url", '"http://127.0.0.1:1234/token/preview.js"'),
    context,
  );
  return { context, windowListeners, streamListeners, status, article, stream };
}

describe("Markdown preview browser error reporting", () => {
  it("keeps watcher errors visible after successful renders", async () => {
    const page = browserContext();
    page.streamListeners.get("preview-error")?.({
      data: JSON.stringify("Auto-reloading stopped: watcher failed"),
    });
    page.streamListeners.get("ready")?.();
    await vi.waitFor(() => expect(page.article.innerHTML).toContain("Rendered"));
    expect(page.status.textContent).toBe("Auto-reloading stopped: watcher failed");
  });

  it("shows request failures and clears them after a successful update", async () => {
    const page = browserContext();
    page.context.fetch.mockRejectedValueOnce(new Error("fetch failed"));
    page.streamListeners.get("ready")?.();
    await vi.waitFor(() => expect(page.status.textContent).toContain("fetch failed"));
    page.streamListeners.get("change")?.();
    await vi.waitFor(() => expect(page.article.innerHTML).toContain("Rendered"));
    expect(page.status.textContent).not.toContain("fetch failed");
  });

  it("shows connection failures and clears them on reconnection", async () => {
    const page = browserContext();
    page.stream.onerror?.();
    expect(page.status.textContent).toContain("Auto-reloading disconnected");
    page.streamListeners.get("ready")?.();
    await vi.waitFor(() => expect(page.article.innerHTML).toContain("Rendered"));
    expect(page.status.textContent).not.toContain("disconnected");
  });

  it("reports failed module resources, unexpected script errors, and rejected promises", () => {
    const page = browserContext();
    page.windowListeners.get("error")?.({
      target: { src: "http://localhost/preview.js" },
      message: "",
    });
    expect(page.status.textContent).toContain("Cannot load http://localhost/preview.js");
    page.windowListeners.get("error")?.({ message: "unexpected script failure" });
    expect(page.status.textContent).toContain("unexpected script failure");
    page.windowListeners.get("unhandledrejection")?.({ reason: new Error("rejected promise") });
    expect(page.status.textContent).toContain("rejected promise");
  });

  it("shows the server's shutdown error without reconnecting", () => {
    const page = browserContext();
    page.streamListeners.get("goodbye")?.({
      data: JSON.stringify("Preview server error: fatal failure"),
    });
    expect(page.status.textContent).toContain("fatal failure");
    expect(page.stream.close).toHaveBeenCalledOnce();
    page.stream.onerror?.();
    expect(page.status.textContent).not.toContain("disconnected");
  });
});
