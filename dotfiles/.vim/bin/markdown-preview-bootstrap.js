// @ts-check

// Install error reporting before the preview module loads.
const previewMessages = new Map([["loading", "Loading Markdown…"]]);

/** @param {string} source @param {string} message */
function showPreviewStatus(source, message) {
  if (message) previewMessages.set(source, message);
  else previewMessages.delete(source);
  const status = document.getElementById("status");
  if (status) status.textContent = [...previewMessages.values()].join("\n");
}

window.addEventListener("preview-status", (event) => {
  const { source, message } =
    /** @type {CustomEvent<{source: string, message: string}>} */ (event).detail;
  showPreviewStatus(source, message);
});
window.addEventListener(
  "error",
  (event) => {
    const target = /** @type {HTMLScriptElement | HTMLLinkElement | null} */ (event.target);
    const resource = target && ("src" in target ? target.src : "href" in target ? target.href : "");
    showPreviewStatus(
      "runtime",
      `Preview error: ${event.message || `Cannot load ${resource || "a preview resource"}`}`,
    );
  },
  true,
);
window.addEventListener("unhandledrejection", (event) => {
  showPreviewStatus(
    "runtime",
    `Preview error: ${event.reason instanceof Error ? event.reason.message : String(event.reason)}`,
  );
});
