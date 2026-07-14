import * as THREE from 'three';
import {
  ItemManager,
  itemIdsForContext,
  itemIsUsableInContext,
  MathQuizGenerator,
  QuizManager,
  SaveManager,
  settleStageCompletion,
  SpeechManager,
  StageManager,
} from '../core';
import { ISLANDS, ITEM_DEFINITIONS, JAPANESE_CONTENT } from '../data';
import type {
  GameSettings,
  GameState,
  IslandDefinition,
  ItemDefinition,
  ItemId,
  MathQuestion,
  QuizQuestion,
  SaveData,
  StageConfig,
} from '../types';
import { UIManager } from '../ui/UIManager';
import { CombatManager } from '../world/CombatManager';
import type { WorldInteraction } from '../world/IslandManager';
import { OceanScene } from '../world/OceanScene';
import { AudioManager } from './AudioManager';
import { InputManager } from './InputManager';

const FIXED_STEP = 1 / 60;
type FeedbackAction = 'next-question' | 'stage-clear' | 'hide-only' | null;

interface InteractionFrame {
  kind: 'dock' | 'board' | WorldInteraction['kind'];
  targetId: string;
  distance: number;
  copy: string;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function itemDefinition(id: ItemId): ItemDefinition {
  const definition = ITEM_DEFINITIONS.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`Unknown item definition ${id}`);
  return definition;
}

export class GameEngine {
  readonly world: OceanScene;
  private readonly input = new InputManager();
  private readonly audio = new AudioManager();
  private readonly speech = new SpeechManager();
  private readonly saveManager = new SaveManager();
  private readonly ui: UIManager;
  private readonly quizManager: QuizManager;
  private readonly mathGenerator: MathQuizGenerator;
  private readonly combat: CombatManager;
  private save: SaveData;
  private stageManager: StageManager;
  private items: ItemManager;
  private state: GameState = 'MENU';
  private pausedFrom: GameState = 'SAILING';
  private currentQuestion: QuizQuestion | null = null;
  private currentMath: MathQuestion | null = null;
  private islandQuestion: QuizQuestion | null = null;
  private activeIsland: IslandDefinition | null = null;
  private activeInteraction: WorldInteraction | null = null;
  private nearby: InteractionFrame | null = null;
  private selectedSlot = 0;
  private combo = 0;
  private attemptedWrong = false;
  private feedbackTimer = 0;
  private feedbackAction: FeedbackAction = null;
  private collisionCooldown = 0;
  private dockingTimer = 0;
  private simulationMs = 0;
  private tutorialStep = 0;
  private speechRepeats = 0;
  private speechRepeatTimer = 0;
  private hudRefreshTimer = 0;
  private mapOpen = false;
  private manualAdvancing = false;
  private running = false;
  private lastFrame = 0;
  private accumulator = 0;
  private freeSailMode = false;
  private readonly qaScenario: string | null;
  private questionElapsed = 0;
  private autoHintShown = false;
  private wakeSoundTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    const params = new URLSearchParams(window.location.search);
    this.qaScenario = import.meta.env.DEV ? params.get('qa') : null;
    const seed = Number(import.meta.env.DEV ? params.get('seed') ?? 20260714 : 20260714);
    const random = seededRandom(Number.isFinite(seed) ? seed : 20260714);
    this.save = this.saveManager.load();
    this.stageManager = new StageManager(this.save.currentStage);
    this.items = new ItemManager(this.save.inventory);
    this.quizManager = new QuizManager(JAPANESE_CONTENT, random);
    this.mathGenerator = new MathQuizGenerator(random);
    this.world = new OceanScene(canvas, ISLANDS);
    this.ui = new UIManager(ISLANDS);
    this.combat = new CombatManager(this.world.player, this.world.monsters, this.audio);
    this.bindUI();
    this.applySettings();
    this.positionAtStart();
    this.ui.showMenu(this.save);
    this.installWindowHooks();
    window.addEventListener('resize', this.world.resize);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    requestAnimationFrame(this.onAnimationFrame);
  }

  destroy(): void {
    this.running = false;
    this.input.destroy();
    this.speech.cancel();
    this.world.dispose();
    window.removeEventListener('resize', this.world.resize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  advanceTime(milliseconds: number): void {
    const safeMilliseconds = Math.min(60_000, Math.max(0, milliseconds));
    const steps = Math.max(1, Math.ceil(safeMilliseconds / (FIXED_STEP * 1000)));
    const delta = safeMilliseconds <= 0 ? FIXED_STEP : safeMilliseconds / 1000 / steps;
    this.manualAdvancing = true;
    for (let index = 0; index < steps; index += 1) this.update(delta);
    this.world.render();
    this.manualAdvancing = false;
    this.lastFrame = performance.now();
  }

  renderGameToText(): string {
    const boat = this.world.boat.getState();
    const player = this.state === 'ISLAND_EXPLORATION' || this.state === 'QUIZ'
      ? this.world.player.getState()
      : null;
    const progress = this.stageManager.getProgress();
    const itemState = this.items.getState();
    return JSON.stringify({
      version: 1,
      coordinateSystem: 'x=east, y=up, z=south; heading 0 points +z',
      simulationMs: Math.round(this.simulationMs),
      mode: this.state,
      overlay: this.mapOpen ? 'WORLD_MAP' : this.currentMath ? 'MATH_QUIZ' : this.islandQuestion ? 'LANGUAGE_QUIZ' : null,
      stage: {
        id: this.stageManager.stage.id,
        correct: progress.correctAnswers,
        target: progress.targetAnswers,
        remaining: Math.max(0, progress.targetAnswers - progress.correctAnswers),
        freeSail: this.freeSailMode,
      },
      score: this.save.score,
      combo: this.combo,
      completedStages: this.save.completedStages,
      discoveredIslands: this.save.discoveredIslands,
      usedInteractions: this.world.islands.getUsedInteractionIds(),
      boat,
      player,
      activeIsland: this.activeIsland?.id ?? null,
      quiz: this.currentQuestion ? {
        type: this.currentQuestion.type,
        prompt: this.currentQuestion.prompt,
        japanese: this.currentQuestion.entry.japanese,
        korean: this.currentQuestion.entry.korean,
        feedbackPending: this.feedbackAction,
      } : null,
      blocks: this.world.choices.getStates(),
      interaction: this.nearby ? {
        kind: this.nearby.kind,
        targetId: this.nearby.targetId,
        distance: Number(this.nearby.distance.toFixed(2)),
      } : null,
      items: Object.keys(itemState.inventory).map((id) => ({
        id,
        count: itemState.inventory[id as ItemId],
        cooldown: Number(itemState.cooldowns[id as ItemId].toFixed(2)),
        active: Number(itemState.activeEffects[id as ItemId].toFixed(2)),
      })),
      mathQuiz: this.currentMath ? {
        kind: this.currentMath.kind,
        prompt: this.currentMath.prompt,
        choices: this.currentMath.choices,
        answer: this.currentMath.answer,
      } : null,
      islandLanguageQuiz: this.islandQuestion ? {
        prompt: this.islandQuestion.prompt,
        choices: this.islandQuestion.choices.map((choice) => ({ id: choice.id, label: choice.label })),
        answer: this.islandQuestion.entry.japanese,
      } : null,
      enemies: this.world.monsters.getStates(),
    });
  }

  private readonly onAnimationFrame = (time: number): void => {
    if (!this.running) return;
    requestAnimationFrame(this.onAnimationFrame);
    if (this.manualAdvancing || document.hidden) return;
    const frameDelta = Math.min(0.05, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = time;
    this.accumulator += frameDelta;
    let safety = 0;
    while (this.accumulator >= FIXED_STEP && safety < 5) {
      this.update(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
      safety += 1;
    }
    this.world.render();
  };

  private update(delta: number): void {
    this.simulationMs += delta * 1000;
    this.world.updateEnvironment(delta);
    this.ui.tick(delta);
    this.updateSpeech(delta);
    this.handleGlobalInput();
    this.feedbackTimer = Math.max(0, this.feedbackTimer - delta);
    this.collisionCooldown = Math.max(0, this.collisionCooldown - delta);
    if (this.feedbackTimer <= 0 && this.feedbackAction) this.finishFeedback();

    if (!this.mapOpen) {
      switch (this.state) {
        case 'SAILING':
          this.updateSailing(delta);
          break;
        case 'DOCKING':
          this.updateDocking(delta);
          break;
        case 'ISLAND_EXPLORATION':
          this.updateIsland(delta);
          break;
        case 'MENU':
        case 'TUTORIAL':
        case 'QUIZ':
        case 'PAUSED':
        case 'STAGE_CLEAR':
          break;
      }
    }
    this.hudRefreshTimer -= delta;
    if (this.hudRefreshTimer <= 0) {
      this.hudRefreshTimer = 0.1;
      this.refreshHUD();
    }
    this.input.endFrame();
  }

  private updateSailing(delta: number): void {
    const itemState = this.items.tick(delta);
    const tailwind = itemState.activeEffects.tailwindBottle > 0 ? 1.3 : 1;
    this.world.boat.update(delta, this.input, this.world.collisions, tailwind);
    this.world.choices.update(delta, {
      slowMultiplier: itemState.activeEffects.timeBubble > 0 ? 0.35 : 1,
      magnetTarget: this.world.boat.group.position,
      magnetActive: itemState.activeEffects.seaMagnet > 0,
    });
    this.world.cameraController.update(delta, this.world.boat.group, this.world.boat.heading);
    this.questionElapsed += delta;
    if (
      this.stageManager.stage.autoHint
      && !this.autoHintShown
      && this.questionElapsed >= 8
      && !this.feedbackAction
    ) {
      this.autoHintShown = true;
      this.world.choices.highlightCorrect(3.5);
      this.ui.toast('반짝 힌트! 빛나는 블록을 찾아봐요.');
    }
    this.wakeSoundTimer -= delta;
    if (Math.abs(this.world.boat.speed) > 2 && this.wakeSoundTimer <= 0) {
      this.audio.play('splash');
      this.wakeSoundTimer = 1.35;
    }
    this.updateDockPrompt();
    if (this.input.consume('Space')) this.useSelectedItem();
    this.consumeSlotKeys();

    if (this.collisionCooldown <= 0 && this.feedbackAction !== 'next-question' && this.feedbackAction !== 'stage-clear') {
      const collided = this.world.choices.checkCollision(this.world.boat.group.position);
      if (collided) this.handleChoiceCollision(collided.id, collided.isCorrect);
    }
    if (this.input.consume('KeyE') && this.nearby?.kind === 'dock') this.beginDocking(this.nearby.targetId);
  }

  private updateDocking(delta: number): void {
    this.items.tick(delta);
    this.dockingTimer -= delta;
    const island = this.activeIsland;
    if (!island) {
      this.world.cameraController.update(delta, this.world.boat.group, this.world.boat.heading);
      if (this.dockingTimer > 0) return;
      this.state = 'SAILING';
      this.ui.showGame();
      this.ui.toast('다시 배에 올랐어요. 출항!');
      return;
    }
    this.world.boat.group.position.x = THREE.MathUtils.damp(
      this.world.boat.group.position.x, island.dock.x, 3.5, delta,
    );
    this.world.boat.group.position.z = THREE.MathUtils.damp(
      this.world.boat.group.position.z, island.dock.z, 3.5, delta,
    );
    this.world.boat.heading = island.dock.heading;
    this.world.boat.speed = 0;
    this.world.cameraController.update(delta, this.world.boat.group, this.world.boat.heading);
    if (this.dockingTimer > 0) return;
    this.world.player.spawn(island);
    this.world.cameraController.setMode('player', true, this.world.player.group);
    this.world.monsters.spawnForIsland(island, this.stageManager.stage.monsterCount);
    this.state = 'ISLAND_EXPLORATION';
    this.selectedSlot = 0;
    this.nearby = null;
    this.ui.showGame();
    this.ui.toast(`${island.name}에 안전하게 내렸어요!`);
  }

  private updateIsland(delta: number): void {
    const island = this.activeIsland;
    if (!island) {
      this.returnToBoat();
      return;
    }
    const itemState = this.items.tick(delta);
    this.world.player.update(delta, this.input, island, this.world.collisions);
    this.world.cameraController.update(delta, this.world.player.group, this.world.player.heading);
    const damage = this.world.monsters.update(
      delta,
      this.world.player.group.position,
      itemState.activeEffects.timeBubble > 0 ? 0.35 : 1,
    );
    if (damage > 0) {
      const returned = this.world.player.damage(damage);
      if (returned) {
        this.world.player.health = this.world.player.maxHealth;
        this.world.player.spawn(island);
        this.world.monsters.resetContactCooldowns();
        this.ui.toast('괜찮아요! 선착장에서 다시 시작해요.');
      } else {
        this.ui.toast(this.world.player.shieldRemaining > 0 ? '방패 조개가 지켜 줬어요!' : '살짝 부딪혔어요. 천천히 다시 해봐요!');
      }
    }
    const attack = this.combat.update(delta, this.input);
    if (attack?.defeated) {
      this.addScore(30);
      this.ui.toast('별빛으로 변해 보물을 남겼어요! +30');
    }
    this.updateIslandPrompt();
    this.consumeSlotKeys();
    if (this.input.consume('KeyE') && this.nearby) this.activateIslandInteraction();
  }

  private handleGlobalInput(): void {
    if (this.input.consume('KeyR') && this.currentQuestion && this.state !== 'MENU') this.queueSpeech(1);
    if (this.input.consume('KeyM') && ['SAILING', 'ISLAND_EXPLORATION'].includes(this.state)) {
      this.mapOpen = this.ui.toggleMap();
    }
    if (this.input.consume('Escape')) {
      if (this.mapOpen) {
        this.mapOpen = this.ui.toggleMap(false);
      } else if (this.state === 'PAUSED') {
        this.resume();
      } else if (['SAILING', 'ISLAND_EXPLORATION'].includes(this.state)) {
        this.pause();
      }
    }
  }

  private handleChoiceCollision(choiceId: string, correct: boolean): void {
    if (!this.currentQuestion) return;
    this.collisionCooldown = 0.9;
    if (!correct) {
      this.attemptedWrong = true;
      this.combo = 0;
      this.recordLearning(this.currentQuestion.entry.id, false);
      this.world.boat.triggerFriendlyRock();
      this.world.choices.remove(choiceId);
      this.audio.play('wrong');
      this.ui.showFeedback(false, '다시 찾아보자!', '괜찮아요. 다른 블록을 천천히 살펴봐요.');
      this.feedbackTimer = 1.15;
      this.feedbackAction = 'hide-only';
      this.persist();
      this.refreshHUD();
      return;
    }

    const question = this.currentQuestion;
    this.world.choices.clear();
    this.world.particles.burst(this.world.boat.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 20);
    this.audio.play('correct');
    this.combo += 1;
    let points = 100 + (this.attemptedWrong ? 0 : 50);
    if (this.combo % 3 === 0) points += 100;
    this.addScore(points);
    this.recordLearning(question.entry.id, true);
    const progress = this.stageManager.recordCorrect();
    if (progress.justCompleted && this.freeSailMode) {
      this.stageManager.setStage(this.stageManager.stage);
    }
    this.ui.showFeedback(
      true,
      this.combo >= 3 ? `${this.combo}연속! 정말 멋져요!` : '정답이에요!',
      `${question.entry.japanese} (${question.entry.reading}) — ${question.entry.korean} · +${points}`,
    );
    this.queueSpeech(1);
    this.feedbackTimer = 1.05;
    this.feedbackAction = progress.justCompleted && !this.freeSailMode
      ? 'stage-clear'
      : 'next-question';
    this.persist();
    this.refreshHUD();
  }

  private finishFeedback(): void {
    const action = this.feedbackAction;
    this.feedbackAction = null;
    this.ui.hideFeedback();
    if (action === 'next-question') this.createQuestion();
    if (action === 'stage-clear') this.completeStage();
  }

  private createQuestion(): void {
    this.currentQuestion = this.quizManager.nextQuestion(this.stageManager.stage, this.save.wordStats);
    this.attemptedWrong = false;
    this.questionElapsed = 0;
    this.autoHintShown = false;
    this.world.choices.setQuestion(
      this.currentQuestion,
      this.world.boat.group.position,
      this.stageManager.stage.movingDistractors,
      this.stageManager.correctAnswers + this.stageManager.stage.id,
    );
    if (this.qaScenario === 'stage10') {
      this.world.choices.placeCorrectNear(this.world.boat.group.position, this.world.boat.heading, 7);
    }
    const progress = this.stageManager.getProgress();
    this.ui.updateQuestion(this.currentQuestion, progress.correctAnswers, progress.targetAnswers);
    this.queueSpeech(this.save.settings.autoplayCount);
  }

  private completeStage(): void {
    const stage = this.stageManager.stage;
    const settlement = settleStageCompletion(this.save, stage.id);
    this.save.completedStages = settlement.completedStages;
    this.save.currentStage = settlement.currentStage;
    this.save.highestStage = settlement.highestStage;
    this.save.freeSailUnlocked = settlement.freeSailUnlocked;
    if (settlement.firstCompletion) {
      this.addScore(500);
      this.items.add(stage.reward.itemId, stage.reward.itemCount);
      if (stage.reward.unlockIslandId && !this.save.unlockedIslands.includes(stage.reward.unlockIslandId)) {
        this.save.unlockedIslands.push(stage.reward.unlockIslandId);
      }
    }
    if (stage.id === 10) {
      this.freeSailMode = true;
    }
    this.persist();
    this.state = 'STAGE_CLEAR';
    this.speech.cancel();
    this.audio.play('stage');
    this.world.particles.burst(this.world.boat.group.position.clone().add(new THREE.Vector3(0, 2, 0)), 34);
    this.ui.showStageClear(
      stage.id,
      settlement.firstCompletion
        ? `${stage.reward.message} · +500`
        : '복습 완료! 이 단계의 보상은 이미 받았어요.',
    );
  }

  private nextStage(): void {
    const completed = this.stageManager.stage.id;
    if (completed >= 10) {
      this.ui.showCelebration();
      return;
    }
    this.save.currentStage = completed + 1;
    this.save.highestStage = Math.max(this.save.highestStage, this.save.currentStage);
    this.stageManager.setStage(this.save.currentStage);
    this.world.islands.setStage(this.save.currentStage);
    this.currentQuestion = null;
    this.state = 'SAILING';
    this.ui.showGame();
    this.createQuestion();
    this.persist();
  }

  private beginDocking(islandId: string): void {
    const island = ISLANDS.find((candidate) => candidate.id === islandId);
    if (!island || !island.explorable || !this.isIslandUnlocked(island)) return;
    this.activeIsland = island;
    this.state = 'DOCKING';
    this.dockingTimer = 0.72;
    this.world.choices.group.visible = false;
    if (!this.save.unlockedIslands.includes(island.id)) this.save.unlockedIslands.push(island.id);
    if (!this.save.discoveredIslands.includes(island.id)) {
      this.save.discoveredIslands.push(island.id);
      this.addScore(200);
      this.audio.play('discover');
      this.ui.toast(`${island.name} 발견! +200`);
    }
    this.persist();
  }

  private returnToBoat(): void {
    this.state = 'DOCKING';
    this.dockingTimer = 0.46;
    this.world.player.hide();
    this.world.monsters.clear();
    this.world.choices.group.visible = true;
    this.activeIsland = null;
    this.nearby = null;
    this.world.cameraController.setMode('boat', true, this.world.boat.group);
  }

  private updateDockPrompt(): void {
    const nearest = this.world.collisions.nearestDock(this.world.boat.group.position, ISLANDS);
    if (!nearest || nearest.distance > 10 || !this.isIslandUnlocked(nearest.island)) {
      this.nearby = null;
      this.ui.showInteraction(null);
      return;
    }
    this.nearby = {
      kind: 'dock',
      targetId: nearest.island.id,
      distance: nearest.distance,
      copy: `${nearest.island.name}에 내리기`,
    };
    this.ui.showInteraction(this.nearby.copy);
  }

  private updateIslandPrompt(): void {
    const island = this.activeIsland;
    if (!island) return;
    const interaction = this.world.islands.findNearestInteraction(this.world.player.group.position);
    if (interaction) {
      const copyByKind: Record<WorldInteraction['kind'], string> = {
        npc: '섬 친구와 이야기하기',
        chest: interaction.interaction.used ? '열린 상자 살펴보기' : '보물상자 열기',
        'language-sign': '그림 일본어 퀴즈 풀기',
        'marine-life': '평화로운 해양생물 관찰하기',
      };
      this.nearby = {
        kind: interaction.interaction.kind,
        targetId: interaction.interaction.id,
        distance: interaction.distance,
        copy: copyByKind[interaction.interaction.kind],
      };
      this.ui.showInteraction(this.nearby.copy);
      return;
    }
    const distanceToDock = Math.hypot(
      this.world.player.group.position.x - island.dock.x,
      this.world.player.group.position.z - island.dock.z,
    );
    if (distanceToDock <= 10.5) {
      this.nearby = { kind: 'board', targetId: island.id, distance: distanceToDock, copy: '배에 다시 타기' };
      this.ui.showInteraction(this.nearby.copy);
    } else {
      this.nearby = null;
      this.ui.showInteraction(null);
    }
  }

  private activateIslandInteraction(): void {
    if (!this.nearby) return;
    if (this.nearby.kind === 'board') {
      this.returnToBoat();
      return;
    }
    const interaction = this.world.islands.interactions.find((candidate) => candidate.id === this.nearby?.targetId);
    if (!interaction) return;
    this.activeInteraction = interaction;
    if (interaction.kind === 'npc') {
      if (!interaction.used) {
        this.markInteractionUsed(interaction);
        this.items.add('healingApple', 1);
        this.audio.play('item');
        this.ui.toast(interaction.islandId === 'start-island'
          ? '모모 선장이 반짝 나무칼과 회복 사과를 주었어요!'
          : '섬 친구: 서두르지 말고 천천히 둘러봐요!');
        this.persist();
      } else {
        this.ui.toast('모모 선장: 틀려도 괜찮아. 다시 찾으면 돼!');
      }
      return;
    }
    if (interaction.kind === 'marine-life') {
      this.markInteractionUsed(interaction);
      this.ui.toast('독도 해양 관찰섬은 한국 지역의 평화로운 배움터예요. 물고기가 반짝여요!');
      this.world.particles.burst(interaction.object.getWorldPosition(new THREE.Vector3()), 12, 0x74dbe0);
      this.persist();
      return;
    }
    if (interaction.kind === 'language-sign') {
      this.openIslandLanguageQuiz();
      return;
    }
    if (interaction.kind === 'chest') {
      if (interaction.used) {
        this.ui.toast('이미 연 상자예요. 반짝이는 추억이 남아 있어요!');
        return;
      }
      const island = this.activeIsland;
      if (island?.content.mathQuiz) {
        this.currentMath = this.mathGenerator.generate(this.stageManager.stage);
        this.state = 'QUIZ';
        this.ui.showMath(this.currentMath);
      } else {
        this.markInteractionUsed(interaction);
        const reward: ItemId = island?.id === 'dokdo-marine-islet' ? 'seaMagnet' : 'starlightCompass';
        this.items.add(reward, 1);
        this.addScore(150);
        this.audio.play('chest');
        this.world.particles.burst(interaction.object.getWorldPosition(new THREE.Vector3()), 18);
        this.ui.toast(`${itemDefinition(reward).name} 1개와 별 점수 +150!`);
        this.persist();
      }
    }
  }

  private handleMathAnswer(answer: number): void {
    if (!this.currentMath) return;
    if (answer !== this.currentMath.answer) {
      this.audio.play('wrong');
      this.ui.showMathHint(`다시 해볼까요? ${this.currentMath.hint}`);
      return;
    }
    if (this.activeInteraction) this.markInteractionUsed(this.activeInteraction);
    this.addScore(150);
    this.items.add('healingApple', 1);
    this.audio.play('chest');
    if (this.activeInteraction) {
      this.world.particles.burst(this.activeInteraction.object.getWorldPosition(new THREE.Vector3()), 20);
    }
    this.currentMath = null;
    this.state = 'ISLAND_EXPLORATION';
    this.ui.hideMath();
    this.ui.toast('정답! 보물상자가 열렸어요. +150 · 회복 사과 +1');
    this.persist();
  }

  private openIslandLanguageQuiz(): void {
    const pictureIds = ['word-rice', 'word-water', 'word-fish', 'word-cat', 'word-dog', 'word-apple'];
    const base = this.stageManager.stage;
    const stage: StageConfig = {
      ...base,
      contentIds: pictureIds,
      questionTypes: ['picture-to-japanese'],
      distractorCount: 3,
    };
    this.islandQuestion = this.quizManager.nextQuestion(stage, this.save.wordStats);
    this.state = 'QUIZ';
    this.ui.showIslandLanguage(this.islandQuestion);
    this.queueSpeech(1, this.islandQuestion.entry.japanese);
  }

  private handleLanguageAnswer(choiceId: string): void {
    if (!this.islandQuestion) return;
    const choice = this.islandQuestion.choices.find((candidate) => candidate.id === choiceId);
    if (!choice?.isCorrect) {
      this.recordLearning(this.islandQuestion.entry.id, false);
      this.audio.play('wrong');
      this.ui.showLanguageHint('괜찮아요! 그림과 글자를 한 번 더 살펴봐요.');
      return;
    }
    const entry = this.islandQuestion.entry;
    const firstCompletion = Boolean(this.activeInteraction && !this.activeInteraction.used);
    this.recordLearning(entry.id, true);
    if (firstCompletion) this.addScore(100);
    this.audio.play('correct');
    this.queueSpeech(1, entry.japanese);
    if (this.activeInteraction) this.markInteractionUsed(this.activeInteraction);
    this.islandQuestion = null;
    this.state = 'ISLAND_EXPLORATION';
    this.ui.hideIslandLanguage();
    this.ui.showFeedback(
      true,
      '섬 퀴즈 정답!',
      firstCompletion
        ? `${entry.japanese} — ${entry.korean} · +100`
        : `${entry.japanese} — ${entry.korean} · 즐거운 복습 완료!`,
    );
    this.feedbackTimer = 1.2;
    this.feedbackAction = 'hide-only';
    this.persist();
  }

  private useSelectedItem(): void {
    const ids = this.getSlotIds();
    const itemId = ids[this.selectedSlot];
    if (!itemId) return;
    const context = this.activeIsland ? 'island' : 'sailing';
    if (!itemIsUsableInContext(itemId, context)) {
      this.ui.toast(`${itemDefinition(itemId).name}은 항해 중에 사용할 수 있어요!`);
      return;
    }
    const result = this.items.use(itemId);
    if (!result.success) {
      const message = result.reason === 'empty'
        ? `${itemDefinition(itemId).name}이 없어요. 상자와 보상에서 찾을 수 있어요!`
        : '조금만 기다리면 다시 사용할 수 있어요!';
      this.ui.toast(message);
      return;
    }
    const focus = this.state === 'ISLAND_EXPLORATION' ? this.world.player.group : this.world.boat.group;
    this.audio.play('item');
    this.world.particles.burst(focus.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 12);
    if (itemId === 'starlightCompass' && this.state === 'SAILING') this.world.choices.highlightCorrect(5);
    if (itemId === 'healingApple') this.world.player.heal(45);
    if (itemId === 'shieldShell') this.world.player.activateShield(6);
    this.ui.toast(`${itemDefinition(itemId).name} 사용! ${itemDefinition(itemId).description}`);
    this.persist();
    this.refreshHUD();
  }

  private consumeSlotKeys(): void {
    const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
    keys.forEach((key, index) => {
      if (this.input.consume(key)) {
        this.selectedSlot = index;
        this.refreshHUD();
      }
    });
  }

  private refreshHUD(): void {
    if (['MENU', 'TUTORIAL'].includes(this.state)) return;
    const islandMode = ['ISLAND_EXPLORATION', 'QUIZ'].includes(this.state) && Boolean(this.activeIsland);
    const progress = this.stageManager.getProgress();
    this.ui.updateHud({
      stage: this.stageManager.stage.id,
      score: this.save.score,
      combo: this.combo,
      mode: islandMode ? 'island' : 'sailing',
      health: this.world.player.health,
      quest: islandMode
        ? (this.activeIsland?.peaceful ? '섬의 친구와 보물을 찾아요' : '상자와 별빛 친구를 만나봐요')
        : this.freeSailMode
          ? '자유 항해하며 배운 말을 복습해요'
          : `정답 ${Math.max(0, progress.targetAnswers - progress.correctAnswers)}개를 더 찾아요`,
    });
    const itemState = this.items.getState();
    this.ui.updateItems({
      definitions: this.getSlotIds().map(itemDefinition),
      inventory: itemState.inventory,
      cooldowns: itemState.cooldowns,
      selected: this.selectedSlot,
    });
    const focus = islandMode ? this.world.player.getState() : this.world.boat.getState();
    const compass = itemState.activeEffects.starlightCompass > 0
      ? this.world.choices.getCorrectPosition()
      : null;
    this.ui.updateMap({
      x: focus.x,
      z: focus.z,
      heading: focus.heading,
      mode: islandMode ? 'player' : 'boat',
      currentIslandId: this.activeIsland?.id ?? null,
      stage: this.save.currentStage,
      discovered: this.save.discoveredIslands,
      compassTarget: compass ? { x: compass.x, z: compass.z } : null,
    });
  }

  private queueSpeech(count: number, text = this.currentQuestion?.entry.japanese): void {
    this.speechRepeats = 0;
    this.speech.cancel();
    this.ui.setSpeaking(false);
    if (!text || !this.save.settings.japaneseVoice || count <= 0) return;
    this.speechRepeats = Math.min(2, Math.max(0, Math.floor(count)));
    this.playNextSpeech(text);
  }

  private playNextSpeech(text: string): void {
    if (this.speechRepeats <= 0) return;
    this.speechRepeats -= 1;
    this.speech.speak(text, {
      volume: this.save.settings.volume,
      onSpeakingChange: (speaking) => {
        this.ui.setSpeaking(speaking);
        if (!speaking && this.speechRepeats > 0) this.speechRepeatTimer = 0.2;
      },
    });
  }

  private updateSpeech(delta: number): void {
    if (this.speechRepeatTimer <= 0) return;
    this.speechRepeatTimer -= delta;
    if (this.speechRepeatTimer <= 0) {
      const text = this.islandQuestion?.entry.japanese ?? this.currentQuestion?.entry.japanese;
      if (text) this.playNextSpeech(text);
    }
  }

  private pause(): void {
    if (!['SAILING', 'ISLAND_EXPLORATION'].includes(this.state)) return;
    this.pausedFrom = this.state;
    this.state = 'PAUSED';
    this.speech.cancel();
    this.audio.suspend();
    this.ui.showPause(this.save.learnedJapanese, JAPANESE_CONTENT, this.save.wordStats);
  }

  private resume(): void {
    if (this.state !== 'PAUSED') return;
    this.state = this.pausedFrom;
    this.ui.hidePause();
    this.audio.resume();
  }

  private beginFromMenu(forceFresh = false): void {
    void this.audio.unlock();
    if (forceFresh) this.resetRuntime(this.saveManager.reset());
    else this.resetRuntime(this.saveManager.load());
    if (!this.save.tutorialComplete) {
      this.state = 'TUTORIAL';
      this.tutorialStep = 0;
      this.ui.showTutorial(0);
      return;
    }
    this.beginSailing();
  }

  private beginSailing(): void {
    this.state = 'SAILING';
    this.world.player.hide();
    this.world.choices.group.visible = true;
    this.world.cameraController.setMode('boat', true, this.world.boat.group);
    this.ui.showGame();
    if (!this.currentQuestion) this.createQuestion();
    this.refreshHUD();
  }

  private advanceTutorial(): void {
    if (this.tutorialStep < 3) {
      this.tutorialStep += 1;
      this.ui.showTutorial(this.tutorialStep);
      return;
    }
    this.finishTutorial();
  }

  private finishTutorial(): void {
    this.save.tutorialComplete = true;
    this.persist();
    this.beginSailing();
  }

  private resetRuntime(save: SaveData): void {
    this.save = save;
    this.stageManager = new StageManager(save.currentStage);
    this.items = new ItemManager(save.inventory);
    this.combo = 0;
    this.currentQuestion = null;
    this.currentMath = null;
    this.islandQuestion = null;
    this.activeIsland = null;
    this.activeInteraction = null;
    this.nearby = null;
    this.freeSailMode = save.freeSailUnlocked;
    this.world.choices.clear();
    this.world.monsters.clear();
    this.world.islands.setUsedInteractionIds(save.claimedIslandInteractions);
    this.world.islands.setStage(save.currentStage);
    this.positionAtStart();
    this.applySettings();
  }

  private positionAtStart(): void {
    if (this.qaScenario === 'island') {
      this.world.boat.teleport(45, 78, 0);
      this.world.cameraController?.setMode('boat', true, this.world.boat.group);
      return;
    }
    if (this.qaScenario === 'sakura') {
      this.world.boat.teleport(108, -75, Math.PI / 2);
      this.world.cameraController?.setMode('boat', true, this.world.boat.group);
      return;
    }
    const startIsland = ISLANDS.find((island) => island.id === 'start-island');
    const heading = startIsland?.dock.heading ?? Math.PI / 2;
    this.world.boat.teleport(-68, 45, heading);
    this.world.cameraController?.setMode('boat', true, this.world.boat.group);
  }

  private addScore(points: number): void {
    this.save.score = Math.max(0, this.save.score + Math.max(0, Math.floor(points)));
    this.save.highScore = Math.max(this.save.highScore, this.save.score);
  }

  private recordLearning(entryId: string, correct: boolean): void {
    const stat = this.save.wordStats[entryId] ?? { correct: 0, wrong: 0 };
    this.save.wordStats[entryId] = {
      correct: stat.correct + (correct ? 1 : 0),
      wrong: stat.wrong + (correct ? 0 : 1),
    };
    if (!this.save.learnedJapanese.includes(entryId)) this.save.learnedJapanese.push(entryId);
  }

  private persist(): void {
    this.save.inventory = this.items.getInventory();
    this.save.claimedIslandInteractions = this.world.islands.getUsedInteractionIds();
    this.save = this.saveManager.save(this.save);
  }

  private isIslandUnlocked(island: IslandDefinition): boolean {
    return island.explorable && (
      island.id === 'start-island'
      || island.id === 'dokdo-marine-islet'
      || (island.unlockStage !== null && this.stageManager.stage.id >= island.unlockStage)
      || this.save.unlockedIslands.includes(island.id)
    );
  }

  private getSlotIds(): readonly ItemId[] {
    return itemIdsForContext(this.activeIsland ? 'island' : 'sailing');
  }

  private markInteractionUsed(interaction: WorldInteraction): void {
    interaction.used = true;
    if (!this.save.claimedIslandInteractions.includes(interaction.id)) {
      this.save.claimedIslandInteractions.push(interaction.id);
    }
  }

  private applySettings(): void {
    this.audio.setVolume(this.save.settings.volume);
    this.world.setShadowQuality(this.save.settings.shadowQuality);
  }

  private updateSettings(settings: Partial<GameSettings>): void {
    this.save.settings = { ...this.save.settings, ...settings };
    this.applySettings();
    this.persist();
  }

  private bindUI(): void {
    this.ui.bind({
      start: () => this.beginFromMenu(false),
      continue: () => this.beginFromMenu(false),
      newGame: () => this.beginFromMenu(true),
      reset: () => {
        this.resetRuntime(this.saveManager.reset());
        this.state = 'MENU';
        this.ui.showMenu(this.save);
        this.ui.toast('저장된 진행을 안전하게 초기화했어요.');
      },
      tutorialNext: () => this.advanceTutorial(),
      tutorialSkip: () => this.finishTutorial(),
      speak: () => this.queueSpeech(1),
      pause: () => this.pause(),
      resume: () => this.resume(),
      menu: () => {
        this.persist();
        this.state = 'MENU';
        this.speech.cancel();
        this.ui.showMenu(this.save);
      },
      toggleMap: () => { this.mapOpen = this.ui.toggleMap(); },
      selectItem: (slot) => { this.selectedSlot = slot; this.refreshHUD(); },
      useItem: () => this.useSelectedItem(),
      mathAnswer: (answer) => this.handleMathAnswer(answer),
      mathClose: () => {
        this.currentMath = null;
        this.state = 'ISLAND_EXPLORATION';
        this.ui.hideMath();
      },
      languageAnswer: (id) => this.handleLanguageAnswer(id),
      languageClose: () => {
        this.islandQuestion = null;
        this.state = 'ISLAND_EXPLORATION';
        this.ui.hideIslandLanguage();
      },
      nextStage: () => this.nextStage(),
      freeSail: () => {
        this.ui.hideCelebration();
        this.freeSailMode = true;
        this.stageManager.setStage(10);
        this.currentQuestion = null;
        this.state = 'SAILING';
        this.ui.showGame();
        this.createQuestion();
      },
      settings: (settings) => this.updateSettings(settings),
      speakLearned: (text) => this.queueSpeech(1, text),
    });
  }

  private installWindowHooks(): void {
    if (!import.meta.env.DEV) return;
    const target = window as Window & {
      render_game_to_text?: () => string;
      advanceTime?: (ms: number) => void;
      __mallangGame?: GameEngine;
    };
    target.render_game_to_text = () => this.renderGameToText();
    target.advanceTime = (ms: number) => this.advanceTime(ms);
    target.__mallangGame = this;
  }

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.speech.cancel();
      this.audio.suspend();
    } else {
      this.lastFrame = performance.now();
      if (this.state !== 'PAUSED') this.audio.resume();
    }
  };
}
