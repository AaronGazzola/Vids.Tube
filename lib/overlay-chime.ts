let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

export function playOverlayChime(): void {
  const audio = audioContext();
  if (!audio) return;
  const now = audio.currentTime;
  const notes = [880, 1318.5];
  notes.forEach((freq, i) => {
    const start = now + i * 0.09;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(start);
    osc.stop(start + 0.75);
  });
}
