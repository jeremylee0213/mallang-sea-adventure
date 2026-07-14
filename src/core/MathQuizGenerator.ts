import { getStage } from '../data/stages';
import type { MathKind, MathOperator, MathQuestion, StageConfig } from '../types';

type RandomSource = () => number;

function safeRandom(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.999_999, Math.max(0, value));
}

function randomInteger(random: RandomSource, minimum: number, maximum: number): number {
  return minimum + Math.floor(safeRandom(random) * (maximum - minimum + 1));
}

function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(random, 0, index);
    const current = result[index];
    const replacement = result[swapIndex];
    if (current !== undefined && replacement !== undefined) {
      result[index] = replacement;
      result[swapIndex] = current;
    }
  }
  return result;
}

function defaultKindsForStage(stageId: number): readonly MathKind[] {
  if (stageId <= 7) return ['two-digit-add', 'two-digit-subtract'];
  if (stageId === 8) return ['three-digit-add', 'three-digit-subtract'];
  if (stageId === 9) return ['multiply', 'divide-exact'];
  return [
    'two-digit-add',
    'two-digit-subtract',
    'three-digit-add',
    'three-digit-subtract',
    'multiply',
    'divide-exact',
  ];
}

function hintFor(kind: MathKind): string {
  switch (kind) {
    case 'two-digit-add':
    case 'three-digit-add':
      return '일의 자리부터 차근차근 더해 보자!';
    case 'two-digit-subtract':
    case 'three-digit-subtract':
      return '일의 자리부터 빼고, 필요하면 앞자리에서 빌려 보자!';
    case 'multiply':
      return '같은 수를 몇 번 더하는지 생각해 보자!';
    case 'divide-exact':
      return '나누는 수의 구구단을 거꾸로 생각해 보자!';
  }
}

export class MathQuizGenerator {
  constructor(private readonly random: RandomSource = Math.random) {}

  generate(kindOrStage: MathKind | StageConfig | number): MathQuestion {
    const kind = this.resolveKind(kindOrStage);
    const values = this.generateValues(kind);
    const choices = this.generateChoices(values.answer);

    return {
      kind,
      ...values,
      prompt: `${values.left} ${values.operator} ${values.right} = ?`,
      choices,
      hint: hintFor(kind),
    };
  }

  private resolveKind(kindOrStage: MathKind | StageConfig | number): MathKind {
    if (typeof kindOrStage === 'string') return kindOrStage;
    const stage = typeof kindOrStage === 'number' ? getStage(kindOrStage) : kindOrStage;
    const kinds = stage.mathKinds.length > 0 ? stage.mathKinds : defaultKindsForStage(stage.id);
    const selected = kinds[randomInteger(this.random, 0, kinds.length - 1)];
    if (!selected) throw new Error(`Stage ${stage.id} has no math question kinds.`);
    return selected;
  }

  private generateValues(kind: MathKind): {
    left: number;
    right: number;
    operator: MathOperator;
    answer: number;
  } {
    switch (kind) {
      case 'two-digit-add': {
        const left = randomInteger(this.random, 10, 99);
        const right = randomInteger(this.random, 10, 99);
        return { left, right, operator: '+', answer: left + right };
      }
      case 'two-digit-subtract': {
        const first = randomInteger(this.random, 10, 99);
        const second = randomInteger(this.random, 10, 99);
        const left = Math.max(first, second);
        const right = Math.min(first, second);
        return { left, right, operator: '-', answer: left - right };
      }
      case 'three-digit-add': {
        const left = randomInteger(this.random, 100, 999);
        const right = randomInteger(this.random, 100, 999);
        return { left, right, operator: '+', answer: left + right };
      }
      case 'three-digit-subtract': {
        const first = randomInteger(this.random, 100, 999);
        const second = randomInteger(this.random, 100, 999);
        const left = Math.max(first, second);
        const right = Math.min(first, second);
        return { left, right, operator: '-', answer: left - right };
      }
      case 'multiply': {
        const left = randomInteger(this.random, 2, 19);
        const right = randomInteger(this.random, 2, 9);
        return { left, right, operator: '×', answer: left * right };
      }
      case 'divide-exact': {
        const right = randomInteger(this.random, 2, 12);
        const answer = randomInteger(this.random, 2, 12);
        return { left: right * answer, right, operator: '÷', answer };
      }
    }
  }

  private generateChoices(answer: number): readonly number[] {
    const choices = new Set<number>([answer]);
    const spread = Math.max(4, Math.min(40, Math.ceil(Math.abs(answer) * 0.12)));

    for (let attempt = 0; choices.size < 4 && attempt < 24; attempt += 1) {
      const magnitude = randomInteger(this.random, 1, spread) + Math.floor(attempt / 4);
      const direction = safeRandom(this.random) < 0.5 ? -1 : 1;
      choices.add(Math.max(0, answer + magnitude * direction));
    }

    for (let offset = 1; choices.size < 4; offset += 1) {
      choices.add(answer + offset);
    }

    return shuffle([...choices], this.random);
  }
}
