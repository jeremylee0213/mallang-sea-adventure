// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { CourseManager } from '../src/core/CourseManager';
import { LEARNING_DIFFICULTIES, LEARNING_SUBJECTS } from '../src/data/courseContent';
import { STAGES } from '../src/data/stages';

function cyclingRandom(): () => number {
  const values = [0.03, 0.19, 0.37, 0.53, 0.71, 0.89];
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

describe('CourseManager', () => {
  it('표시되는 모든 과목과 난이도에서 중복 없는 정답 하나를 만든다', () => {
    const manager = new CourseManager(cyclingRandom());

    for (const subject of LEARNING_SUBJECTS) {
      for (const difficulty of LEARNING_DIFFICULTIES) {
        for (let sample = 0; sample < 10; sample += 1) {
          const question = subject === 'japanese'
            ? manager.nextJapaneseQuestion(difficulty, STAGES[0], {})
            : manager.nextQuestion(subject, difficulty);
          const labels = question.choices.map((choice) => choice.label);
          const correct = question.choices.filter((choice) => choice.isCorrect);
          const expectedCount = difficulty === 'easy' ? 3 : difficulty === 'normal' ? 4 : 5;

          expect(question.subject).toBe(subject);
          expect(question.difficulty).toBe(difficulty);
          expect(question.choices).toHaveLength(expectedCount);
          expect(new Set(labels).size).toBe(labels.length);
          expect(correct).toHaveLength(1);
          expect(correct[0]?.label).toBe(question.answer);
        }
      }
    }
  });

  it('선택지가 둘 이상이면 같은 과목의 직전 문제를 반복하지 않는다', () => {
    for (const subject of LEARNING_SUBJECTS) {
      const manager = new CourseManager(() => 0);
      const first = subject === 'japanese'
        ? manager.nextJapaneseQuestion('easy', STAGES[0], {})
        : manager.nextQuestion(subject, 'easy');
      const second = subject === 'japanese'
        ? manager.nextJapaneseQuestion('easy', STAGES[0], {})
        : manager.nextQuestion(subject, 'easy');

      expect(second.entryId).not.toBe(first.entryId);
    }
  });

  it('수학 문제의 표시 정답은 실제 계산 결과와 일치한다', () => {
    const manager = new CourseManager(cyclingRandom());

    for (const difficulty of LEARNING_DIFFICULTIES) {
      for (let sample = 0; sample < 40; sample += 1) {
        const question = manager.nextQuestion('mathematics', difficulty);
        const match = question.prompt.match(/^(\d+) ([+\-×÷]) (\d+) = \?$/);
        expect(match).not.toBeNull();
        if (!match) continue;
        const left = Number(match[1]);
        const right = Number(match[3]);
        const calculated = {
          '+': left + right,
          '-': left - right,
          '×': left * right,
          '÷': left / right,
        }[match[2] ?? '+'];

        expect(Number(question.answer)).toBe(calculated);
        if (match[2] === '÷') expect(left % right).toBe(0);
        if (match[2] === '-') expect(calculated).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('일본어는 스테이지 1·2·4의 단어와 문제 유형 경계를 유지한다', () => {
    const cases = [STAGES[0], STAGES[1], STAGES[3]];

    for (const stage of cases) {
      const manager = new CourseManager(cyclingRandom());
      for (let sample = 0; sample < 20; sample += 1) {
        const question = manager.nextJapaneseQuestion('challenge', stage, {});
        expect(stage.contentIds).toContain(question.entryId);
        expect(stage.questionTypes).toContain(question.type);
        expect(question.choices).toHaveLength(5);
      }
    }
  });

  it('일본어 오답률 가중치를 공통 문제 형식에서도 유지한다', () => {
    const manager = new CourseManager(() => 0.7);
    const question = manager.nextJapaneseQuestion('easy', STAGES[0], {
      'hira-o': { correct: 0, wrong: 10 },
    });

    expect(question.entryId).toBe('hira-o');
  });

  it('수학과 과학은 정답 대신 문제 문장을 자동 음성으로 사용한다', () => {
    const manager = new CourseManager(cyclingRandom());
    const mathematics = manager.nextQuestion('mathematics', 'easy');
    const science = manager.nextQuestion('science', 'easy');

    for (const question of [mathematics, science]) {
      expect(question.spokenText).toBe(question.prompt);
      expect(question.spokenText).not.toBe(question.answer);
      expect(question.speechLanguage).toBe('ko-KR');
    }
  });
});
