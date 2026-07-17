import {
  COSMETIC_BY_ID,
  COSMETIC_IDS_BY_TARGET,
  COSMETICS,
  DEFAULT_BOAT_SKIN_ID,
  DEFAULT_CHARACTER_SKIN_ID,
} from '../data/cosmetics';
import type {
  CosmeticDefinition,
  CosmeticShopState,
  CosmeticTarget,
  ShopTransactionResult,
} from '../types';

const MAX_POINTS = Number.MAX_SAFE_INTEGER;

function safePoints(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(MAX_POINTS, Math.max(0, Math.floor(value)));
}

function knownOwned(
  values: readonly string[],
  target: CosmeticTarget,
  requiredDefault: string,
): string[] {
  const allowed = COSMETIC_IDS_BY_TARGET[target];
  const result = [...new Set(values.filter((value) => allowed.has(value)))];
  if (!result.includes(requiredDefault)) result.unshift(requiredDefault);
  return result;
}

export function normalizeShopState(state: CosmeticShopState): CosmeticShopState {
  const ownedBoatSkins = knownOwned(state.ownedBoatSkins, 'boat', DEFAULT_BOAT_SKIN_ID);
  const ownedCharacterSkins = knownOwned(
    state.ownedCharacterSkins,
    'character',
    DEFAULT_CHARACTER_SKIN_ID,
  );
  return {
    starPoints: safePoints(state.starPoints),
    ownedBoatSkins,
    ownedCharacterSkins,
    equippedBoatSkin: ownedBoatSkins.includes(state.equippedBoatSkin)
      ? state.equippedBoatSkin
      : DEFAULT_BOAT_SKIN_ID,
    equippedCharacterSkin: ownedCharacterSkins.includes(state.equippedCharacterSkin)
      ? state.equippedCharacterSkin
      : DEFAULT_CHARACTER_SKIN_ID,
  };
}

function transaction(
  success: boolean,
  reason: ShopTransactionResult['reason'],
  cosmeticId: string,
  state: CosmeticShopState,
): ShopTransactionResult {
  return { success, reason, cosmeticId, state };
}

export class ShopManager {
  readonly catalog: readonly CosmeticDefinition[];

  constructor(catalog: readonly CosmeticDefinition[] = COSMETICS) {
    this.catalog = catalog;
  }

  addPoints(state: CosmeticShopState, points: number): CosmeticShopState {
    const normalized = normalizeShopState(state);
    return {
      ...normalized,
      starPoints: Math.min(MAX_POINTS, normalized.starPoints + safePoints(points)),
    };
  }

  purchase(state: CosmeticShopState, cosmeticId: string): ShopTransactionResult {
    const normalized = normalizeShopState(state);
    const cosmetic = this.definition(cosmeticId);
    if (!cosmetic) return transaction(false, 'unknown-cosmetic', cosmeticId, normalized);

    const owned = cosmetic.target === 'boat'
      ? normalized.ownedBoatSkins
      : normalized.ownedCharacterSkins;
    if (owned.includes(cosmeticId)) {
      return transaction(false, 'already-owned', cosmeticId, normalized);
    }
    if (normalized.starPoints < cosmetic.price) {
      return transaction(false, 'insufficient-points', cosmeticId, normalized);
    }

    const next: CosmeticShopState = {
      ...normalized,
      starPoints: normalized.starPoints - cosmetic.price,
      ownedBoatSkins: cosmetic.target === 'boat'
        ? [...normalized.ownedBoatSkins, cosmeticId]
        : [...normalized.ownedBoatSkins],
      ownedCharacterSkins: cosmetic.target === 'character'
        ? [...normalized.ownedCharacterSkins, cosmeticId]
        : [...normalized.ownedCharacterSkins],
    };
    return transaction(true, 'purchased', cosmeticId, next);
  }

  equip(state: CosmeticShopState, cosmeticId: string): ShopTransactionResult {
    const normalized = normalizeShopState(state);
    const cosmetic = this.definition(cosmeticId);
    if (!cosmetic) return transaction(false, 'unknown-cosmetic', cosmeticId, normalized);
    const owned = cosmetic.target === 'boat'
      ? normalized.ownedBoatSkins
      : normalized.ownedCharacterSkins;
    if (!owned.includes(cosmeticId)) {
      return transaction(false, 'not-owned', cosmeticId, normalized);
    }
    const next = {
      ...normalized,
      equippedBoatSkin: cosmetic.target === 'boat'
        ? cosmeticId
        : normalized.equippedBoatSkin,
      equippedCharacterSkin: cosmetic.target === 'character'
        ? cosmeticId
        : normalized.equippedCharacterSkin,
    };
    return transaction(true, 'equipped', cosmeticId, next);
  }

  private definition(cosmeticId: string): CosmeticDefinition | undefined {
    const fromCatalog = this.catalog.find((cosmetic) => cosmetic.id === cosmeticId);
    if (!fromCatalog || !COSMETIC_BY_ID.has(fromCatalog.id)) return undefined;
    return fromCatalog;
  }
}
