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

  it('지원 환경에서는 이전 음성을 취소하고 자연스러운 ja-JP 음성을 천천히 선택한다', () => {
    const spoken: SpeechUtteranceLike[] = [];
    let cancelCount = 0;
    const manager = new SpeechManager({
      speechSynthesis: {
        cancel: () => { cancelCount += 1; },
        speak: (utterance) => { spoken.push(utterance); },
        getVoices: () => [
          { lang: 'en-US', name: 'English' },
          { lang: 'ja-JP', name: 'Japanese Compact' },
          { lang: 'ja-JP', name: 'Japanese Natural', default: true, localService: true },
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
    expect(spoken[1]?.voice?.name).toBe('Japanese Natural');
    expect(spoken[1]?.rate).toBe(0.78);
    expect(spoken[1]?.pitch).toBe(1);
  });

  it('영어·중국어·한국어에서 요청 지역과 문자 체계에 맞는 음성을 고른다', () => {
    const spoken: SpeechUtteranceLike[] = [];
    const manager = new SpeechManager({
      speechSynthesis: {
        cancel: () => undefined,
        speak: (utterance) => { spoken.push(utterance); },
        getVoices: () => [
          { lang: 'zh-TW', name: 'Traditional Chinese' },
          { lang: 'zh-Hans-CN', name: 'Simplified Chinese Natural' },
          { lang: 'en-GB', name: 'British English' },
          { lang: 'en-US', name: 'US English Natural' },
          { lang: 'ko-KR', name: 'Korean Natural' },
        ],
      },
      Utterance: FakeUtterance,
    });

    manager.speak('boat', { language: 'en-US' });
    manager.speak('水', { language: 'zh-CN' });
    manager.speak('문제를 읽어요', { language: 'ko-KR' });

    expect(spoken.map((utterance) => utterance.voice?.lang)).toEqual([
      'en-US',
      'zh-Hans-CN',
      'ko-KR',
    ]);
    expect(spoken.map((utterance) => utterance.rate)).toEqual([0.82, 0.78, 0.82]);
    expect(spoken.every((utterance) => utterance.pitch === 1)).toBe(true);
  });

  it('처음 비어 있던 음성 목록을 voiceschanged 후 갱신한다', () => {
    let voices: readonly VoiceLike[] = [];
    let voicesChanged: (() => void) | undefined;
    const spoken: SpeechUtteranceLike[] = [];
    const manager = new SpeechManager({
      speechSynthesis: {
        cancel: () => undefined,
        speak: (utterance) => { spoken.push(utterance); },
        getVoices: () => voices,
        addEventListener: (_type, listener) => { voicesChanged = listener; },
      },
      Utterance: FakeUtterance,
    });

    manager.speak('あ');
    expect(spoken[0]?.voice).toBeNull();
    voices = [{ lang: 'ja_JP', name: 'Japanese Natural', default: true }];
    voicesChanged?.();
    manager.speak('い');
    expect(spoken[1]?.voice?.lang).toBe('ja_JP');
  });

  it('취소된 옛 음성의 늦은 종료 이벤트가 새 음성을 끄지 않는다', () => {
    const spoken: SpeechUtteranceLike[] = [];
    const speakingStates: boolean[] = [];
    const manager = new SpeechManager({
      speechSynthesis: {
        cancel: () => undefined,
        speak: (utterance) => { spoken.push(utterance); },
        getVoices: () => [{ lang: 'ja-JP', name: 'Japanese' }],
      },
      Utterance: FakeUtterance,
    });

    manager.speak('あ', { onSpeakingChange: (speaking) => speakingStates.push(speaking) });
    spoken[0]?.onstart?.();
    manager.speak('い', { onSpeakingChange: (speaking) => speakingStates.push(speaking) });
    spoken[1]?.onstart?.();
    spoken[0]?.onend?.();

    expect(manager.isSpeaking()).toBe(true);
    expect(speakingStates.at(-1)).toBe(true);
  });
});
