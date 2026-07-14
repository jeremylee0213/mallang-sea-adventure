// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ItemManager } from '../src/core/ItemManager';

describe('ItemManager', () => {
  it('수량이 0인 아이템 사용은 실패하며 수량이 음수가 되지 않는다', () => {
    const manager = new ItemManager({ starlightCompass: 0 });

    const firstAttempt = manager.use('starlightCompass');
    const secondAttempt = manager.use('starlightCompass');

    expect(firstAttempt.success).toBe(false);
    expect(secondAttempt.success).toBe(false);
    expect(manager.getInventory().starlightCompass).toBe(0);
  });

  it('사용 성공 시 한 개만 차감하고 쿨다운 동안 재사용하지 않는다', () => {
    const manager = new ItemManager({ tailwindBottle: 2 });

    expect(manager.use('tailwindBottle').success).toBe(true);
    expect(manager.getInventory().tailwindBottle).toBe(1);
    expect(manager.use('tailwindBottle').reason).toBe('cooldown');

    manager.tick(20);
    expect(manager.use('tailwindBottle').success).toBe(true);
    expect(manager.getInventory().tailwindBottle).toBe(0);
  });
});
