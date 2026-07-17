import type { CosmeticDefinition, CosmeticTarget } from '../types';

export const DEFAULT_BOAT_SKIN_ID = 'boat-coral-sail';
export const DEFAULT_CHARACTER_SKIN_ID = 'character-sky-explorer';

export const COSMETICS = [
  {
    id: DEFAULT_BOAT_SKIN_ID,
    target: 'boat',
    name: '산호 돛단배',
    description: '처음부터 함께하는 포근한 산호빛 배예요.',
    price: 0,
    icon: '⛵',
    palette: { primary: '#ff8a72', secondary: '#fff1c7', accent: '#7b4b3a' },
  },
  {
    id: 'boat-mint-wave',
    target: 'boat',
    name: '민트 파도배',
    description: '시원한 민트 파도를 닮은 배예요.',
    price: 600,
    icon: '🌊',
    palette: { primary: '#58d6bd', secondary: '#e8fff8', accent: '#246b74' },
  },
  {
    id: 'boat-sunrise',
    target: 'boat',
    name: '아침햇살배',
    description: '따뜻한 해돋이 색으로 빛나는 배예요.',
    price: 1_200,
    icon: '🌅',
    palette: { primary: '#ffb44c', secondary: '#fff4a8', accent: '#e46755' },
  },
  {
    id: 'boat-starlight',
    target: 'boat',
    name: '별빛 탐험선',
    description: '보랏빛 밤바다와 별을 담은 배예요.',
    price: 2_000,
    icon: '✨',
    palette: { primary: '#7668d8', secondary: '#dcd7ff', accent: '#ffd85e' },
  },
  {
    id: DEFAULT_CHARACTER_SKIN_ID,
    target: 'character',
    name: '하늘 탐험가',
    description: '밝은 하늘색 옷을 입은 기본 탐험가예요.',
    price: 0,
    icon: '🧢',
    palette: { primary: '#55b9e8', secondary: '#fff4dc', accent: '#ef735f' },
  },
  {
    id: 'character-leaf-scout',
    target: 'character',
    name: '잎새 탐험가',
    description: '초록 숲을 좋아하는 탐험가 옷이에요.',
    price: 500,
    icon: '🍃',
    palette: { primary: '#72bd62', secondary: '#efffce', accent: '#8a623d' },
  },
  {
    id: 'character-cherry-friend',
    target: 'character',
    name: '벚꽃 친구',
    description: '부드러운 분홍 꽃잎을 닮은 옷이에요.',
    price: 1_000,
    icon: '🌸',
    palette: { primary: '#f29cb7', secondary: '#fff0f5', accent: '#7b4f75' },
  },
  {
    id: 'character-star-captain',
    target: 'character',
    name: '별빛 선장',
    description: '반짝이는 별 배지가 달린 선장 옷이에요.',
    price: 1_800,
    icon: '⭐',
    palette: { primary: '#4e69bd', secondary: '#f4f0d7', accent: '#ffd451' },
  },
] as const satisfies readonly CosmeticDefinition[];

export const COSMETIC_BY_ID: ReadonlyMap<string, CosmeticDefinition> = new Map(
  COSMETICS.map((cosmetic) => [cosmetic.id, cosmetic]),
);

export const COSMETIC_IDS_BY_TARGET: Readonly<Record<CosmeticTarget, ReadonlySet<string>>> = {
  boat: new Set(COSMETICS.filter((cosmetic) => cosmetic.target === 'boat').map((cosmetic) => cosmetic.id)),
  character: new Set(COSMETICS.filter((cosmetic) => cosmetic.target === 'character').map((cosmetic) => cosmetic.id)),
};
