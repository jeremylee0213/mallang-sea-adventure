import {
  COURSE_DEFINITION_BY_ID,
  DIFFICULTY_DEFINITION_BY_ID,
  LANGUAGE_AND_SCIENCE_CONTENT,
} from '../data/courseContent';
import { JAPANESE_CONTENT } from '../data/japaneseContent';
import { QuizManager } from './QuizManager';
import type {
  CourseEntry,
  CourseQuestion,
  CourseQuizChoice,
  LearningStats,
  LearningDifficulty,
  LearningSubject,
  StageConfig,
} from '../types';

type RandomSource = () => number;

function safeRandom(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.999_999, Math.max(0, value));
}

function randomInteger(random: RandomSource, minimum: number, maximum: number): number {
  return minimum + Math.floor(safeRandom(random) * (maximum - minimum + 1));
}

function randomItem<T>(items: readonly T[], random: RandomSource): T {
  const item = items[Math.floor(safeRandom(random) * items.length)];
  if (!item) throw new Error('Cannot choose from an empty course entry pool.');
  return item;
}

function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(random, 0, index);
    const current = shuffled[index];
    const replacement = shuffled[swapIndex];
    if (current !== undefined && replacement !== undefined) {
      shuffled[index] = replacement;
      shuffled[swapIndex] = current;
    }
  }
  return shuffled;
}

function maximumLevel(difficulty: LearningDifficulty): 1 | 2 | 3 {
  if (difficulty === 'easy') return 1;
  if (difficulty === 'normal') return 2;
  return 3;
}

function uniqueLabels(labels: readonly string[], excluded: string): string[] {
  return [...new Set(labels.filter((label) => label !== excluded && label.trim().length > 0))];
}

function makeChoices(
  answer: string,
  distractors: readonly string[],
  count: number,
  random: RandomSource,
): readonly CourseQuizChoice[] {
  const uniqueDistractors = uniqueLabels(distractors, answer);
  if (uniqueDistractors.length < count - 1) {
    throw new Error(`Course question for “${answer}” needs ${count - 1} unique distractors.`);
  }
  const labels = shuffle([answer, ...shuffle(uniqueDistractors, random).slice(0, count - 1)], random);
  return labels.map((label, index) => ({
    id: `course-choice-${index}-${label}`,
    label,
    isCorrect: label === answer,
  }));
}

interface MathValues {
  readonly left: number;
  readonly right: number;
  readonly operator: '+' | '-' | '×' | '÷';
  readonly answer: number;
}

export class CourseManager {
  private readonly entries: readonly CourseEntry[];
  private readonly random: RandomSource;
  private readonly japaneseQuizManager: QuizManager;
  private readonly lastEntryBySubject = new Map<LearningSubject, string>();
  private questionSequence = 0;

  constructor(random: RandomSource = Math.random) {
    this.random = random;
    this.entries = LANGUAGE_AND_SCIENCE_CONTENT;
    this.japaneseQuizManager = new QuizManager(JAPANESE_CONTENT, random);
  }

  nextQuestion(
    subject: Exclude<LearningSubject, 'japanese'>,
    difficulty: LearningDifficulty,
  ): CourseQuestion {
    const definition = COURSE_DEFINITION_BY_ID.get(subject);
    const difficultyDefinition = DIFFICULTY_DEFINITION_BY_ID.get(difficulty);
    if (!definition || !difficultyDefinition) throw new Error('Unknown course configuration.');

    const question = subject === 'mathematics'
      ? this.createMathQuestion(difficulty, difficultyDefinition.choiceCount)
      : this.createEntryQuestion(subject, difficulty, difficultyDefinition.choiceCount);
    this.lastEntryBySubject.set(subject, question.entryId);
    this.questionSequence += 1;
    return question;
  }

  nextJapaneseQuestion(
    difficulty: LearningDifficulty,
    stage: StageConfig,
    stats: LearningStats = {},
  ): CourseQuestion {
    const difficultyDefinition = DIFFICULTY_DEFINITION_BY_ID.get(difficulty);
    if (!difficultyDefinition) throw new Error('Unknown course difficulty.');
    const stageForDifficulty: StageConfig = {
      ...stage,
      distractorCount: difficultyDefinition.choiceCount - 1,
    };
    const question = this.japaneseQuizManager.nextQuestion(stageForDifficulty, stats);
    const result: CourseQuestion = {
      id: `course-${question.entry.id}-${this.questionSequence}`,
      entryId: question.entry.id,
      subject: 'japanese',
      difficulty,
      type: question.type,
      prompt: question.prompt,
      accessibleText: question.accessibleText,
      answer: question.entry.japanese,
      reading: question.entry.reading,
      koreanMeaning: question.entry.korean,
      spokenText: question.entry.japanese,
      speechLanguage: 'ja-JP',
      promptImageKey: question.promptImageKey,
      choices: question.choices.map((choice) => ({
        id: choice.id,
        label: choice.label,
        isCorrect: choice.isCorrect,
      })),
    };
    this.questionSequence += 1;
    return result;
  }

  resetHistory(): void {
    this.lastEntryBySubject.clear();
    this.japaneseQuizManager.resetHistory();
  }

  private createEntryQuestion(
    subject: Exclude<LearningSubject, 'mathematics'>,
    difficulty: LearningDifficulty,
    choiceCount: number,
  ): CourseQuestion {
    const subjectEntries = this.entries.filter((entry) => entry.subject === subject);
    const levelEntries = subjectEntries.filter((entry) => entry.level <= maximumLevel(difficulty));
    const lastEntry = this.lastEntryBySubject.get(subject);
    const repeatSafeEntries = levelEntries.length > 1
      ? levelEntries.filter((entry) => entry.id !== lastEntry)
      : levelEntries;
    const entry = randomItem(repeatSafeEntries, this.random);
    const type = subject === 'science'
      ? 'science-fact' as const
      : safeRandom(this.random) < 0.3 ? 'language-audio' as const : 'language-meaning' as const;
    const distractors = entry.distractors ?? subjectEntries.map((candidate) => candidate.answer);
    const course = COURSE_DEFINITION_BY_ID.get(subject);
    const prompt = subject === 'science'
      ? (entry.prompt ?? entry.korean)
      : type === 'language-audio'
        ? `🔊 소리와 같은 ${course?.name ?? '낱말'}를 찾아요`
        : `“${entry.korean}”을 ${course?.name ?? '외국어'}로 찾아요`;

    return {
      id: `course-${entry.id}-${this.questionSequence}`,
      entryId: entry.id,
      subject,
      difficulty,
      type,
      prompt,
      accessibleText: subject === 'science'
        ? `${prompt} 보기 중 알맞은 답을 고르세요.`
        : `${prompt}. 정답 낱말은 ${entry.answer}, 읽기는 ${entry.reading}입니다.`,
      answer: entry.answer,
      reading: subject === 'science' ? undefined : entry.reading,
      koreanMeaning: entry.korean,
      spokenText: subject === 'science' ? prompt : entry.answer,
      speechLanguage: subject === 'science' ? 'ko-KR' : course?.speechLanguage,
      promptImageKey: entry.imageKey,
      choices: makeChoices(entry.answer, distractors, choiceCount, this.random),
    };
  }

  private createMathQuestion(
    difficulty: LearningDifficulty,
    choiceCount: number,
  ): CourseQuestion {
    let values = this.mathValues(difficulty);
    const previous = this.lastEntryBySubject.get('mathematics');
    let entryId = `math-${values.left}-${values.operator}-${values.right}`;
    if (entryId === previous) {
      values = this.nudgeMathValues(values);
      entryId = `math-${values.left}-${values.operator}-${values.right}`;
    }
    const answer = String(values.answer);
    const spread = difficulty === 'easy' ? 3 : difficulty === 'normal' ? 8 : 20;
    const distractors: string[] = [];
    for (let offset = 1; distractors.length < choiceCount - 1; offset += 1) {
      const distance = ((offset - 1) % spread) + 1;
      const candidate = offset % 2 === 0
        ? values.answer + distance
        : Math.max(0, values.answer - distance);
      const label = String(candidate);
      if (label !== answer && !distractors.includes(label)) distractors.push(label);
    }
    const prompt = `${values.left} ${values.operator} ${values.right} = ?`;

    return {
      id: `course-${entryId}-${this.questionSequence}`,
      entryId,
      subject: 'mathematics',
      difficulty,
      type: 'mathematics',
      prompt,
      accessibleText: `${prompt} 계산한 답을 고르세요.`,
      answer,
      koreanMeaning: '알맞은 계산 결과',
      spokenText: prompt,
      speechLanguage: 'ko-KR',
      choices: makeChoices(answer, distractors, choiceCount, this.random),
    };
  }

  private mathValues(difficulty: LearningDifficulty): MathValues {
    if (difficulty === 'easy') {
      const left = randomInteger(this.random, 1, 9);
      const right = randomInteger(this.random, 1, 9);
      if (safeRandom(this.random) < 0.5) return { left, right, operator: '+', answer: left + right };
      return {
        left: Math.max(left, right),
        right: Math.min(left, right),
        operator: '-',
        answer: Math.abs(left - right),
      };
    }

    if (difficulty === 'normal') {
      const operation = randomInteger(this.random, 0, 2);
      if (operation === 2) {
        const left = randomInteger(this.random, 2, 9);
        const right = randomInteger(this.random, 2, 9);
        return { left, right, operator: '×', answer: left * right };
      }
      const first = randomInteger(this.random, 10, 99);
      const second = randomInteger(this.random, 10, 99);
      return operation === 0
        ? { left: first, right: second, operator: '+', answer: first + second }
        : {
            left: Math.max(first, second),
            right: Math.min(first, second),
            operator: '-',
            answer: Math.abs(first - second),
          };
    }

    const operation = randomInteger(this.random, 0, 3);
    if (operation === 2) {
      const left = randomInteger(this.random, 4, 19);
      const right = randomInteger(this.random, 2, 12);
      return { left, right, operator: '×', answer: left * right };
    }
    if (operation === 3) {
      const right = randomInteger(this.random, 2, 12);
      const answer = randomInteger(this.random, 3, 20);
      return { left: right * answer, right, operator: '÷', answer };
    }
    const first = randomInteger(this.random, 100, 999);
    const second = randomInteger(this.random, 100, 999);
    return operation === 0
      ? { left: first, right: second, operator: '+', answer: first + second }
      : {
          left: Math.max(first, second),
          right: Math.min(first, second),
          operator: '-',
          answer: Math.abs(first - second),
        };
  }

  private nudgeMathValues(values: MathValues): MathValues {
    if (values.operator === '+') {
      return { ...values, right: values.right + 1, answer: values.answer + 1 };
    }
    if (values.operator === '-') {
      return values.left > values.right
        ? { ...values, right: values.right + 1, answer: values.answer - 1 }
        : { ...values, left: values.left + 1, answer: values.answer + 1 };
    }
    if (values.operator === '×') {
      return { ...values, right: values.right + 1, answer: values.left * (values.right + 1) };
    }
    return {
      ...values,
      left: values.left + values.right,
      answer: values.answer + 1,
    };
  }
}
