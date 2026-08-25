let enabled = true;
let primed = false;
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

export function isVoicePrimed() {
  return primed;
}

/**
 * Browsers block speech synthesis until the user interacts with the page.
 * Call this from a click handler once to unlock audio for later announcements.
 */
export function primeVoice() {
  if (!isVoiceSupported()) return false;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    primed = true;
    return true;
  } catch {
    return false;
  }
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
  // Resume in case the queue was paused by the browser.
  window.speechSynthesis.resume();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.98;
  utterance.pitch = 1;
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

export function resetAnnouncements() {
  spoken.clear();
}
