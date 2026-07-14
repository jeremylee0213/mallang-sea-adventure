import type {
  SpeechEnvironment,
  SpeechOptions,
  SpeechSynthesisLike,
  SpeechUtteranceConstructor,
} from '../types';

function defaultEnvironment(): SpeechEnvironment {
  const scope = globalThis as {
    speechSynthesis?: SpeechSynthesisLike;
    SpeechSynthesisUtterance?: SpeechUtteranceConstructor;
  };
  return {
    speechSynthesis: scope.speechSynthesis,
    Utterance: scope.SpeechSynthesisUtterance,
  };
}

function clamp(value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

export class SpeechManager {
  private readonly environment: SpeechEnvironment;
  private speaking = false;
  private speakingListener: ((speaking: boolean) => void) | undefined;

  constructor(environment: SpeechEnvironment = defaultEnvironment()) {
    this.environment = environment;
  }

  isSupported(): boolean {
    return Boolean(this.environment.speechSynthesis && this.environment.Utterance);
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  speak(text: string, options: SpeechOptions = {}): boolean {
    if (!this.isSupported() || text.trim().length === 0) {
      options.onSpeakingChange?.(false);
      return false;
    }

    this.cancel();
    const synthesis = this.environment.speechSynthesis;
    const Utterance = this.environment.Utterance;
    if (!synthesis || !Utterance) return false;

    try {
      const utterance = new Utterance(text);
      utterance.lang = 'ja-JP';
      utterance.rate = clamp(options.rate, 0.86, 0.5, 1.25);
      utterance.pitch = clamp(options.pitch, 1.08, 0.6, 1.4);
      utterance.volume = clamp(options.volume, 1, 0, 1);
      utterance.voice = synthesis.getVoices().find((voice) => (
        voice.lang.toLowerCase() === 'ja-jp'
      )) ?? synthesis.getVoices().find((voice) => (
        voice.lang.toLowerCase().startsWith('ja')
      )) ?? null;

      this.speakingListener = options.onSpeakingChange;
      utterance.onstart = () => this.setSpeaking(true);
      utterance.onend = () => this.setSpeaking(false);
      utterance.onerror = () => this.setSpeaking(false);
      synthesis.speak(utterance);
      return true;
    } catch {
      this.setSpeaking(false);
      return false;
    }
  }

  cancel(): void {
    try {
      this.environment.speechSynthesis?.cancel();
    } catch {
      // Unsupported or blocked speech remains a harmless no-op.
    }
    this.setSpeaking(false);
  }

  private setSpeaking(speaking: boolean): void {
    this.speaking = speaking;
    this.speakingListener?.(speaking);
    if (!speaking) this.speakingListener = undefined;
  }
}
