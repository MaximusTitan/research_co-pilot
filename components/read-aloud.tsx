"use client";

import { useEffect, useState } from "react";
import { canSpeak, speak, stopSpeaking } from "../lib/client/speech";
import { useIsSupported } from "../lib/client/hooks";
import { useLocale, useT } from "../lib/i18n";
import { Button } from "./ui";

/** Reads text aloud with the browser's speech synthesis. Hidden when unsupported. */
export function ReadAloud({ text }: { text: string }) {
  const t = useT();
  const locale = useLocale();
  const supported = useIsSupported(canSpeak);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => stopSpeaking(), []);

  if (!supported) return null;

  return (
    <Button
      variant="ghost"
      className="min-h-9 px-2 text-sm"
      aria-pressed={speaking}
      onClick={() => {
        if (speaking) {
          stopSpeaking();
          setSpeaking(false);
          return;
        }
        speak(text, locale === "hi" ? "hi-IN" : "en-US");
        setSpeaking(true);
        window.setTimeout(() => setSpeaking(false), Math.min(text.length * 80, 60_000));
      }}
    >
      <span aria-hidden>🔊</span>
      {speaking ? t.common.stopReading : t.common.readAloud}
    </Button>
  );
}
