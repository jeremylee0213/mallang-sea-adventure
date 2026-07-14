import type { SaveData } from '../types';

export interface StageCompletionSettlement {
  readonly firstCompletion: boolean;
  readonly completedStages: number[];
  readonly currentStage: number;
  readonly highestStage: number;
  readonly freeSailUnlocked: boolean;
}

/**
 * Calculates the progress fields that must be persisted in the same write as a
 * stage reward. The function is pure so reload and duplicate-claim boundaries
 * stay easy to verify.
 */
export function settleStageCompletion(
  save: SaveData,
  stageId: number,
  finalStage = 10,
): StageCompletionSettlement {
  const safeFinalStage = Math.max(1, Math.floor(finalStage));
  const safeStage = Math.min(safeFinalStage, Math.max(1, Math.floor(stageId)));
  const completed = new Set(save.completedStages);
  const firstCompletion = !completed.has(safeStage);
  completed.add(safeStage);
  const nextStage = safeStage >= safeFinalStage ? safeFinalStage : safeStage + 1;

  return {
    firstCompletion,
    completedStages: [...completed].sort((left, right) => left - right),
    currentStage: Math.max(save.currentStage, nextStage),
    highestStage: Math.max(save.highestStage, nextStage),
    freeSailUnlocked: save.freeSailUnlocked || safeStage >= safeFinalStage,
  };
}
