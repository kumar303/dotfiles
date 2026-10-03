// @ts-check

const article = /** @type {HTMLElement} */ (document.getElementById("markdown"));
const status = /** @type {HTMLElement} */ (document.getElementById("status"));
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
  try {
    while (finished < requested && !stopped) {
      const current = requested;
      const response = await fetch(new URL("content", base));
      const data = await response.json();
      if (stopped) return;
      if (!response.ok) throw new Error(data.error);
      article.innerHTML = data.html;
      status.textContent = "";
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
          if (!stopped) status.textContent = `Mermaid error: ${String(error)}`;
        }
      }
      finished = current;
    }
  } catch (error) {
    if (!stopped)
      status.textContent = `Preview error: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    updating = false;
  }
}

const events = new EventSource(new URL("events", base));
events.addEventListener("ready", () => {
  void update();
});
events.addEventListener("change", () => {
  void update();
});
events.addEventListener("goodbye", (event) => {
  stopped = true;
  status.textContent = JSON.parse(/** @type {MessageEvent} */ (event).data);
  events.close();
});
events.onerror = () => {
  if (!stopped) status.textContent = "The preview server disconnected. Waiting to reconnect…";
};
