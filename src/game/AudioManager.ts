export type SoundName =
  | 'correct'
  | 'wrong'
  | 'item'
  | 'chest'
  | 'discover'
  | 'hit'
  | 'stage'
  | 'splash';

interface ToneStep {
  frequency: number;
  duration: number;
  delay?: number;
  type?: OscillatorType;
  gain?: number;
}

const SOUNDS: Record<SoundName, readonly ToneStep[]> = {
  correct: [
    { frequency: 523, duration: 0.09, gain: 0.18 },
    { frequency: 659, duration: 0.1, delay: 0.08, gain: 0.16 },
    { frequency: 784, duration: 0.16, delay: 0.17, gain: 0.13 },
  ],
  wrong: [
    { frequency: 330, duration: 0.11, type: 'sine', gain: 0.1 },
    { frequency: 294, duration: 0.14, delay: 0.09, type: 'sine', gain: 0.08 },
  ],
  item: [
    { frequency: 720, duration: 0.08, type: 'triangle', gain: 0.12 },
    { frequency: 960, duration: 0.18, delay: 0.07, type: 'triangle', gain: 0.1 },
  ],
  chest: [
    { frequency: 392, duration: 0.1, gain: 0.14 },
    { frequency: 523, duration: 0.1, delay: 0.09, gain: 0.13 },
    { frequency: 659, duration: 0.22, delay: 0.18, gain: 0.11 },
  ],
  discover: [
    { frequency: 440, duration: 0.12, type: 'triangle', gain: 0.12 },
    { frequency: 660, duration: 0.26, delay: 0.1, type: 'triangle', gain: 0.1 },
  ],
  hit: [{ frequency: 220, duration: 0.08, type: 'square', gain: 0.05 }],
  stage: [
    { frequency: 392, duration: 0.13, gain: 0.14 },
    { frequency: 523, duration: 0.13, delay: 0.11, gain: 0.13 },
    { frequency: 659, duration: 0.13, delay: 0.22, gain: 0.12 },
    { frequency: 784, duration: 0.35, delay: 0.33, gain: 0.1 },
  ],
  splash: [{ frequency: 145, duration: 0.06, type: 'sine', gain: 0.025 }],
};

export class AudioManager {
  private context: AudioContext | null = null;
  private volume = 0.55;

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      const Context = window.AudioContext
        ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      this.context = new Context();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }

  play(name: SoundName): void {
    const context = this.context;
    if (!context || this.volume <= 0 || context.state === 'closed') return;
    const now = context.currentTime;
    for (const step of SOUNDS[name]) {
      const start = now + (step.delay ?? 0);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = step.type ?? 'sine';
      oscillator.frequency.setValueAtTime(step.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, (step.gain ?? 0.1) * this.volume),
        start + 0.012,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + step.duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + step.duration + 0.02);
    }
  }

  suspend(): void {
    void this.context?.suspend();
  }

  resume(): void {
    void this.context?.resume();
  }
}
