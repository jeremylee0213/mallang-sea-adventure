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

interface BoostSound {
  readonly master: GainNode;
  readonly sources: readonly AudioScheduledSourceNode[];
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
  private boostRequested = false;
  private boostSound: BoostSound | null = null;

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    const context = this.context;
    if (context && this.boostSound) {
      this.boostSound.master.gain.setTargetAtTime(
        Math.max(0.0001, 0.035 * this.volume),
        context.currentTime,
        0.04,
      );
    } else if (this.boostRequested && this.volume > 0) {
      this.startBoostSound();
    }
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

  setBoosting(active: boolean): void {
    this.boostRequested = active;
    if (active) this.startBoostSound();
    else this.stopBoostSound();
  }

  isBoostSoundActive(): boolean {
    return this.boostSound !== null;
  }

  suspend(): void {
    this.boostRequested = false;
    this.stopBoostSound(true);
    void this.context?.suspend();
  }

  resume(): void {
    void this.context?.resume();
  }

  destroy(): void {
    this.boostRequested = false;
    this.stopBoostSound(true);
    void this.context?.close();
    this.context = null;
  }

  private startBoostSound(): void {
    const context = this.context;
    if (!context || this.boostSound || this.volume <= 0 || context.state === 'closed') return;

    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, 0.035 * this.volume),
      now + 0.12,
    );
    master.connect(context.destination);

    const lowPass = context.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.setValueAtTime(720, now);
    lowPass.Q.setValueAtTime(0.8, now);
    lowPass.connect(master);

    const engine = context.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.setValueAtTime(92, now);
    engine.frequency.exponentialRampToValueAtTime(178, now + 0.24);
    engine.connect(lowPass);

    const shimmer = context.createOscillator();
    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(184, now);
    shimmer.frequency.exponentialRampToValueAtTime(284, now + 0.3);
    const shimmerGain = context.createGain();
    shimmerGain.gain.setValueAtTime(0.18, now);
    shimmer.connect(shimmerGain).connect(lowPass);

    const noiseBuffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.32), context.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let index = 0; index < noiseData.length; index += 1) {
      noiseData[index] = Math.random() * 2 - 1;
    }
    const air = context.createBufferSource();
    air.buffer = noiseBuffer;
    air.loop = true;
    const airFilter = context.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.setValueAtTime(540, now);
    airFilter.Q.setValueAtTime(0.7, now);
    const airGain = context.createGain();
    airGain.gain.setValueAtTime(0.22, now);
    air.connect(airFilter).connect(airGain).connect(master);

    engine.start(now);
    shimmer.start(now);
    air.start(now);
    this.boostSound = { master, sources: [engine, shimmer, air] };
  }

  private stopBoostSound(immediate = false): void {
    const context = this.context;
    const sound = this.boostSound;
    if (!context || !sound) return;
    this.boostSound = null;
    const now = context.currentTime;
    const stopAt = now + (immediate ? 0.01 : 0.1);
    sound.master.gain.cancelScheduledValues(now);
    sound.master.gain.setValueAtTime(
      Math.max(0.0001, sound.master.gain.value),
      now,
    );
    sound.master.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    for (const source of sound.sources) {
      try {
        source.stop(stopAt + 0.02);
      } catch {
        // A source that already stopped needs no further cleanup.
      }
    }
  }
}
