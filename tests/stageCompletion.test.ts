// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createDefaultSave } from '../src/core/SaveManager';
import { settleStageCompletion } from '../src/core/StageCompletion';

describe('settleStageCompletion', () => {
  it('첫 완료는 보상을 한 번만 청구하고 다음 스테이지를 즉시 저장한다', () => {
    const save = { ...createDefaultSave(), currentStage: 7, highestStage: 7 };

    const settlement = settleStageCompletion(save, 7);

    expect(settlement.firstCompletion).toBe(true);
    expect(settlement.completedStages).toEqual([7]);
    expect(settlement.currentStage).toBe(8);
    expect(settlement.highestStage).toBe(8);
    expect(settlement.freeSailUnlocked).toBe(false);
  });

  it('완료 화면 새로고침 뒤 같은 완료 처리를 반복해도 보상을 다시 청구하지 않는다', () => {
    const save = {
      ...createDefaultSave(),
      currentStage: 7,
      highestStage: 7,
      completedStages: [7],
    };

    const settlement = settleStageCompletion(save, 7);

    expect(settlement.firstCompletion).toBe(false);
    expect(settlement.completedStages).toEqual([7]);
    expect(settlement.currentStage).toBe(8);
    expect(settlement.highestStage).toBe(8);
  });

  it('10단계 완료와 자유 항해 해금을 같은 저장 단위로 확정한다', () => {
    const save = { ...createDefaultSave(), currentStage: 10, highestStage: 10 };

    const settlement = settleStageCompletion(save, 10);

    expect(settlement.firstCompletion).toBe(true);
    expect(settlement.completedStages).toEqual([10]);
    expect(settlement.currentStage).toBe(10);
    expect(settlement.highestStage).toBe(10);
    expect(settlement.freeSailUnlocked).toBe(true);
  });
});
