// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  MemoryStorage,
  SAVE_KEY,
  SAVE_VERSION,
  SaveManager,
} from '../src/core/SaveManager';

const FIXED_NOW = '2026-07-14T00:00:00.000Z';

describe('SaveManager', () => {
  it('진행 상황을 저장하고 같은 내용으로 불러온다', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage, SAVE_KEY, () => FIXED_NOW);
    const initial = manager.load();
    const saved = manager.save({
      ...initial,
      currentStage: 4,
      highestStage: 5,
      score: 1_250,
      highScore: 2_400,
      unlockedIslands: ['start-island', 'jeju-wind-island'],
      discoveredIslands: ['jeju-wind-island'],
      claimedIslandInteractions: ['jeju-wind-island-chest'],
      completedStages: [1, 2, 3],
      inventory: { ...initial.inventory, starlightCompass: 3 },
      learnedJapanese: ['hira-a', 'word-water'],
      wordStats: {
        'hira-a': { correct: 4, wrong: 1 },
      },
    });

    expect(manager.load()).toEqual(saved);
    expect(saved.version).toBe(SAVE_VERSION);
    expect(saved.currentStage).toBe(4);
    expect(saved.inventory.starlightCompass).toBe(3);
    expect(saved.completedStages).toEqual([1, 2, 3]);
    expect(saved.discoveredIslands).toEqual(['jeju-wind-island']);
    expect(saved.claimedIslandInteractions).toEqual(['jeju-wind-island-chest']);
    expect(saved.wordStats['hira-a']).toEqual({ correct: 4, wrong: 1 });
  });

  it('손상된 저장 문자열을 예외 없이 안전한 기본값으로 복구한다', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{not valid json');
    const manager = new SaveManager(storage, SAVE_KEY, () => FIXED_NOW);

    expect(() => manager.load()).not.toThrow();
    const recovered = manager.load();

    expect(recovered.version).toBe(SAVE_VERSION);
    expect(recovered.currentStage).toBe(1);
    expect(recovered.highestStage).toBe(1);
    expect(recovered.score).toBe(0);
    expect(() => JSON.parse(storage.getItem(SAVE_KEY) ?? '')).not.toThrow();
  });

  it('필드 형식과 범위가 틀린 저장값을 안전한 범위로 병합한다', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
      currentStage: 99,
      highestStage: -5,
      score: -200,
      inventory: { starlightCompass: -7, tailwindBottle: 999 },
      settings: { volume: 4, japaneseVoice: 'yes', autoplayCount: 8 },
      learnedJapanese: ['hira-a', 'unknown-word', 'hira-a'],
      completedStages: [1, 1, 11, -2, 'bad'],
      discoveredIslands: ['jeju-wind-island', 'unknown-island'],
      claimedIslandInteractions: ['jeju-wind-island-chest', 'unknown-reward'],
      wordStats: { 'hira-a': { correct: -2, wrong: 3 }, junk: { correct: 50, wrong: 50 } },
    }));
    const manager = new SaveManager(storage, SAVE_KEY, () => FIXED_NOW);

    const recovered = manager.load();

    expect(recovered.currentStage).toBe(10);
    expect(recovered.highestStage).toBe(10);
    expect(recovered.score).toBe(0);
    expect(recovered.inventory.starlightCompass).toBe(0);
    expect(recovered.inventory.tailwindBottle).toBe(9);
    expect(recovered.settings.volume).toBe(1);
    expect(recovered.learnedJapanese).toEqual(['hira-a']);
    expect(recovered.completedStages).toEqual([1]);
    expect(recovered.discoveredIslands).toEqual(['jeju-wind-island']);
    expect(recovered.claimedIslandInteractions).toEqual(['jeju-wind-island-chest']);
    expect(recovered.wordStats).toEqual({ 'hira-a': { correct: 0, wrong: 3 } });
  });
});
