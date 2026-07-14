// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { QuizManager } from '../src/core/QuizManager';
import { STAGES } from '../src/data/stages';

function cyclingRandom(): () => number {
  const values = [0.01, 0.24, 0.48, 0.72, 0.96, 0.35, 0.61];
  let index = 0;
  return () => values[index++ % values.length];
}

describe('QuizManager', () => {
  it('모든 생성 문제에는 정답 선택지가 정확히 하나만 존재한다', () => {
    const manager = new QuizManager(undefined, cyclingRandom());

    for (const stage of STAGES) {
      for (let sample = 0; sample < 12; sample += 1) {
        const question = manager.nextQuestion(stage, {});
        const correctChoices = question.choices.filter((choice) => choice.isCorrect);

        expect(correctChoices).toHaveLength(1);
        expect(correctChoices[0].entryId).toBe(question.entry.id);
      }
    }
  });

  it('오답 후보는 정답 및 서로와 표시 문구가 중복되지 않는다', () => {
    const manager = new QuizManager(undefined, cyclingRandom());

    for (const stage of STAGES) {
      const question = manager.nextQuestion(stage, {});
      const labels = question.choices.map((choice) => choice.label);
      const correct = question.choices.find((choice) => choice.isCorrect);
      const distractors = question.choices.filter((choice) => !choice.isCorrect);

      expect(new Set(labels).size).toBe(labels.length);
      expect(distractors.every((choice) => choice.label !== correct?.label)).toBe(true);
    }
  });

  it('선택 가능한 단어가 둘 이상이면 직전 문제를 바로 반복하지 않는다', () => {
    const manager = new QuizManager(undefined, () => 0);
    const first = manager.nextQuestion(STAGES[0], {});
    const second = manager.nextQuestion(STAGES[0], {});

    expect(second.entry.id).not.toBe(first.entry.id);
  });

  it('오답률이 높은 단어에 제한된 추가 가중치를 준다', () => {
    const manager = new QuizManager(undefined, () => 0.7);
    const question = manager.nextQuestion(STAGES[0], {
      'hira-o': { correct: 0, wrong: 10 },
    });

    expect(question.entry.id).toBe('hira-o');
  });
});
