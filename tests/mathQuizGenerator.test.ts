// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { MathQuizGenerator } from '../src/core/MathQuizGenerator';
import type { MathKind } from '../src/types';

function cyclingRandom(): () => number {
  const values = [0.03, 0.19, 0.37, 0.53, 0.71, 0.89];
  let index = 0;
  return () => values[index++ % values.length];
}

describe('MathQuizGenerator', () => {
  it('계산식과 일치하는 정답만 생성한다', () => {
    const generator = new MathQuizGenerator(cyclingRandom());
    const kinds: MathKind[] = [
      'two-digit-add',
      'two-digit-subtract',
      'three-digit-add',
      'three-digit-subtract',
      'multiply',
      'divide-exact',
    ];

    for (const kind of kinds) {
      for (let sample = 0; sample < 25; sample += 1) {
        const question = generator.generate(kind);
        const recalculated = {
          '+': question.left + question.right,
          '-': question.left - question.right,
          '×': question.left * question.right,
          '÷': question.left / question.right,
        }[question.operator];

        expect(question.answer).toBe(recalculated);
        expect(question.choices).toHaveLength(4);
        expect(new Set(question.choices).size).toBe(4);
        expect(question.choices).toContain(question.answer);
      }
    }
  });

  it('나눗셈은 항상 나머지가 없고 0으로 나누지 않는다', () => {
    const generator = new MathQuizGenerator(cyclingRandom());

    for (let sample = 0; sample < 100; sample += 1) {
      const question = generator.generate('divide-exact');

      expect(question.right).toBeGreaterThan(0);
      expect(question.left % question.right).toBe(0);
      expect(question.answer).toBe(question.left / question.right);
    }
  });
});
