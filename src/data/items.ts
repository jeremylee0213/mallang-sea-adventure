import type { ItemDefinition } from '../types';

export const ITEM_DEFINITIONS = [
  {
    id: 'starlightCompass',
    name: '별빛 나침반',
    description: '5초 동안 정답 블록을 빛기둥과 반짝임으로 알려줘요.',
    icon: '✨',
    category: 'sailing',
    cooldownSeconds: 12,
    durationSeconds: 5,
    maxStack: 9,
  },
  {
    id: 'tailwindBottle',
    name: '순풍 병',
    description: '7초 동안 배가 조금 더 빠르게 나아가요.',
    icon: '🌬️',
    category: 'sailing',
    cooldownSeconds: 14,
    durationSeconds: 7,
    maxStack: 9,
  },
  {
    id: 'seaMagnet',
    name: '바다 자석',
    description: '5초 동안 가까운 정답 블록만 배 쪽으로 당겨요.',
    icon: '🧲',
    category: 'sailing',
    cooldownSeconds: 12,
    durationSeconds: 5,
    maxStack: 9,
  },
  {
    id: 'timeBubble',
    name: '시간 방울',
    description: '5초 동안 움직이는 블록과 친구 몬스터가 천천히 움직여요.',
    icon: '🫧',
    category: 'sailing',
    cooldownSeconds: 15,
    durationSeconds: 5,
    maxStack: 9,
  },
  {
    id: 'healingApple',
    name: '회복 사과',
    description: '섬에서 체력을 부드럽게 회복해요.',
    icon: '🍎',
    category: 'exploration',
    cooldownSeconds: 4,
    durationSeconds: 0,
    maxStack: 9,
  },
  {
    id: 'shieldShell',
    name: '방패 조개',
    description: '6초 동안 귀여운 몬스터의 접촉 피해를 막아줘요.',
    icon: '🐚',
    category: 'combat',
    cooldownSeconds: 12,
    durationSeconds: 6,
    maxStack: 9,
  },
] as const satisfies readonly ItemDefinition[];

export const ITEM_DEFINITION_BY_ID: ReadonlyMap<string, ItemDefinition> = new Map(
  ITEM_DEFINITIONS.map((definition) => [definition.id, definition]),
);
