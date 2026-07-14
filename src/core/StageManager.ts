import { getStage } from '../data/stages';
import type { StageConfig, StageProgress } from '../types';

function clampCorrectAnswers(value: number, target: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(target, Math.max(0, Math.floor(value)));
}

export class StageManager {
  private stageConfig: StageConfig;
  private correctCount: number;

  constructor(stageOrId: StageConfig | number, initialCorrectAnswers = 0) {
    this.stageConfig = typeof stageOrId === 'number' ? getStage(stageOrId) : stageOrId;
    this.correctCount = clampCorrectAnswers(initialCorrectAnswers, this.stageConfig.targetAnswers);
  }

  get stage(): StageConfig {
    return this.stageConfig;
  }

  get correctAnswers(): number {
    return this.correctCount;
  }

  recordCorrect(): StageProgress {
    const wasComplete = this.isComplete();
    this.correctCount = clampCorrectAnswers(this.correctCount + 1, this.stageConfig.targetAnswers);
    return this.progress(!wasComplete && this.isComplete());
  }

  isComplete(): boolean {
    return this.correctCount >= this.stageConfig.targetAnswers;
  }

  getProgress(): StageProgress {
    return this.progress(false);
  }

  setStage(stageOrId: StageConfig | number, initialCorrectAnswers = 0): StageProgress {
    this.stageConfig = typeof stageOrId === 'number' ? getStage(stageOrId) : stageOrId;
    this.correctCount = clampCorrectAnswers(initialCorrectAnswers, this.stageConfig.targetAnswers);
    return this.getProgress();
  }

  private progress(justCompleted: boolean): StageProgress {
    return {
      stageId: this.stageConfig.id,
      correctAnswers: this.correctCount,
      targetAnswers: this.stageConfig.targetAnswers,
      complete: this.isComplete(),
      justCompleted,
    };
  }
}
