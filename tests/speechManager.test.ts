// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { SpeechManager } from '../src/core/SpeechManager';
import type { SpeechUtteranceLike, VoiceLike } from '../src/types';

class FakeUtterance implements SpeechUtteranceLike {
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: VoiceLike | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly text: string) {}
}

describe('SpeechManager', () => {
  it('음성 API가 없는 환경에서 오류 없이 no-op으로 동작한다', () => {
    const manager = new SpeechManager({
      speechSynthesis: undefined,
      Utterance: undefined,
    });

    expect(manager.isSupported()).toBe(false);
    expect(() => manager.cancel()).not.toThrow();
    expect(() => manager.speak('あ')).not.toThrow();
    expect(manager.speak('あ')).toBe(false);
  });

  it('지원 환경에서는 이전 음성을 취소하고 ja-JP 음성을 선택한다', () => {
    const spoken: SpeechUtteranceLike[] = [];
    let cancelCount = 0;
    const manager = new SpeechManager({
      speechSynthesis: {
        cancel: () => { cancelCount += 1; },
        speak: (utterance) => { spoken.push(utterance); },
        getVoices: () => [
          { lang: 'en-US', name: 'English' },
          { lang: 'ja-JP', name: 'Japanese' },
        ],
      },
      Utterance: FakeUtterance,
    });

    expect(manager.speak('みず')).toBe(true);
    expect(manager.speak('ふね')).toBe(true);
    expect(cancelCount).toBe(2);
    expect(spoken).toHaveLength(2);
    expect(spoken[1]?.lang).toBe('ja-JP');
    expect(spoken[1]?.voice?.lang).toBe('ja-JP');
  });
});
