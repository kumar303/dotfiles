// @ts-check

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";

/** @typedef {"dark" | "light"} Appearance */

/**
 * @typedef {object} PickerTheme
 * @property {string} accent
 * @property {string} background
 * @property {string} error
 * @property {string} muted
 * @property {string} text
 */

/** @type {Record<string, PickerTheme>} */
// These values match Herdr 0.9.0's built-in Palette definitions.
const THEMES = {
  catppuccin: palette("#89b4fa", "#181825", "#f38ba8", "#6c7086", "#cdd6f4"),
  "catppuccin-latte": palette("#1e66f5", "#eff1f5", "#d20f39", "#9ca0b0", "#4c4f69"),
  terminal: palette("blue", "default", "lightred", "gray", "default"),
  "tokyo-night": palette("#7aa2f7", "#1a1b26", "#f7768e", "#565f89", "#c0caf5"),
  "tokyo-night-day": palette("#2e7de9", "#e1e2e7", "#f52a65", "#8990b3", "#3760bf"),
  dracula: palette("#bd93f9", "#282a36", "#ff5555", "#6272a4", "#f8f8f2"),
  nord: palette("#88c0d0", "#2e3440", "#bf616a", "#4c566a", "#eceff4"),
  gruvbox: palette("#d79921", "#282828", "#fb4934", "#928374", "#ebdbb2"),
  "gruvbox-light": palette("#076678", "#fbf1c7", "#9d0006", "#928374", "#3c3836"),
  "one-dark": palette("#61afef", "#282c34", "#e06c75", "#5c6370", "#abb2bf"),
  "one-light": palette("#4078f2", "#fafafa", "#e45649", "#a0a1a7", "#383a42"),
  solarized: palette("#268bd2", "#002b36", "#dc322f", "#586e75", "#93a1a1"),
  "solarized-light": palette("#268bd2", "#fdf6e3", "#dc322f", "#93a1a1", "#657b83"),
  kanagawa: palette("#7e9cd8", "#1f1f28", "#c34043", "#727169", "#dcd7ba"),
  "kanagawa-lotus": palette("#4d699b", "#f2ecbc", "#c84053", "#a09cac", "#545464"),
  "rose-pine": palette("#c4a7e7", "#191724", "#eb6f92", "#6e6a86", "#e0def4"),
  "rose-pine-dawn": palette("#907aa9", "#faf4ed", "#b4637a", "#9893a5", "#464261"),
  vesper: palette("#ffc799", "#1a1a1a", "#ff8080", "#5c5c5c", "#ffffff"),
};

/** @type {Record<string, string>} */
const THEME_ALIASES = {
  "catppuccin-mocha": "catppuccin",
  latte: "catppuccin-latte",
  light: "catppuccin-latte",
  tokyonight: "tokyo-night",
  "tokyo-day": "tokyo-night-day",
  "tokyonight-day": "tokyo-night-day",
  "gruvbox-dark": "gruvbox",
  onedark: "one-dark",
  onelight: "one-light",
  "solarized-dark": "solarized",
  lotus: "kanagawa-lotus",
  rosepine: "rose-pine",
  "rosepine-dawn": "rose-pine-dawn",
  dawn: "rose-pine-dawn",
};

/**
 * @param {string} accent
 * @param {string} background
 * @param {string} error
 * @param {string} muted
 * @param {string} text
 * @returns {PickerTheme}
 */
function palette(accent, background, error, muted, text) {
  return { accent, background, error, muted, text };
}

/**
 * @param {Record<string, unknown>} config
 * @param {Appearance} [appearance]
 * @returns {PickerTheme}
 */
export function resolveWorkspaceSwitcherTheme(config, appearance) {
  const theme = isObject(config.theme) ? config.theme : {};
  const autoSwitch = theme.auto_switch === true;
  const mode = appearance ?? "dark";
  const configuredName = autoSwitch
    ? mode === "light"
      ? theme.light_name
      : theme.dark_name
    : theme.name;
  const fallbackName = autoSwitch && mode === "light" ? "catppuccin-latte" : "catppuccin";
  const name =
    typeof configuredName === "string" ? canonicalThemeName(configuredName) : fallbackName;
  const base = THEMES[name] ?? THEMES[fallbackName];
  const custom = isObject(theme.custom) ? theme.custom : {};
  const modeCustom = autoSwitch && isObject(custom[mode]) ? custom[mode] : {};

  return applyOverrides(applyOverrides(base, custom), modeCustom);
}

/** @returns {Promise<PickerTheme>} */
export async function readWorkspaceSwitcherTheme() {
  const config = readHerdrConfig();
  const theme = isObject(config.theme) ? config.theme : {};
  const appearance = theme.auto_switch === true ? await readTerminalAppearance() : undefined;
  return resolveWorkspaceSwitcherTheme(config, appearance);
}

/** @returns {Record<string, unknown>} */
export function readHerdrConfig() {
  try {
    return parse(readFileSync(herdrConfigPath(), "utf8"));
  } catch {
    return {};
  }
}

/** @returns {string} */
export function herdrConfigPath() {
  if (process.env.HERDR_CONFIG_PATH) return process.env.HERDR_CONFIG_PATH;
  const configHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(configHome, "herdr", "config.toml");
}

/**
 * Ask Herdr's terminal emulator for its current light or dark appearance.
 * @param {number} [timeoutMilliseconds]
 * @returns {Promise<Appearance | undefined>}
 */
export function readTerminalAppearance(timeoutMilliseconds = 100) {
  const input = process.stdin;
  const output = process.stdout;
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const wasRaw = input.isRaw;
    const wasFlowing = input.readableFlowing;
    let response = "";
    let settled = false;

    const finish = (/** @type {Appearance | undefined} */ appearance) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      input.off("data", onData);
      if (!wasRaw) input.setRawMode(false);
      if (wasFlowing !== true) input.pause();
      resolve(appearance);
    };
    const onData = (/** @type {Buffer | string} */ data) => {
      response += data.toString();
      const match = response.match(/\x1b\[\?997;([12])n/);
      if (match) finish(match[1] === "2" ? "light" : "dark");
    };
    const timer = setTimeout(() => finish(undefined), timeoutMilliseconds);

    input.setRawMode(true);
    input.on("data", onData);
    input.resume();
    output.write("\x1b[?996n");
  });
}

/**
 * @param {PickerTheme} theme
 * @param {Record<string, unknown>} custom
 * @returns {PickerTheme}
 */
function applyOverrides(theme, custom) {
  return {
    accent: color(custom.accent, theme.accent),
    background: color(custom.panel_bg, theme.background),
    error: color(custom.red, theme.error),
    muted: color(custom.overlay0, theme.muted),
    text: color(custom.text, theme.text),
  };
}

/**
 * @param {unknown} value
 * @param {string} fallback
 */
function color(value, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["reset", "default", "none", "transparent"].includes(normalized)) return "default";
  if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized;
  const shortHex = normalized.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (shortHex) return `#${shortHex[1].repeat(2)}${shortHex[2].repeat(2)}${shortHex[3].repeat(2)}`;
  const rgb = normalized.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgb && rgb.slice(1).every((part) => Number(part) <= 255)) {
    return `#${rgb
      .slice(1)
      .map((part) => Number(part).toString(16).padStart(2, "0"))
      .join("")}`;
  }
  const named = new Set([
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "purple",
    "cyan",
    "white",
    "gray",
    "grey",
    "darkgray",
    "darkgrey",
    "lightred",
    "lightgreen",
    "lightyellow",
    "lightblue",
    "lightmagenta",
    "lightcyan",
  ]);
  return named.has(normalized) ? normalized : "cyan";
}

/** @param {string} name */
function canonicalThemeName(name) {
  const normalized = name.toLowerCase().replace(/[ _]/g, "-");
  return THEME_ALIASES[normalized] ?? normalized;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
