// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ShopManager } from '../src/core/ShopManager';
import { createDefaultSave } from '../src/core/SaveManager';
import { DEFAULT_BOAT_SKIN_ID } from '../src/data/cosmetics';

describe('ShopManager', () => {
  it('잔액이 충분하면 한 번만 차감하고 꾸미기를 소유 목록에 넣는다', () => {
    const manager = new ShopManager();
    const initial = { ...createDefaultSave(), starPoints: 1_000 };

    const purchased = manager.purchase(initial, 'boat-mint-wave');
    expect(purchased.success).toBe(true);
    expect(purchased.reason).toBe('purchased');
    expect(purchased.state.starPoints).toBe(400);
    expect(purchased.state.ownedBoatSkins).toContain('boat-mint-wave');
    expect(initial.starPoints).toBe(1_000);

    const duplicate = manager.purchase(purchased.state, 'boat-mint-wave');
    expect(duplicate.success).toBe(false);
    expect(duplicate.reason).toBe('already-owned');
    expect(duplicate.state.starPoints).toBe(400);
  });

  it('포인트가 모자라거나 소유하지 않은 꾸미기는 상태를 바꾸지 않는다', () => {
    const manager = new ShopManager();
    const initial = createDefaultSave();

    const insufficient = manager.purchase(initial, 'boat-starlight');
    expect(insufficient.success).toBe(false);
    expect(insufficient.reason).toBe('insufficient-points');
    expect(insufficient.state.starPoints).toBe(0);

    const lockedEquip = manager.equip(initial, 'character-star-captain');
    expect(lockedEquip.success).toBe(false);
    expect(lockedEquip.reason).toBe('not-owned');
    expect(lockedEquip.state.equippedBoatSkin).toBe(DEFAULT_BOAT_SKIN_ID);
  });

  it('획득 포인트는 음수로 줄지 않고 안전한 정수로 더해진다', () => {
    const manager = new ShopManager();
    const initial = createDefaultSave();

    const earned = manager.addPoints(initial, 150.9);
    const ignoredNegative = manager.addPoints(earned, -999);

    expect(earned.starPoints).toBe(150);
    expect(ignoredNegative.starPoints).toBe(150);
  });

  it('구매한 꾸미기는 장착할 수 있고 원본 상태는 변경하지 않는다', () => {
    const manager = new ShopManager();
    const initial = { ...createDefaultSave(), starPoints: 1_000 };
    const purchased = manager.purchase(initial, 'character-leaf-scout');
    const equipped = manager.equip(purchased.state, 'character-leaf-scout');

    expect(equipped.success).toBe(true);
    expect(equipped.reason).toBe('equipped');
    expect(equipped.state.equippedCharacterSkin).toBe('character-leaf-scout');
    expect(initial.equippedCharacterSkin).not.toBe('character-leaf-scout');
  });
});
