import type {
  GameSettings,
  IslandDefinition,
  ItemDefinition,
  ItemId,
  LearningStats,
  MathQuestion,
  QuizQuestion,
  SaveData,
} from '../types';
import type { MapFrame } from './MinimapRenderer';
import { MinimapRenderer } from './MinimapRenderer';

type Handler<T = void> = (value: T) => void;

export interface UIHandlers {
  start: Handler;
  continue: Handler;
  newGame: Handler;
  reset: Handler;
  tutorialNext: Handler;
  tutorialSkip: Handler;
  speak: Handler;
  pause: Handler;
  resume: Handler;
  menu: Handler;
  toggleMap: Handler;
  selectItem: Handler<number>;
  useItem: Handler;
  mathAnswer: Handler<number>;
  mathClose: Handler;
  languageAnswer: Handler<string>;
  languageClose: Handler;
  nextStage: Handler;
  freeSail: Handler;
  settings: Handler<Partial<GameSettings>>;
  speakLearned: Handler<string>;
}

export interface HudFrame {
  stage: number;
  score: number;
  combo: number;
  mode: 'sailing' | 'island';
  health: number;
  quest: string;
}

export interface ItemFrame {
  definitions: readonly ItemDefinition[];
  inventory: Record<ItemId, number>;
  cooldowns: Record<ItemId, number>;
  selected: number;
}

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing UI element #${id}`);
  return element as T;
}

const TYPE_LABELS: Record<QuizQuestion['type'], string> = {
  'hiragana-match': 'あ 히라가나',
  'katakana-match': 'ア 가타카나',
  'korean-to-japanese': '가 뜻 찾기',
  'picture-to-japanese': '▦ 그림 찾기',
  'audio-to-japanese': '🔊 소리 찾기',
};

const TUTORIALS = [
  { art: '⛵', title: '배를 움직여 볼까요?', copy: 'WASD 또는 방향키로 천천히 항해해요. 배에는 부드러운 관성이 있어요.', keys: ['W', 'A', 'S', 'D'] },
  { art: 'あ', title: '정답 블록을 찾아요', copy: '문제 카드와 같은 일본어 블록에 배로 닿으면 돼요. 틀려도 괜찮아요!', keys: ['R', '발음'] },
  { art: '✨', title: '아이템은 든든한 친구예요', copy: '숫자 1~4로 아이템을 고르고 Space로 사용해요. 나침반이 정답을 비춰 줘요.', keys: ['1–4', 'Space'] },
  { art: '🏝', title: '섬에도 모험이 기다려요', copy: '선착장 가까이에서 E를 누르면 내려요. 상자, 친구, 배도 E로 만나요.', keys: ['E', 'F'] },
] as const;

export class UIManager {
  private readonly screens = new Map<string, HTMLElement>();
  private readonly minimap: MinimapRenderer;
  private tutorialIndex = 0;
  private toastTimer = 0;
  private handlers: UIHandlers | null = null;
  private menuWasOpenBeforeControls = true;
  private mapOpen = false;

  constructor(islands: readonly IslandDefinition[]) {
    for (const id of [
      'menu-screen', 'tutorial-screen', 'game-hud', 'pause-screen', 'controls-screen',
      'world-map-screen', 'math-screen', 'language-screen', 'stage-clear-screen', 'celebration-screen',
    ]) {
      this.screens.set(id, required(id));
    }
    this.minimap = new MinimapRenderer(
      required<HTMLCanvasElement>('minimap'),
      required<HTMLCanvasElement>('world-map'),
      islands,
    );
  }

  bind(handlers: UIHandlers): void {
    this.handlers = handlers;
    required('start-btn').addEventListener('click', () => handlers.start());
    required('continue-btn').addEventListener('click', () => handlers.continue());
    required('new-game-btn').addEventListener('click', () => handlers.newGame());
    required('parent-reset-btn').addEventListener('click', () => {
      if (window.confirm('이 기기에 저장된 말랑바다 진행을 모두 지울까요?')) handlers.reset();
    });
    required('tutorial-next-btn').addEventListener('click', () => handlers.tutorialNext());
    required('tutorial-skip-btn').addEventListener('click', () => handlers.tutorialSkip());
    required('speak-btn').addEventListener('click', () => handlers.speak());
    required('pause-btn').addEventListener('click', () => handlers.pause());
    required('resume-btn').addEventListener('click', () => handlers.resume());
    required('menu-btn').addEventListener('click', () => handlers.menu());
    required('map-btn').addEventListener('click', () => handlers.toggleMap());
    required('world-map-close-btn').addEventListener('click', () => handlers.toggleMap());
    required('math-close-btn').addEventListener('click', () => handlers.mathClose());
    required('language-close-btn').addEventListener('click', () => handlers.languageClose());
    required('next-stage-btn').addEventListener('click', () => handlers.nextStage());
    required('free-sail-btn').addEventListener('click', () => handlers.freeSail());
    required('controls-btn').addEventListener('click', () => this.showControls(true));
    required('controls-close-btn').addEventListener('click', () => this.showControls(false));
    required('learned-btn').addEventListener('click', () => required('learned-list').classList.toggle('hidden'));
    required<HTMLInputElement>('volume-input').addEventListener('input', (event) => {
      handlers.settings({ volume: Number((event.target as HTMLInputElement).value) });
    });
    required<HTMLInputElement>('speech-toggle').addEventListener('change', (event) => {
      handlers.settings({ japaneseVoice: (event.target as HTMLInputElement).checked });
    });
    required<HTMLSelectElement>('auto-speech-select').addEventListener('change', (event) => {
      handlers.settings({ autoplayCount: Number((event.target as HTMLSelectElement).value) as 0 | 1 | 2 });
    });
  }

  showMenu(save: SaveData): void {
    this.hideAllScreens();
    this.show('menu-screen');
    required('menu-best-score').textContent = String(save.highScore);
    required('menu-best-stage').textContent = String(save.highestStage);
    const continueButton = required<HTMLButtonElement>('continue-btn');
    continueButton.disabled = !save.tutorialComplete && save.score === 0;
    continueButton.title = continueButton.disabled ? '먼저 새 모험을 시작해 주세요.' : '';
    required<HTMLInputElement>('volume-input').value = String(save.settings.volume);
    required<HTMLInputElement>('speech-toggle').checked = save.settings.japaneseVoice;
    required<HTMLSelectElement>('auto-speech-select').value = String(save.settings.autoplayCount);
  }

  showTutorial(index: number): void {
    this.hideAllScreens();
    this.show('tutorial-screen');
    this.tutorialIndex = Math.min(TUTORIALS.length - 1, Math.max(0, index));
    const step = TUTORIALS[this.tutorialIndex];
    if (!step) return;
    required('tutorial-art').textContent = step.art;
    required('tutorial-title').textContent = step.title;
    required('tutorial-copy').textContent = step.copy;
    required('tutorial-step').textContent = `${this.tutorialIndex + 1} / ${TUTORIALS.length}`;
    const keyRow = required('tutorial-keys');
    keyRow.replaceChildren(...step.keys.map((key) => {
      const element = document.createElement('kbd');
      element.textContent = key;
      return element;
    }));
    required('tutorial-next-btn').textContent = this.tutorialIndex === TUTORIALS.length - 1 ? '출항!' : '다음';
  }

  showGame(): void {
    for (const id of ['menu-screen', 'tutorial-screen', 'pause-screen', 'stage-clear-screen', 'celebration-screen']) {
      this.hide(id);
    }
    this.show('game-hud');
  }

  updateHud(frame: HudFrame): void {
    required('hud-stage').textContent = String(frame.stage);
    required('hud-score').textContent = frame.score.toLocaleString('ko-KR');
    required('hud-combo').textContent = String(frame.combo);
    required('quest-copy').textContent = frame.quest;
    const health = required('health-pill');
    health.classList.toggle('hidden', frame.mode !== 'island');
    required('health-text').textContent = String(Math.round(frame.health));
    required<HTMLElement>('health-fill').style.width = `${Math.max(0, Math.min(100, frame.health))}%`;
    required('quiz-card').classList.toggle('hidden', frame.mode !== 'sailing');
  }

  updateQuestion(question: QuizQuestion, current: number, target: number): void {
    required('quiz-type').textContent = TYPE_LABELS[question.type];
    required('quiz-progress').textContent = `${current} / ${target}`;
    required('quiz-instruction').textContent = question.prompt;
    required('quiz-prompt').textContent = question.entry.japanese;
    required('quiz-meaning').textContent = `${question.entry.reading} · ${question.entry.korean}`;
    const picture = required<HTMLElement>('picture-prompt');
    picture.classList.toggle('hidden', !question.promptImageKey);
    picture.style.backgroundImage = question.promptImageKey
      ? `url("${createVoxelIcon(question.promptImageKey)}")`
      : '';
  }

  setSpeaking(speaking: boolean): void {
    required('speak-btn').classList.toggle('speaking', speaking);
  }

  updateItems(frame: ItemFrame): void {
    const container = required('item-bar');
    const definitions = frame.definitions.slice(0, 4);
    container.replaceChildren(...definitions.map((definition, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `item-slot${index === frame.selected ? ' selected' : ''}`;
      button.setAttribute('aria-label', `${index + 1}번 ${definition.name}, ${frame.inventory[definition.id] ?? 0}개`);
      button.innerHTML = `
        <span class="item-icon" aria-hidden="true">${definition.icon}</span>
        <span class="item-name">${definition.name}</span>
        <span class="item-count">${frame.inventory[definition.id] ?? 0}</span>
        ${(frame.cooldowns[definition.id] ?? 0) > 0
          ? `<span class="cooldown">${Math.ceil(frame.cooldowns[definition.id] ?? 0)}초</span>`
          : ''}
      `;
      button.addEventListener('click', () => this.handlers?.selectItem(index));
      button.addEventListener('dblclick', () => this.handlers?.useItem());
      return button;
    }));
  }

  updateMap(frame: MapFrame): void {
    this.minimap.render(frame);
    const island = frame.currentIslandId;
    required('map-region-label').textContent = island ? '섬 탐험 중' : '말랑 동아시아 해역';
  }

  showInteraction(copy: string | null): void {
    const prompt = required('interaction-prompt');
    prompt.classList.toggle('hidden', !copy);
    if (copy) required('interaction-copy').textContent = copy;
  }

  showFeedback(correct: boolean, title: string, copy: string): void {
    const banner = required('feedback-banner');
    banner.classList.remove('hidden');
    banner.classList.toggle('wrong', !correct);
    required('feedback-icon').textContent = correct ? '★' : '↻';
    required('feedback-title').textContent = title;
    required('feedback-copy').textContent = copy;
  }

  hideFeedback(): void {
    this.hide('feedback-banner');
  }

  toast(message: string, seconds = 2.4): void {
    const toast = required('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    this.toastTimer = seconds;
  }

  tick(delta: number): void {
    if (this.toastTimer <= 0) return;
    this.toastTimer -= delta;
    if (this.toastTimer <= 0) this.hide('toast');
  }

  showPause(learnedIds: readonly string[], content: readonly QuizQuestion['entry'][], stats: LearningStats): void {
    this.show('pause-screen');
    const list = required('learned-list');
    const entries = learnedIds
      .map((id) => content.find((entry) => entry.id === id))
      .filter((entry): entry is QuizQuestion['entry'] => Boolean(entry));
    list.replaceChildren(...entries.slice(-12).map((entry) => {
      const line = document.createElement('div');
      line.className = 'learned-word';
      const accuracy = stats[entry.id];
      const attempts = (accuracy?.correct ?? 0) + (accuracy?.wrong ?? 0);
      const percent = attempts ? Math.round(((accuracy?.correct ?? 0) / attempts) * 100) : 0;
      line.innerHTML = `<span><b lang="ja">${entry.japanese}</b> — ${entry.korean}<small> · ${percent}%</small></span>`;
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `${entry.japanese} 발음 듣기`);
      button.textContent = '🔊';
      button.addEventListener('click', () => this.handlers?.speakLearned(entry.japanese));
      line.append(button);
      return line;
    }));
    if (entries.length === 0) list.textContent = '정답을 맞히면 오늘 배운 말이 여기에 모여요.';
  }

  hidePause(): void {
    this.hide('pause-screen');
  }

  toggleMap(force?: boolean): boolean {
    this.mapOpen = force ?? !this.mapOpen;
    required('world-map-screen').classList.toggle('hidden', !this.mapOpen);
    return this.mapOpen;
  }

  showMath(question: MathQuestion): void {
    this.show('math-screen');
    required('math-expression').textContent = question.prompt;
    required('math-hint').textContent = '정답을 골라 보세요. 틀려도 다시 풀 수 있어요.';
    const choices = required('math-choices');
    choices.replaceChildren(...question.choices.map((answer) => {
      const button = document.createElement('button');
      button.className = 'math-choice';
      button.type = 'button';
      button.textContent = String(answer);
      button.addEventListener('click', () => this.handlers?.mathAnswer(answer));
      return button;
    }));
  }

  showMathHint(message: string): void {
    required('math-hint').textContent = message;
  }

  hideMath(): void {
    this.hide('math-screen');
  }

  showIslandLanguage(question: QuizQuestion): void {
    this.show('language-screen');
    required('language-question-copy').textContent = `${question.entry.korean} 그림에 맞는 일본어를 골라요.`;
    const picture = required<HTMLElement>('language-picture');
    picture.style.backgroundImage = `url("${createVoxelIcon(question.entry.imageKey)}")`;
    required('language-hint').textContent = '천천히 읽어 보세요. 틀려도 다시 고를 수 있어요.';
    const choices = required('language-choices');
    choices.replaceChildren(...question.choices.map((choice) => {
      const button = document.createElement('button');
      button.className = 'language-choice';
      button.type = 'button';
      button.lang = 'ja';
      button.textContent = choice.label;
      button.addEventListener('click', () => this.handlers?.languageAnswer(choice.id));
      return button;
    }));
  }

  showLanguageHint(message: string): void {
    required('language-hint').textContent = message;
  }

  hideIslandLanguage(): void {
    this.hide('language-screen');
  }

  showStageClear(stage: number, reward: string): void {
    this.show('stage-clear-screen');
    required('clear-stage').textContent = String(stage);
    required('clear-reward').textContent = reward;
    required('next-stage-btn').textContent = stage >= 10 ? '마지막 보물 열기' : '다음 바다로';
  }

  showCelebration(): void {
    this.hide('stage-clear-screen');
    this.show('celebration-screen');
  }

  hideCelebration(): void {
    this.hide('celebration-screen');
  }

  private showControls(show: boolean): void {
    if (show) {
      this.menuWasOpenBeforeControls = !required('menu-screen').classList.contains('hidden');
      this.show('controls-screen');
    } else {
      this.hide('controls-screen');
      if (this.menuWasOpenBeforeControls) this.show('menu-screen');
    }
  }

  private hideAllScreens(): void {
    for (const element of this.screens.values()) element.classList.add('hidden');
  }

  private show(id: string): void {
    required(id).classList.remove('hidden');
  }

  private hide(id: string): void {
    required(id).classList.add('hidden');
  }
}

function createVoxelIcon(key: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.imageSmoothingEnabled = false;
  const rect = (color: string, x: number, y: number, w: number, h: number): void => {
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
  };
  const lower = key.toLowerCase();
  if (lower.includes('apple')) {
    rect('#7e4c34', 45, 15, 8, 20); rect('#53a55e', 52, 18, 18, 9);
    rect('#e85f4d', 26, 30, 44, 42); rect('#c9443c', 20, 42, 56, 25); rect('#f27b5e', 32, 27, 14, 10);
  } else if (lower.includes('fish')) {
    rect('#49b7c5', 20, 34, 51, 31); rect('#2d8fa8', 8, 28, 22, 42); rect('#ffcb54', 62, 40, 18, 19); rect('#173c4b', 64, 40, 6, 6);
  } else if (lower.includes('cat')) {
    rect('#f0a65b', 28, 27, 42, 44); rect('#df874d', 29, 15, 14, 18); rect('#df874d', 56, 15, 14, 18); rect('#173c4b', 39, 42, 6, 7); rect('#173c4b', 58, 42, 6, 7); rect('#fff4cf', 47, 52, 10, 7);
  } else if (lower.includes('dog')) {
    rect('#c98d59', 28, 28, 42, 43); rect('#8b5b43', 18, 27, 16, 32); rect('#8b5b43', 66, 27, 16, 32); rect('#173c4b', 39, 43, 6, 7); rect('#173c4b', 58, 43, 6, 7); rect('#5f3e35', 47, 53, 11, 8);
  } else if (lower.includes('water')) {
    rect('#6bd3e5', 37, 18, 23, 22); rect('#42b5d4', 27, 37, 43, 42); rect('#a9ecf2', 34, 38, 10, 24); rect('#248cad', 27, 67, 43, 12);
  } else if (lower.includes('rice') || lower.includes('food')) {
    rect('#3c8fb0', 22, 52, 52, 29); rect('#fff5d2', 28, 32, 40, 28); rect('#ffffff', 35, 26, 25, 14); rect('#266b8d', 29, 76, 39, 8);
  } else if (lower.includes('boat')) {
    rect('#b96445', 19, 58, 58, 19); rect('#7a4e36', 45, 17, 7, 45); rect('#fff0b6', 52, 22, 29, 30); rect('#51a9bc', 52, 38, 29, 7);
  } else if (lower.includes('book')) {
    rect('#e95f58', 21, 25, 27, 52); rect('#4f9fc1', 50, 25, 27, 52); rect('#fff4d0', 27, 31, 17, 38); rect('#fff4d0', 54, 31, 17, 38);
  } else {
    rect('#68c7cf', 20, 28, 56, 48); rect('#ffda67', 29, 18, 38, 18); rect('#ffffff', 30, 39, 36, 26); rect('#e56d58', 43, 45, 10, 14);
  }
  return canvas.toDataURL('image/png');
}
