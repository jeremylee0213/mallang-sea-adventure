import type {
  CourseDefinition,
  CourseEntry,
  DifficultyDefinition,
  LearningDifficulty,
  LearningSubject,
} from '../types';

export const COURSE_DEFINITIONS = [
  {
    id: 'japanese',
    name: '일본어',
    description: '히라가나와 생활 낱말을 익혀요.',
    icon: 'あ',
    speechLanguage: 'ja-JP',
  },
  {
    id: 'english',
    name: '영어',
    description: '친숙한 영어 낱말을 소리와 함께 익혀요.',
    icon: 'A',
    speechLanguage: 'en-US',
  },
  {
    id: 'chinese',
    name: '중국어',
    description: '기초 중국어 낱말과 발음을 만나요.',
    icon: '中',
    speechLanguage: 'zh-CN',
  },
  {
    id: 'mathematics',
    name: '수학',
    description: '난이도에 맞는 계산 보물을 찾아요.',
    icon: '＋',
  },
  {
    id: 'science',
    name: '과학',
    description: '자연과 우주의 궁금증을 풀어요.',
    icon: '🔬',
  },
] as const satisfies readonly CourseDefinition[];

export const DIFFICULTY_DEFINITIONS = [
  {
    id: 'easy',
    name: '쉬움',
    description: '보기 3개 · 빠른 힌트',
    choiceCount: 3,
    movingDistractors: false,
    hintDelaySeconds: 7,
  },
  {
    id: 'normal',
    name: '보통',
    description: '보기 4개 · 천천히 움직이는 블록',
    choiceCount: 4,
    movingDistractors: true,
    hintDelaySeconds: 10,
  },
  {
    id: 'challenge',
    name: '도전',
    description: '보기 5개 · 더 넓은 학습 범위',
    choiceCount: 5,
    movingDistractors: true,
    hintDelaySeconds: 14,
  },
] as const satisfies readonly DifficultyDefinition[];

export const LEARNING_SUBJECTS: readonly LearningSubject[] = COURSE_DEFINITIONS.map(
  (course) => course.id,
);

export const LEARNING_DIFFICULTIES: readonly LearningDifficulty[] = DIFFICULTY_DEFINITIONS.map(
  (difficulty) => difficulty.id,
);

export const LANGUAGE_AND_SCIENCE_CONTENT = [
  { id: 'english-apple', subject: 'english', category: 'food', answer: 'apple', reading: '애플', korean: '사과', imageKey: 'voxel-apple', level: 1 },
  { id: 'english-water', subject: 'english', category: 'food', answer: 'water', reading: '워터', korean: '물', imageKey: 'voxel-water-cup', level: 1 },
  { id: 'english-cat', subject: 'english', category: 'animal', answer: 'cat', reading: '캣', korean: '고양이', imageKey: 'voxel-cat', level: 1 },
  { id: 'english-dog', subject: 'english', category: 'animal', answer: 'dog', reading: '도그', korean: '개', imageKey: 'voxel-dog', level: 1 },
  { id: 'english-boat', subject: 'english', category: 'travel', answer: 'boat', reading: '보트', korean: '배', imageKey: 'voxel-boat', level: 2 },
  { id: 'english-sea', subject: 'english', category: 'nature', answer: 'sea', reading: '씨', korean: '바다', imageKey: 'voxel-sea-wave', level: 2 },
  { id: 'english-book', subject: 'english', category: 'object', answer: 'book', reading: '북', korean: '책', imageKey: 'voxel-book', level: 2 },
  { id: 'english-moon', subject: 'english', category: 'nature', answer: 'moon', reading: '문', korean: '달', imageKey: 'voxel-moon', level: 3 },
  { id: 'english-sun', subject: 'english', category: 'nature', answer: 'sun', reading: '선', korean: '태양', imageKey: 'voxel-sun', level: 3 },

  { id: 'chinese-water', subject: 'chinese', category: 'food', answer: '水', reading: 'shuǐ', korean: '물', imageKey: 'voxel-water-cup', level: 1 },
  { id: 'chinese-cat', subject: 'chinese', category: 'animal', answer: '猫', reading: 'māo', korean: '고양이', imageKey: 'voxel-cat', level: 1 },
  { id: 'chinese-dog', subject: 'chinese', category: 'animal', answer: '狗', reading: 'gǒu', korean: '개', imageKey: 'voxel-dog', level: 1 },
  { id: 'chinese-book', subject: 'chinese', category: 'object', answer: '书', reading: 'shū', korean: '책', imageKey: 'voxel-book', level: 1 },
  { id: 'chinese-boat', subject: 'chinese', category: 'travel', answer: '船', reading: 'chuán', korean: '배', imageKey: 'voxel-boat', level: 2 },
  { id: 'chinese-sea', subject: 'chinese', category: 'nature', answer: '海', reading: 'hǎi', korean: '바다', imageKey: 'voxel-sea-wave', level: 2 },
  { id: 'chinese-apple', subject: 'chinese', category: 'food', answer: '苹果', reading: 'píngguǒ', korean: '사과', imageKey: 'voxel-apple', level: 2 },
  { id: 'chinese-moon', subject: 'chinese', category: 'nature', answer: '月亮', reading: 'yuèliang', korean: '달', imageKey: 'voxel-moon', level: 3 },
  { id: 'chinese-sun', subject: 'chinese', category: 'nature', answer: '太阳', reading: 'tàiyáng', korean: '태양', imageKey: 'voxel-sun', level: 3 },

  {
    id: 'science-plant-food', subject: 'science', category: 'life', answer: '광합성', reading: '광합성', korean: '식물이 햇빛을 이용해 양분을 만드는 과정',
    prompt: '식물이 햇빛을 이용해 양분을 만드는 과정은?', level: 1,
    distractors: ['증발', '소화', '응결', '발아'],
  },
  {
    id: 'science-water-freeze', subject: 'science', category: 'matter', answer: '얼음', reading: '얼음', korean: '물이 얼어서 된 고체',
    prompt: '물이 아주 차가워져 단단해지면 무엇이 될까요?', level: 1,
    distractors: ['수증기', '모래', '구름', '소금'],
  },
  {
    id: 'science-earth-home', subject: 'science', category: 'space', answer: '지구', reading: '지구', korean: '우리가 사는 행성',
    prompt: '우리가 살고 있는 행성은?', level: 1,
    distractors: ['달', '태양', '화성', '목성'],
  },
  {
    id: 'science-fish-breathe', subject: 'science', category: 'life', answer: '아가미', reading: '아가미', korean: '물고기가 물속에서 숨 쉬는 기관',
    prompt: '물고기가 물속에서 숨을 쉴 때 주로 사용하는 기관은?', level: 1,
    distractors: ['날개', '뿌리', '더듬이', '잎'],
  },
  {
    id: 'science-shadow', subject: 'science', category: 'light', answer: '빛이 가려져서', reading: '빛이 가려져서', korean: '그림자가 생기는 까닭',
    prompt: '물체 뒤에 그림자가 생기는 까닭은?', level: 2,
    distractors: ['바람이 불어서', '소리가 울려서', '물이 얼어서', '공기가 무거워서'],
  },
  {
    id: 'science-magnet', subject: 'science', category: 'force', answer: '철', reading: '철', korean: '자석에 잘 붙는 물질',
    prompt: '자석에 가장 잘 붙는 물질은?', level: 2,
    distractors: ['나무', '종이', '유리', '고무'],
  },
  {
    id: 'science-evaporation', subject: 'science', category: 'matter', answer: '증발', reading: '증발', korean: '물이 수증기로 변하는 현상',
    prompt: '물이 수증기로 변해 공기 중으로 퍼지는 현상은?', level: 2,
    distractors: ['응고', '응결', '용해', '침전'],
  },
  {
    id: 'science-moon-light', subject: 'science', category: 'space', answer: '태양빛을 반사해서', reading: '태양빛을 반사해서', korean: '달이 빛나 보이는 까닭',
    prompt: '달이 밤하늘에서 빛나 보이는 까닭은?', level: 3,
    distractors: ['달에서 불이 타서', '별이 달을 밀어서', '구름이 빛을 만들어서', '바다가 빛을 보내서'],
  },
  {
    id: 'science-food-chain', subject: 'science', category: 'ecology', answer: '먹이 사슬', reading: '먹이 사슬', korean: '생물이 먹고 먹히는 관계',
    prompt: '생물이 서로 먹고 먹히며 이어지는 관계는?', level: 3,
    distractors: ['물의 순환', '암석 순환', '계절 변화', '별자리'],
  },
] as const satisfies readonly CourseEntry[];

export const COURSE_DEFINITION_BY_ID: ReadonlyMap<LearningSubject, CourseDefinition> = new Map(
  COURSE_DEFINITIONS.map((course) => [course.id, course]),
);

export const DIFFICULTY_DEFINITION_BY_ID: ReadonlyMap<LearningDifficulty, DifficultyDefinition> = new Map(
  DIFFICULTY_DEFINITIONS.map((difficulty) => [difficulty.id, difficulty]),
);
