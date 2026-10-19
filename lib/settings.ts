"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, SETTINGS_KEY, sanitizeSettings, type Settings } from "./settings-shared";

export { DEFAULT_SETTINGS, type Settings } from "./settings-shared";

const listeners = new Set<() => void>();
let cache: Settings | null = null;

function snapshot(): Settings {
  if (!cache) {
    try {
      cache = sanitizeSettings(JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null"));
    } catch {
      cache = DEFAULT_SETTINGS;
    }
  }
  return cache;
}

export function applySettingsToDocument(s: Settings) {
  const root = document.documentElement;
  root.lang = s.locale;
  root.dataset.text = s.textSize;
  root.dataset.contrast = s.contrast;
  root.dataset.palette = s.palette;
  root.dataset.font = s.font;
  root.dataset.motion = s.motion;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_SETTINGS);
}

export function updateSettings(patch: Partial<Settings>) {
  const next = sanitizeSettings({ ...snapshot(), ...patch });
  cache = next;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Ignore: settings still apply for this visit.
  }
  applySettingsToDocument(next);
  listeners.forEach((l) => l());
}
