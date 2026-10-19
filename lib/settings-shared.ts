import type { Locale } from "./types";

export const SETTINGS_KEY = "research-copilot:settings";

export interface Settings {
  locale: Locale;
  textSize: "md" | "lg" | "xl";
  contrast: "normal" | "high";
  palette: "default" | "colorblind";
  font: "default" | "readable";
  motion: "full" | "reduced";
}

export const DEFAULT_SETTINGS: Settings = {
  locale: "en",
  textSize: "md",
  contrast: "normal",
  palette: "default",
  font: "default",
  motion: "full",
};

const ALLOWED: { [K in keyof Settings]: readonly Settings[K][] } = {
  locale: ["en", "hi"],
  textSize: ["md", "lg", "xl"],
  contrast: ["normal", "high"],
  palette: ["default", "colorblind"],
  font: ["default", "readable"],
  motion: ["full", "reduced"],
};

export function sanitizeSettings(value: unknown): Settings {
  const out = { ...DEFAULT_SETTINGS };
  if (!value || typeof value !== "object") return out;
  for (const key of Object.keys(ALLOWED) as (keyof Settings)[]) {
    const v = (value as Record<string, unknown>)[key];
    if ((ALLOWED[key] as readonly unknown[]).includes(v)) (out as Record<string, unknown>)[key] = v;
  }
  return out;
}

/**
 * Runs before first paint (inlined in <head>) so text size, contrast and
 * language are right immediately. Must stay in sync with `sanitizeSettings`.
 */
export const SETTINGS_BOOT_SCRIPT = `(function(){try{var a=${JSON.stringify(ALLOWED)};var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  SETTINGS_KEY,
)})||"null")||{};var r=document.documentElement;var d=${JSON.stringify(DEFAULT_SETTINGS)};function g(k){return a[k].indexOf(s[k])>-1?s[k]:d[k]}r.lang=g("locale");r.dataset.text=g("textSize");r.dataset.contrast=g("contrast");r.dataset.palette=g("palette");r.dataset.font=g("font");r.dataset.motion=g("motion")}catch(e){}})();`;
