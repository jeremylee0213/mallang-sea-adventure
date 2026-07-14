// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { itemIdsForContext, itemIsUsableInContext } from '../src/core/ItemAvailability';

describe('item availability', () => {
  it('섬 슬롯에는 항해 전용 별빛 나침반을 노출하지 않는다', () => {
    expect(itemIdsForContext('island')).not.toContain('starlightCompass');
    expect(itemIsUsableInContext('starlightCompass', 'island')).toBe(false);
  });

  it('별빛 나침반은 항해 중에는 정상 사용할 수 있다', () => {
    expect(itemIdsForContext('sailing')).toContain('starlightCompass');
    expect(itemIsUsableInContext('starlightCompass', 'sailing')).toBe(true);
  });
});
