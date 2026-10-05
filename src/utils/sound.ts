// Restaurant Service Bell Synthesizer using Web Audio API
// Produces an authentic, resonant brass counter bell chime (ding-ding!) for new incoming kitchen orders.

class BellSoundManager {
  private audioCtx: AudioContext | null = null;
  private isUnlocked = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  // Pre-unlock audio on user interaction in Admin panel
  public unlock(): void {
    if (this.isUnlocked) return;
    try {
      const ctx = this.getAudioContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        // Play silent buffer to unlock on iOS / Chrome
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        this.isUnlocked = true;
      }
    } catch {
      // Ignore audio unlock failure
    }
  }

  /**
   * Rings a crisp restaurant order notification brass bell chime (ding-ding!)
   * Exclusively called on the device where Admin is logged in.
   */
  public ringOrderBell(): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume().then(() => this.playChimeSequence(ctx));
      } else {
        this.playChimeSequence(ctx);
      }
    } catch (err) {
      console.warn('Could not play order bell audio:', err);
    }
  }

  private playChimeSequence(ctx: AudioContext): void {
    const now = ctx.currentTime;
    // First Ding (1568 Hz - E6)
    this.createBellChime(ctx, now, 1568, 0.85);
    // Second Ding (1760 Hz - A6) after 220ms for the classic "Ding-Ding!" order bell
    this.createBellChime(ctx, now + 0.22, 1760, 0.95);
  }

  private createBellChime(
    ctx: AudioContext,
    startTime: number,
    freq: number,
    volume: number
  ): void {
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, startTime);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);
    masterGain.connect(ctx.destination);

    // Fundamental metallic oscillator
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, startTime);

    // High harmonic for brass metallic ping (3x frequency)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2.75, startTime);

    // Sub harmonic for rich acoustic body
    const osc3 = ctx.createOscillator();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(freq * 0.5, startTime);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.3, startTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

    const gain3 = ctx.createGain();
    gain3.gain.setValueAtTime(0.15, startTime);
    gain3.gain.exponentialRampToValueAtTime(0.001, startTime + 0.7);

    osc1.connect(masterGain);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc3.connect(gain3);
    gain3.connect(masterGain);

    osc1.start(startTime);
    osc2.start(startTime);
    osc3.start(startTime);

    osc1.stop(startTime + 1.3);
    osc2.stop(startTime + 1.3);
    osc3.stop(startTime + 1.3);
  }
}

export const bellSound = new BellSoundManager();
