"use client";

import { useSettings } from "../settings";
import type { Locale } from "../types";
import { en, type Dictionary } from "./en";
import { hi } from "./hi";

export const dictionaries: Record<Locale, Dictionary> = { en, hi };

export function useT(): Dictionary {
  return dictionaries[useSettings().locale];
}

export function useLocale(): Locale {
  return useSettings().locale;
}
