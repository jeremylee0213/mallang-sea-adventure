import { JAPANESE_CONTENT } from '../data/japaneseContent';
import { getStage } from '../data/stages';
import type {
  JapaneseEntry,
  LearningStats,
  QuestionType,
  QuizChoice,
  QuizQuestion,
  StageConfig,
} from '../types';

type RandomSource = () => number;

function safeRandom(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.999_999, Math.max(0, value));
}

function randomItem<T>(items: readonly T[], random: RandomSource): T {
  const selected = items[Math.floor(safeRandom(random) * items.length)];
  if (selected === undefined) {
    throw new Error('Cannot choose from an empty list.');
  }
  return selected;
}

function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(safeRandom(random) * (index + 1));
    const current = result[index];
    const replacement = result[swapIndex];
    if (current !== undefined && replacement !== undefined) {
      result[index] = replacement;
      result[swapIndex] = current;
    }
  }
  return result;
}

function hasQuestionType(entry: JapaneseEntry, types: readonly QuestionType[]): boolean {
  return entry.questionType.some((type) => types.includes(type));
}

function learningWeight(entry: JapaneseEntry, stats: LearningStats): number {
  const stat = stats[entry.id];
  if (!stat) return 1;

  const correct = Math.max(0, Number.isFinite(stat.correct) ? stat.correct : 0);
  const wrong = Math.max(0, Number.isFinite(stat.wrong) ? stat.wrong : 0);
  const attempts = correct + wrong;
  if (attempts === 0) return 1;

  const errorRate = wrong / attempts;
  return 1 + Math.min(3, errorRate * 3);
}

function weightedEntry(
  entries: readonly JapaneseEntry[],
  stats: LearningStats,
  random: RandomSource,
): JapaneseEntry {
  const weights = entries.map((entry) => learningWeight(entry, stats));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = safeRandom(random) * total;

  for (let index = 0; index < entries.length; index += 1) {
    cursor -= weights[index] ?? 0;
    if (cursor < 0) {
      const entry = entries[index];
      if (entry) return entry;
    }
  }

  const fallback = entries.at(-1);
  if (!fallback) throw new Error('Cannot choose from an empty entry pool.');
  return fallback;
}

function promptFor(entry: JapaneseEntry, type: QuestionType): Pick<QuizQuestion, 'prompt' | 'accessibleText' | 'promptImageKey'> {
  switch (type) {
    case 'hiragana-match':
      return {
        prompt: `같은 히라가나 ${entry.japanese}를 찾아요`,
        accessibleText: `히라가나 ${entry.japanese}, 읽기 ${entry.reading}`,
      };
    case 'katakana-match':
      return {
        prompt: `같은 가타카나 ${entry.japanese}를 찾아요`,
        accessibleText: `가타카나 ${entry.japanese}, 읽기 ${entry.reading}`,
      };
    case 'korean-to-japanese':
      return {
        prompt: `“${entry.korean}”을 일본어로 찾아요`,
        accessibleText: `한국어 뜻 ${entry.korean}. 일본어 단어를 고르세요.`,
      };
    case 'picture-to-japanese':
      return {
        prompt: `그림의 “${entry.korean}”을 일본어로 찾아요`,
        accessibleText: `${entry.korean} 그림. 일본어 단어를 고르세요.`,
        promptImageKey: entry.imageKey,
      };
    case 'audio-to-japanese':
      return {
        prompt: `🔊 ${entry.japanese} 소리와 같은 말을 찾아요`,
        accessibleText: `소리 없이도 풀 수 있어요. ${entry.japanese}, 읽기 ${entry.reading}, 뜻 ${entry.korean}.`,
      };
  }
}

export class QuizManager {
  private readonly content: readonly JapaneseEntry[];
  private readonly contentById: ReadonlyMap<string, JapaneseEntry>;
  private readonly random: RandomSource;
  private lastEntryId: string | null = null;

  constructor(
    content: readonly JapaneseEntry[] = JAPANESE_CONTENT,
    random: RandomSource = Math.random,
  ) {
    this.content = content;
    this.contentById = new Map(content.map((entry) => [entry.id, entry]));
    this.random = random;
  }

  nextQuestion(stageOrId: StageConfig | number, stats: LearningStats = {}): QuizQuestion {
    const stage = typeof stageOrId === 'number' ? getStage(stageOrId) : stageOrId;
    const stageEntries = stage.contentIds
      .map((id) => this.contentById.get(id))
      .filter((entry): entry is JapaneseEntry => Boolean(entry))
      .filter((entry) => hasQuestionType(entry, stage.questionTypes));

    if (stageEntries.length === 0) {
      throw new Error(`Stage ${stage.id} has no compatible Japanese content.`);
    }

    const repeatSafeEntries = stageEntries.length > 1
      ? stageEntries.filter((entry) => entry.id !== this.lastEntryId)
      : stageEntries;
    const entry = weightedEntry(repeatSafeEntries, stats, this.random);
    const compatibleTypes = entry.questionType.filter((type) => stage.questionTypes.includes(type));
    const type = randomItem(compatibleTypes, this.random);
    const choices = this.createChoices(entry, stage, stageEntries);
    const prompt = promptFor(entry, type);

    this.lastEntryId = entry.id;
    return {
      entry,
      type,
      ...prompt,
      choices,
    };
  }

  resetHistory(): void {
    this.lastEntryId = null;
  }

  private createChoices(
    answer: JapaneseEntry,
    stage: StageConfig,
    stageEntries: readonly JapaneseEntry[],
  ): readonly QuizChoice[] {
    const uniqueByLabel = new Map<string, JapaneseEntry>();
    const stageCandidateIds = new Set(stageEntries.map((entry) => entry.id));
    const stageCandidates = shuffle(
      stageEntries.filter((entry) => entry.id !== answer.id),
      this.random,
    );
    const relatedCandidates = shuffle(
      this.content.filter((entry) => (
        entry.id !== answer.id
        && !stageCandidateIds.has(entry.id)
        && this.distractorAffinity(answer, entry) > 0
      )),
      this.random,
    );
    const remainingCandidates = shuffle(
      this.content.filter((entry) => (
        entry.id !== answer.id
        && !stageCandidateIds.has(entry.id)
        && this.distractorAffinity(answer, entry) === 0
      )),
      this.random,
    );
    const candidates = [...stageCandidates, ...relatedCandidates, ...remainingCandidates];

    for (const candidate of candidates) {
      if (candidate.japanese !== answer.japanese && !uniqueByLabel.has(candidate.japanese)) {
        uniqueByLabel.set(candidate.japanese, candidate);
      }
    }

    const distractors = shuffle([...uniqueByLabel.values()], this.random).slice(0, stage.distractorCount);
    if (distractors.length !== stage.distractorCount) {
      throw new Error(`Stage ${stage.id} needs more unique distractors.`);
    }

    const entries = shuffle([answer, ...distractors], this.random);
    return entries.map((entry) => ({
      id: `choice-${entry.id}`,
      entryId: entry.id,
      label: entry.japanese,
      imageKey: entry.imageKey,
      isCorrect: entry.id === answer.id,
    }));
  }

  private distractorAffinity(answer: JapaneseEntry, candidate: JapaneseEntry): number {
    let score = candidate.category === answer.category ? 2 : 0;
    for (const tag of candidate.distractorTags) {
      if (answer.distractorTags.includes(tag)) score += 1;
    }
    return score;
  }
}
