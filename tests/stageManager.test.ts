// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { StageManager } from '../src/core/StageManager';
import { STAGES } from '../src/data/stages';

describe('StageManager', () => {
  it('설정된 정답 수 바로 전에는 미완료이고 정확히 도달하면 완료된다', () => {
    const stage = STAGES[0];
    const manager = new StageManager(stage);

    for (let count = 0; count < stage.targetAnswers - 1; count += 1) {
      const result = manager.recordCorrect();
      expect(result.complete).toBe(false);
    }

    expect(manager.isComplete()).toBe(false);
    const completion = manager.recordCorrect();
    expect(completion.complete).toBe(true);
    expect(completion.justCompleted).toBe(true);
    expect(manager.isComplete()).toBe(true);

    const repeated = manager.recordCorrect();
    expect(repeated.correctAnswers).toBe(stage.targetAnswers);
    expect(repeated.justCompleted).toBe(false);
  });
});
