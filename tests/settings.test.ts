import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../lib/settings-shared";

describe("sanitizeSettings", () => {
  it("returns defaults for missing or non-object input", () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings("nope")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values and drops anything else", () => {
    expect(sanitizeSettings({ locale: "hi", textSize: "huge", contrast: "high" })).toMatchObject({
      locale: "hi",
      textSize: DEFAULT_SETTINGS.textSize,
      contrast: "high",
    });
  });
});
