// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ISLANDS, ITEM_DEFINITIONS, JAPANESE_CONTENT, STAGES } from '../src/data';

describe('data contracts', () => {
  it('일본어 콘텐츠 30개 이상이 확장용 필드를 모두 가진다', () => {
    expect(JAPANESE_CONTENT.length).toBeGreaterThanOrEqual(30);
    for (const entry of JAPANESE_CONTENT) {
      expect(entry.id).not.toBe('');
      expect(entry.category).not.toBe('');
      expect(entry.japanese).not.toBe('');
      expect(entry.reading).not.toBe('');
      expect(entry.korean).not.toBe('');
      expect(entry.questionType.length).toBeGreaterThan(0);
      expect(entry.imageKey).not.toBe('');
      expect(entry.difficulty).toBeGreaterThan(0);
      expect(entry.region).not.toBe('');
      expect(entry.distractorTags.length).toBeGreaterThan(0);
    }
  });

  it('10개 스테이지가 순서대로 존재하고 각 완료 조건이 유효하다', () => {
    expect(STAGES).toHaveLength(10);
    expect(STAGES.map((stage) => stage.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(STAGES.every((stage) => stage.targetAnswers > 0)).toBe(true);
    expect(STAGES.every((stage) => stage.distractorCount >= 2)).toBe(true);
  });

  it('탐험 섬 4개와 잠긴 세계 구역, 아이템 6종이 존재한다', () => {
    expect(ISLANDS.filter((island) => island.explorable)).toHaveLength(4);
    expect(ISLANDS.filter((island) => !island.explorable).length).toBeGreaterThanOrEqual(2);
    expect(ITEM_DEFINITIONS).toHaveLength(6);
    expect(new Set(ITEM_DEFINITIONS.map((item) => item.id)).size).toBe(6);
  });
});
