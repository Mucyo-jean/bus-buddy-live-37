let enabled = true;
const spoken = new Set<string>();

export function setVoiceEnabled(v: boolean) {
  enabled = v;
  if (!v && typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function isVoiceSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Speaks a phrase once per key. Repeated calls with the same key are ignored
 * so a stop is never announced twice.
 */
export function announceOnce(key: string, text: string) {
  if (spoken.has(key)) return false;
  spoken.add(key);
  speak(text);
  return true;
}

export function speak(text: string) {
  if (!enabled || !isVoiceSupported()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.98;
  utterance.pitch = 1;
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

export function resetAnnouncements() {
  spoken.clear();
}