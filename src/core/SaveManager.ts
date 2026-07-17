import { ISLANDS } from '../data/islands';
import { ITEM_DEFINITIONS } from '../data/items';
import { JAPANESE_CONTENT } from '../data/japaneseContent';
import {
  COSMETIC_IDS_BY_TARGET,
  DEFAULT_BOAT_SKIN_ID,
  DEFAULT_CHARACTER_SKIN_ID,
} from '../data/cosmetics';
import { LEARNING_DIFFICULTIES, LEARNING_SUBJECTS } from '../data/courseContent';
import type {
  GameSettings,
  Inventory,
  ItemId,
  LearningDifficulty,
  LearningSubject,
  LearningStats,
  SaveData,
  StorageLike,
} from '../types';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'mallang-sea-adventure.save.v1';

const ITEM_IDS = ITEM_DEFINITIONS.map((item) => item.id);
const JAPANESE_IDS: ReadonlySet<string> = new Set<string>(
  JAPANESE_CONTENT.map((entry) => entry.id),
);
const EXPLORABLE_ISLAND_IDS: ReadonlySet<string> = new Set<string>(
  ISLANDS.filter((island) => island.explorable).map((island) => island.id),
);
const SUBJECT_IDS: ReadonlySet<string> = new Set(LEARNING_SUBJECTS);
const DIFFICULTY_IDS: ReadonlySet<string> = new Set(LEARNING_DIFFICULTIES);
const ISLAND_INTERACTION_IDS: ReadonlySet<string> = new Set<string>(
  ISLANDS.flatMap((island) => {
    const ids: string[] = [];
    if (island.content.npc) ids.push(`${island.id}-npc`);
    if (island.content.treasureChest || island.content.mathQuiz) ids.push(`${island.id}-chest`);
    if (island.content.languageSign) ids.push(`${island.id}-sign`);
    if (island.content.marineLife) ids.push(`${island.id}-marine`);
    return ids;
  }),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.floor(finiteNumber(value, fallback))));
}

function uniqueKnownStrings(value: unknown, allowed: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((candidate): candidate is string => (
    typeof candidate === 'string' && allowed.has(candidate)
  )))];
}

function uniqueStages(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const stages = value.filter((candidate): candidate is number => (
    typeof candidate === 'number'
    && Number.isInteger(candidate)
    && candidate >= 1
    && candidate <= 10
  ));
  return [...new Set(stages)].sort((left, right) => left - right);
}

function createDefaultInventory(): Inventory {
  return {
    starlightCompass: 2,
    tailwindBottle: 2,
    seaMagnet: 1,
    timeBubble: 1,
    healingApple: 1,
    shieldShell: 1,
  };
}

function normalizeInventory(value: unknown, fallback: Inventory): Inventory {
  const record = isRecord(value) ? value : {};
  const inventory = {} as Inventory;

  for (const definition of ITEM_DEFINITIONS) {
    inventory[definition.id] = clampedInteger(
      record[definition.id],
      fallback[definition.id],
      0,
      definition.maxStack,
    );
  }
  return inventory;
}

function normalizeSettings(value: unknown, fallback: GameSettings): GameSettings {
  const record = isRecord(value) ? value : {};
  const autoplay = record.autoplayCount;
  const shadowQuality = record.shadowQuality;
  const mathInputMode = record.mathInputMode;

  return {
    volume: Math.min(1, Math.max(0, finiteNumber(record.volume, fallback.volume))),
    japaneseVoice: typeof record.japaneseVoice === 'boolean'
      ? record.japaneseVoice
      : fallback.japaneseVoice,
    autoplayCount: autoplay === 0 || autoplay === 1 || autoplay === 2
      ? autoplay
      : fallback.autoplayCount,
    shadowQuality: shadowQuality === 'off' || shadowQuality === 'low' || shadowQuality === 'high'
      ? shadowQuality
      : fallback.shadowQuality,
    mathInputMode: mathInputMode === 'choices' || mathInputMode === 'keyboard'
      ? mathInputMode
      : fallback.mathInputMode,
  };
}

function normalizeWordStats(value: unknown): LearningStats {
  if (!isRecord(value)) return {};
  const result: LearningStats = {};

  for (const [id, rawStat] of Object.entries(value)) {
    if (!JAPANESE_IDS.has(id) || !isRecord(rawStat)) continue;
    result[id] = {
      correct: clampedInteger(rawStat.correct, 0, 0, 999_999),
      wrong: clampedInteger(rawStat.wrong, 0, 0, 999_999),
    };
  }
  return result;
}

function validTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return fallback;
  return value;
}

function validSubject(value: unknown, fallback: LearningSubject): LearningSubject {
  return typeof value === 'string' && SUBJECT_IDS.has(value)
    ? value as LearningSubject
    : fallback;
}

function validDifficulty(value: unknown, fallback: LearningDifficulty): LearningDifficulty {
  return typeof value === 'string' && DIFFICULTY_IDS.has(value)
    ? value as LearningDifficulty
    : fallback;
}

export function createDefaultSave(now: () => string = () => new Date().toISOString()): SaveData {
  return {
    version: SAVE_VERSION,
    highestStage: 1,
    currentStage: 1,
    completedStages: [],
    score: 0,
    highScore: 0,
    unlockedIslands: ['start-island', 'dokdo-marine-islet'],
    discoveredIslands: [],
    claimedIslandInteractions: [],
    inventory: createDefaultInventory(),
    settings: {
      volume: 0.65,
      japaneseVoice: true,
      autoplayCount: 1,
      shadowQuality: 'low',
      mathInputMode: 'choices',
    },
    learnedJapanese: [],
    wordStats: {},
    lastPlayedAt: now(),
    tutorialComplete: false,
    freeSailUnlocked: false,
    selectedSubject: 'japanese',
    selectedDifficulty: 'easy',
    courseSetupComplete: false,
    starPoints: 0,
    ownedBoatSkins: [DEFAULT_BOAT_SKIN_ID],
    ownedCharacterSkins: [DEFAULT_CHARACTER_SKIN_ID],
    equippedBoatSkin: DEFAULT_BOAT_SKIN_ID,
    equippedCharacterSkin: DEFAULT_CHARACTER_SKIN_ID,
  };
}

export function normalizeSaveData(value: unknown, now: () => string = () => new Date().toISOString()): SaveData {
  const fallback = createDefaultSave(now);
  if (!isRecord(value)) return fallback;

  const currentStage = clampedInteger(value.currentStage, fallback.currentStage, 1, 10);
  const highestStage = Math.max(
    currentStage,
    clampedInteger(value.highestStage, fallback.highestStage, 1, 10),
  );
  const score = clampedInteger(value.score, fallback.score, 0, Number.MAX_SAFE_INTEGER);
  const highScore = Math.max(
    score,
    clampedInteger(value.highScore, fallback.highScore, 0, Number.MAX_SAFE_INTEGER),
  );
  const unlockedIslands = uniqueKnownStrings(value.unlockedIslands, EXPLORABLE_ISLAND_IDS);
  if (!unlockedIslands.includes('start-island')) unlockedIslands.unshift('start-island');
  const isVersionOne = value.version === 1;
  const ownedBoatSkins = uniqueKnownStrings(value.ownedBoatSkins, COSMETIC_IDS_BY_TARGET.boat);
  const ownedCharacterSkins = uniqueKnownStrings(
    value.ownedCharacterSkins,
    COSMETIC_IDS_BY_TARGET.character,
  );
  if (!ownedBoatSkins.includes(DEFAULT_BOAT_SKIN_ID)) {
    ownedBoatSkins.unshift(DEFAULT_BOAT_SKIN_ID);
  }
  if (!ownedCharacterSkins.includes(DEFAULT_CHARACTER_SKIN_ID)) {
    ownedCharacterSkins.unshift(DEFAULT_CHARACTER_SKIN_ID);
  }
  const equippedBoatSkin = typeof value.equippedBoatSkin === 'string'
    && ownedBoatSkins.includes(value.equippedBoatSkin)
    ? value.equippedBoatSkin
    : DEFAULT_BOAT_SKIN_ID;
  const equippedCharacterSkin = typeof value.equippedCharacterSkin === 'string'
    && ownedCharacterSkins.includes(value.equippedCharacterSkin)
    ? value.equippedCharacterSkin
    : DEFAULT_CHARACTER_SKIN_ID;

  return {
    version: SAVE_VERSION,
    highestStage,
    currentStage,
    completedStages: uniqueStages(value.completedStages),
    score,
    highScore,
    unlockedIslands,
    discoveredIslands: uniqueKnownStrings(value.discoveredIslands, EXPLORABLE_ISLAND_IDS),
    claimedIslandInteractions: uniqueKnownStrings(
      value.claimedIslandInteractions,
      ISLAND_INTERACTION_IDS,
    ),
    inventory: normalizeInventory(value.inventory, fallback.inventory),
    settings: normalizeSettings(value.settings, fallback.settings),
    learnedJapanese: uniqueKnownStrings(value.learnedJapanese, JAPANESE_IDS),
    wordStats: normalizeWordStats(value.wordStats),
    lastPlayedAt: validTimestamp(value.lastPlayedAt, fallback.lastPlayedAt),
    tutorialComplete: typeof value.tutorialComplete === 'boolean'
      ? value.tutorialComplete
      : fallback.tutorialComplete,
    freeSailUnlocked: typeof value.freeSailUnlocked === 'boolean'
      ? value.freeSailUnlocked
      : fallback.freeSailUnlocked,
    selectedSubject: validSubject(value.selectedSubject, fallback.selectedSubject),
    selectedDifficulty: validDifficulty(value.selectedDifficulty, fallback.selectedDifficulty),
    courseSetupComplete: isVersionOne
      ? true
      : typeof value.courseSetupComplete === 'boolean'
        ? value.courseSetupComplete
        : fallback.courseSetupComplete,
    starPoints: isVersionOne
      ? score
      : clampedInteger(value.starPoints, fallback.starPoints, 0, Number.MAX_SAFE_INTEGER),
    ownedBoatSkins,
    ownedCharacterSkins,
    equippedBoatSkin,
    equippedCharacterSkin,
  };
}

function browserStorage(): StorageLike {
  try {
    const candidate = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (candidate) return candidate;
  } catch {
    // Browsers can deny localStorage in private or sandboxed contexts.
  }
  return new MemoryStorage();
}

export class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

export class SaveManager {
  constructor(
    private readonly storage: StorageLike = browserStorage(),
    private readonly key = SAVE_KEY,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  hasSave(): boolean {
    try {
      return this.storage.getItem(this.key) !== null;
    } catch {
      return false;
    }
  }

  load(): SaveData {
    let serialized: string | null;
    try {
      serialized = this.storage.getItem(this.key);
    } catch {
      return createDefaultSave(this.now);
    }

    if (serialized === null) return createDefaultSave(this.now);

    try {
      const normalized = normalizeSaveData(JSON.parse(serialized), this.now);
      this.write(normalized);
      return normalized;
    } catch {
      const recovered = createDefaultSave(this.now);
      this.write(recovered);
      return recovered;
    }
  }

  save(data: SaveData): SaveData {
    const normalized = normalizeSaveData({ ...data, lastPlayedAt: this.now() }, this.now);
    this.write(normalized);
    return normalized;
  }

  reset(): SaveData {
    try {
      this.storage.removeItem(this.key);
    } catch {
      // A denied storage write should not stop a fresh in-memory game.
    }
    const fresh = createDefaultSave(this.now);
    this.write(fresh);
    return fresh;
  }

  private write(data: SaveData): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(data));
    } catch {
      // Quota and privacy failures are non-fatal for gameplay.
    }
  }
}

export const SAVE_ITEM_IDS: readonly ItemId[] = ITEM_IDS;
