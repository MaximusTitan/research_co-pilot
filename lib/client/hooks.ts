"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** Browser-only feature check that is safe during server rendering (false on the server). */
export function useIsSupported(check: () => boolean): boolean {
  return useSyncExternalStore(noSubscribe, check, () => false);
}

/** Runs an async task once per mount when `enabled` is true; keeps the latest result. */
export function useOnce(enabled: boolean, task: () => void) {
  const ran = useRef(false);
  useEffect(() => {
    if (enabled && !ran.current) {
      ran.current = true;
      task();
    }
  }, [enabled, task]);
}

export function useFlash(ms = 2000): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const flash = () => {
    setOn(true);
    window.setTimeout(() => setOn(false), ms);
  };
  return [on, flash];
}
