// @ts-check

const article = /** @type {HTMLElement} */ (document.getElementById("markdown"));
/** @param {string} source @param {string} message */
function showStatus(source, message) {
  window.dispatchEvent(new CustomEvent("preview-status", { detail: { source, message } }));
}
const base = new URL("./", import.meta.url);
let requested = 0;
let finished = 0;
let updating = false;
let stopped = false;
/** @type {any} */
let mermaid;

async function update() {
  requested += 1;
  if (updating) return;
  updating = true;
  let attempted = 0;
  try {
    while (finished < requested && !stopped) {
      const current = requested;
      attempted = current;
      const response = await fetch(new URL("content", base));
      const data = await response.json();
      if (stopped) return;
      if (!response.ok) throw new Error(data.error);
      article.innerHTML = data.html;
      showStatus("loading", "");
      showStatus("render", "");
      const diagrams = article.querySelectorAll(".mermaid");
      if (diagrams.length) {
        if (!mermaid) {
          const moduleUrl = new URL("mermaid/mermaid.esm.min.mjs", base).href;
          mermaid = (await import(moduleUrl)).default;
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default",
          });
        }
        try {
          await mermaid.run({ nodes: diagrams });
        } catch (error) {
          if (!stopped) showStatus("render", `Mermaid error: ${String(error)}`);
        }
      }
      finished = current;
    }
  } catch (error) {
    if (!stopped)
      showStatus(
        "render",
        `Preview error: ${error instanceof Error ? error.message : String(error)}`,
      );
  } finally {
    updating = false;
    if (!stopped && requested > attempted) void update();
  }
}

const events = new EventSource(new URL("events", base));
events.addEventListener("ready", () => {
  showStatus("connection", "");
  void update();
});
events.addEventListener("preview-error", (event) => {
  showStatus("watcher", JSON.parse(/** @type {MessageEvent} */ (event).data));
});
events.addEventListener("change", () => {
  void update();
});
events.addEventListener("goodbye", (event) => {
  stopped = true;
  showStatus("loading", "");
  showStatus("connection", "");
  showStatus("shutdown", JSON.parse(/** @type {MessageEvent} */ (event).data));
  events.close();
});
events.onerror = () => {
  if (!stopped)
    showStatus(
      "connection",
      "Auto-reloading disconnected: the preview server is unreachable. Waiting to reconnect…",
    );
};
