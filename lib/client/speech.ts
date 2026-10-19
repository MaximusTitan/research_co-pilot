"use client";

/** Text-to-speech and voice input use the browser's built-in speech APIs, when present. */

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, lang: string) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canListen(): boolean {
  return recognitionCtor() !== null;
}

/** Starts one dictation session. Returns a stop function. */
export function listen(lang: string, onText: (text: string) => void, onDone: () => void): () => void {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    onDone();
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = false;
  rec.onresult = (e) => onText(e.results[0]?.[0]?.transcript ?? "");
  rec.onerror = () => onDone();
  rec.onend = () => onDone();
  rec.start();
  return () => rec.stop();
}
