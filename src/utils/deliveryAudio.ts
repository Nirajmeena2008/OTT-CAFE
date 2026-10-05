// Web Audio API chime generator for real-time delivery assignment alerts
// Uses pure browser-synthesized audio frequencies, no external MP3 dependencies.

export function playDeliveryNotificationChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const startTime = ctx.currentTime;

    // Harmonic Chord Note 1: 587.33 Hz (D5) - bright alert tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, startTime);
    gain1.gain.setValueAtTime(0.35, startTime);
    gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(startTime);
    osc1.stop(startTime + 0.35);

    // Harmonic Chord Note 2: 880 Hz (A5) - bell ring follow-through
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, startTime + 0.12);
    gain2.gain.setValueAtTime(0.4, startTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(startTime + 0.12);
    osc2.stop(startTime + 0.65);

    // Haptic vibration on mobile devices
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  } catch (err) {
    console.debug('Audio chime unable to play:', err);
  }
}
