import type {
  SpeechEnvironment,
  SpeechOptions,
  SpeechSynthesisLike,
  SpeechUtteranceConstructor,
  VoiceLike,
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

function normalizedLanguage(language: string): string {
  return language.trim().replaceAll('_', '-').toLowerCase();
}

function languageParts(language: string): readonly string[] {
  return normalizedLanguage(language).split('-').filter(Boolean);
}

function voiceScore(voice: VoiceLike, requestedLanguage: string): number {
  const requested = languageParts(requestedLanguage);
  const candidate = languageParts(voice.lang);
  if (!requested[0] || requested[0] !== candidate[0]) return Number.NEGATIVE_INFINITY;

  let score = normalizedLanguage(voice.lang) === normalizedLanguage(requestedLanguage) ? 1_000 : 300;
  const requestedSet = new Set(requested.slice(1));
  const candidateSet = new Set(candidate.slice(1));
  for (const part of requestedSet) {
    if (candidateSet.has(part)) score += 90;
  }

  if (requested[0] === 'zh') {
    const wantsSimplified = requestedSet.has('cn') || requestedSet.has('sg') || requestedSet.has('hans');
    const candidateSimplified = candidateSet.has('cn') || candidateSet.has('sg') || candidateSet.has('hans');
    const candidateTraditional = candidateSet.has('tw') || candidateSet.has('hk') || candidateSet.has('hant');
    if (wantsSimplified && candidateSimplified) score += 120;
    if (wantsSimplified && candidateTraditional) score -= 160;
  }

  if (voice.default) score += 28;
  if (voice.localService) score += 18;
  const name = (voice.name ?? '').toLowerCase();
  if (/(natural|premium|enhanced|neural|studio)/u.test(name)) score += 20;
  if (/(compact|espeak)/u.test(name)) score -= 24;
  return score;
}

function naturalRate(language: string): number {
  const primary = languageParts(language)[0];
  return primary === 'ja' || primary === 'zh' ? 0.78 : 0.82;
}

export class SpeechManager {
  private readonly environment: SpeechEnvironment;
  private voices: readonly VoiceLike[] = [];
  private speaking = false;
  private speakingListener: ((speaking: boolean) => void) | undefined;
  private generation = 0;

  constructor(environment: SpeechEnvironment = defaultEnvironment()) {
    this.environment = environment;
    this.refreshVoices();
    this.environment.speechSynthesis?.addEventListener?.('voiceschanged', this.onVoicesChanged);
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
      const language = options.language?.trim() || 'ja-JP';
      if (this.voices.length === 0) this.refreshVoices();
      utterance.lang = language;
      utterance.rate = clamp(options.rate, naturalRate(language), 0.5, 1.25);
      utterance.pitch = clamp(options.pitch, 1, 0.6, 1.4);
      utterance.volume = clamp(options.volume, 1, 0, 1);
      utterance.voice = [...this.voices]
        .map((voice, index) => ({ voice, index, score: voiceScore(voice, language) }))
        .filter((candidate) => Number.isFinite(candidate.score))
        .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.voice ?? null;

      this.speakingListener = options.onSpeakingChange;
      const generation = this.generation;
      utterance.onstart = () => {
        if (this.generation === generation) this.setSpeaking(true);
      };
      utterance.onend = () => {
        if (this.generation === generation) this.setSpeaking(false);
      };
      utterance.onerror = () => {
        if (this.generation === generation) this.setSpeaking(false);
      };
      synthesis.speak(utterance);
      return true;
    } catch {
      this.setSpeaking(false);
      return false;
    }
  }

  cancel(): void {
    this.generation += 1;
    try {
      this.environment.speechSynthesis?.cancel();
    } catch {
      // Unsupported or blocked speech remains a harmless no-op.
    }
    this.setSpeaking(false);
  }

  destroy(): void {
    this.cancel();
    this.environment.speechSynthesis?.removeEventListener?.('voiceschanged', this.onVoicesChanged);
  }

  private setSpeaking(speaking: boolean): void {
    this.speaking = speaking;
    this.speakingListener?.(speaking);
    if (!speaking) this.speakingListener = undefined;
  }

  private refreshVoices(): void {
    try {
      this.voices = this.environment.speechSynthesis?.getVoices() ?? [];
    } catch {
      this.voices = [];
    }
  }

  private readonly onVoicesChanged = (): void => {
    this.refreshVoices();
  };
}
