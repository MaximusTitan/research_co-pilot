"use client";

import { Card, Field, PageTitle } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { updateSettings, useSettings, type Settings } from "../../lib/settings";

const TEXT_SIZES: Settings["textSize"][] = ["md", "lg", "xl"];

export default function SettingsPage() {
  const t = useT();
  const s = useSettings();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageTitle>{t.settings.title}</PageTitle>
      <Card className="flex flex-col gap-6">
        <Field id="lang" label={t.settings.language}>
          <select
            id="lang"
            className="min-h-11 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] px-3"
            value={s.locale}
            onChange={(e) => updateSettings({ locale: e.target.value as Settings["locale"] })}
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी (Hindi)</option>
          </select>
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-semibold">{t.settings.textSize}</legend>
          <div className="flex flex-wrap gap-2">
            {TEXT_SIZES.map((size) => (
              <label
                key={size}
                className={`min-h-11 cursor-pointer rounded-lg border-2 px-4 py-2 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[var(--focus)] ${
                  s.textSize === size ? "border-[var(--accent)] bg-[var(--accent-soft)] font-semibold" : "border-[var(--line)]"
                }`}
              >
                <input type="radio" name="text-size" className="sr-only" checked={s.textSize === size} onChange={() => updateSettings({ textSize: size })} />
                {size === "md" ? t.settings.textMd : size === "lg" ? t.settings.textLg : t.settings.textXl}
              </label>
            ))}
          </div>
        </fieldset>

        <Toggle id="contrast" label={t.settings.contrast} checked={s.contrast === "high"} onChange={(on) => updateSettings({ contrast: on ? "high" : "normal" })} />
        <Toggle id="palette" label={t.settings.palette} checked={s.palette === "colorblind"} onChange={(on) => updateSettings({ palette: on ? "colorblind" : "default" })} />
        <Toggle id="font" label={t.settings.font} checked={s.font === "readable"} onChange={(on) => updateSettings({ font: on ? "readable" : "default" })} />
        <Toggle id="motion" label={t.settings.motion} checked={s.motion === "reduced"} onChange={(on) => updateSettings({ motion: on ? "reduced" : "full" })} />
      </Card>
    </div>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3">
      <input id={id} type="checkbox" className="size-5 accent-[var(--accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="font-semibold">{label}</span>
    </label>
  );
}
