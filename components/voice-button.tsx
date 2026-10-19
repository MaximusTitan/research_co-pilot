"use client";

import { useEffect, useRef, useState } from "react";
import { canListen, listen } from "../lib/client/speech";
import { useIsSupported } from "../lib/client/hooks";
import { useLocale, useT } from "../lib/i18n";
import { Button } from "./ui";

/** Dictation button. Hidden when the browser has no speech recognition. */
export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const t = useT();
  const locale = useLocale();
  const supported = useIsSupported(canListen);
  const [listening, setListening] = useState(false);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => () => stop.current?.(), []);

  if (!supported) return null;

  return (
    <Button
      variant="secondary"
      aria-pressed={listening}
      aria-label={t.common.voiceInput}
      title={t.common.voiceInput}
      onClick={() => {
        if (listening) {
          stop.current?.();
          return;
        }
        setListening(true);
        stop.current = listen(locale === "hi" ? "hi-IN" : "en-US", onText, () => setListening(false));
      }}
    >
      <span aria-hidden>🎤</span>
      <span className="sr-only">{listening ? t.common.listening : t.common.voiceInput}</span>
    </Button>
  );
}
