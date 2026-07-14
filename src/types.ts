export type GameState =
  | 'MENU'
  | 'TUTORIAL'
  | 'SAILING'
  | 'DOCKING'
  | 'ISLAND_EXPLORATION'
  | 'QUIZ'
  | 'PAUSED'
  | 'STAGE_CLEAR';

export type QuestionType =
  | 'hiragana-match'
  | 'katakana-match'
  | 'korean-to-japanese'
  | 'picture-to-japanese'
  | 'audio-to-japanese';

export type JapaneseCategory =
  | 'hiragana'
  | 'katakana'
  | 'food'
  | 'animal'
  | 'travel'
  | 'nature'
  | 'object';

export interface JapaneseEntry {
  readonly id: string;
  readonly category: JapaneseCategory;
  readonly japanese: string;
  readonly reading: string;
  readonly korean: string;
  readonly questionType: readonly QuestionType[];
  readonly imageKey: string;
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  readonly region: string;
  readonly distractorTags: readonly string[];
}

export interface LearningStat {
  correct: number;
  wrong: number;
}

export type LearningStats = Record<string, LearningStat>;

export interface QuizChoice {
  readonly id: string;
  readonly entryId: string;
  readonly label: string;
  readonly imageKey: string;
  readonly isCorrect: boolean;
}

export interface QuizQuestion {
  readonly entry: JapaneseEntry;
  readonly type: QuestionType;
  readonly prompt: string;
  readonly accessibleText: string;
  readonly promptImageKey?: string;
  readonly choices: readonly QuizChoice[];
}

export type MathKind =
  | 'two-digit-add'
  | 'two-digit-subtract'
  | 'three-digit-add'
  | 'three-digit-subtract'
  | 'multiply'
  | 'divide-exact';

export type MathOperator = '+' | '-' | '×' | '÷';

export interface MathQuestion {
  readonly kind: MathKind;
  readonly left: number;
  readonly right: number;
  readonly operator: MathOperator;
  readonly answer: number;
  readonly prompt: string;
  readonly choices: readonly number[];
  readonly hint: string;
}

export type ItemId =
  | 'starlightCompass'
  | 'tailwindBottle'
  | 'seaMagnet'
  | 'timeBubble'
  | 'healingApple'
  | 'shieldShell';

export interface ItemDefinition {
  readonly id: ItemId;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly category: 'sailing' | 'exploration' | 'combat';
  readonly cooldownSeconds: number;
  readonly durationSeconds: number;
  readonly maxStack: number;
}

export type Inventory = Record<ItemId, number>;

export interface StageReward {
  readonly itemId: ItemId;
  readonly itemCount: number;
  readonly message: string;
  readonly unlockIslandId?: string;
  readonly cosmetic?: string;
}

export interface StageConfig {
  readonly id: number;
  readonly name: string;
  readonly region: string;
  readonly targetAnswers: number;
  readonly distractorCount: number;
  readonly timeLimitSeconds: number | null;
  readonly autoHint: boolean;
  readonly movingDistractors: boolean;
  readonly contentIds: readonly string[];
  readonly questionTypes: readonly QuestionType[];
  readonly mathKinds: readonly MathKind[];
  readonly reward: StageReward;
  readonly monsterCount: number;
}

export interface WorldPoint {
  readonly x: number;
  readonly z: number;
}

export interface DockDefinition extends WorldPoint {
  readonly heading: number;
}

export interface IslandContent {
  readonly npc: boolean;
  readonly treasureChest: boolean;
  readonly mathQuiz: boolean;
  readonly languageSign: boolean;
  readonly monsters: number;
  readonly healingItem: boolean;
  readonly marineLife: boolean;
}

export interface IslandDefinition {
  readonly id: string;
  readonly name: string;
  readonly region: string;
  readonly position: WorldPoint;
  readonly dock: DockDefinition;
  readonly radius: number;
  readonly theme: 'start' | 'volcanic' | 'sakura' | 'rocky-marine' | 'future';
  readonly explorable: boolean;
  readonly unlockStage: number | null;
  readonly lockedLabel?: string;
  readonly peaceful: boolean;
  readonly content: IslandContent;
}

export interface StageProgress {
  readonly stageId: number;
  readonly correctAnswers: number;
  readonly targetAnswers: number;
  readonly complete: boolean;
  readonly justCompleted: boolean;
}

export type ItemUseReason = 'used' | 'empty' | 'cooldown' | 'unknown-item';

export interface ItemUseResult {
  readonly success: boolean;
  readonly itemId: ItemId;
  readonly reason: ItemUseReason;
  readonly remaining: number;
  readonly cooldownRemaining: number;
  readonly activeRemaining: number;
}

export interface ItemRuntimeState {
  readonly inventory: Inventory;
  readonly cooldowns: Record<ItemId, number>;
  readonly activeEffects: Record<ItemId, number>;
}

export interface GameSettings {
  volume: number;
  japaneseVoice: boolean;
  autoplayCount: 0 | 1 | 2;
  shadowQuality: 'off' | 'low' | 'high';
  mathInputMode: 'choices' | 'keyboard';
}

export interface SaveData {
  version: number;
  highestStage: number;
  currentStage: number;
  completedStages: number[];
  score: number;
  highScore: number;
  unlockedIslands: string[];
  discoveredIslands: string[];
  claimedIslandInteractions: string[];
  inventory: Inventory;
  settings: GameSettings;
  learnedJapanese: string[];
  wordStats: LearningStats;
  lastPlayedAt: string;
  tutorialComplete: boolean;
  freeSailUnlocked: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface VoiceLike {
  readonly lang: string;
  readonly name?: string;
}

export interface SpeechUtteranceLike {
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: VoiceLike | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

export interface SpeechSynthesisLike {
  cancel(): void;
  speak(utterance: SpeechUtteranceLike): void;
  getVoices(): readonly VoiceLike[];
}

export type SpeechUtteranceConstructor = new (text: string) => SpeechUtteranceLike;

export interface SpeechEnvironment {
  speechSynthesis: SpeechSynthesisLike | undefined;
  Utterance: SpeechUtteranceConstructor | undefined;
}

export interface SpeechOptions {
  readonly volume?: number;
  readonly rate?: number;
  readonly pitch?: number;
  readonly onSpeakingChange?: (speaking: boolean) => void;
}
