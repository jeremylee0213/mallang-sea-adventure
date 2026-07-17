import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173';
const outputDir = path.resolve('output/smoke');
await fs.mkdir(outputDir, { recursive: true });

const report = {
  url: baseUrl,
  startedAt: new Date().toISOString(),
  checks: [],
  errors: [],
};

function check(condition, label, detail = '') {
  if (!condition) throw new Error(`${label}${detail ? `: ${detail}` : ''}`);
  report.checks.push({ label, detail });
}

function normalizeAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

async function state(page) {
  const text = await page.evaluate(() => window.render_game_to_text?.());
  if (!text) throw new Error('render_game_to_text is unavailable');
  return JSON.parse(text);
}

async function advance(page, milliseconds) {
  await page.evaluate((ms) => window.advanceTime?.(ms), milliseconds);
}

async function keyFrames(page, key, frames) {
  await page.keyboard.down(key);
  await advance(page, frames * (1000 / 60));
  await page.keyboard.up(key);
  await advance(page, 1000 / 60);
}

async function screenshot(page, name) {
  await page.evaluate(() => document.fonts?.ready);
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
}

async function steerBoatTo(page, target, stopWhen, maxSteps = 180) {
  for (let step = 0; step < maxSteps; step += 1) {
    const snapshot = await state(page);
    if (stopWhen(snapshot)) return snapshot;
    const dx = target.x - snapshot.boat.x;
    const dz = target.z - snapshot.boat.z;
    const desired = Math.atan2(dx, dz);
    const difference = normalizeAngle(desired - snapshot.boat.heading);
    if (Math.abs(difference) > 0.1) {
      await keyFrames(page, difference > 0 ? 'KeyA' : 'KeyD', 3);
    } else {
      await keyFrames(page, 'KeyW', Math.hypot(dx, dz) < 8 ? 3 : 7);
    }
  }
  throw new Error(`Boat navigation timed out at ${JSON.stringify((await state(page)).boat)}`);
}

async function walkPlayerTo(page, target, stopWhen, maxSteps = 180) {
  for (let step = 0; step < maxSteps; step += 1) {
    const snapshot = await state(page);
    if (stopWhen(snapshot)) return snapshot;
    if (!snapshot.player) throw new Error(`Player is unavailable in ${snapshot.mode}`);
    const dx = target.x - snapshot.player.x;
    const dz = target.z - snapshot.player.z;
    const desired = Math.atan2(dx, dz);
    const difference = normalizeAngle(desired - snapshot.camera.yaw);
    if (Math.abs(difference) > 0.08) {
      await keyFrames(page, difference > 0 ? 'ArrowRight' : 'ArrowLeft', 3);
    } else {
      await keyFrames(page, 'KeyW', Math.hypot(dx, dz) < 3 ? 2 : 5);
    }
  }
  throw new Error(`Player navigation timed out at ${JSON.stringify((await state(page)).player)}`);
}

function defaultSave(overrides = {}) {
  return {
    version: 1,
    highestStage: 1,
    currentStage: 1,
    completedStages: [],
    score: 0,
    highScore: 0,
    unlockedIslands: ['start-island', 'dokdo-marine-islet'],
    discoveredIslands: [],
    claimedIslandInteractions: [],
    inventory: {
      starlightCompass: 2,
      tailwindBottle: 2,
      seaMagnet: 1,
      timeBubble: 1,
      healingApple: 1,
      shieldShell: 1,
    },
    settings: {
      volume: 0.2,
      japaneseVoice: true,
      autoplayCount: 1,
      shadowQuality: 'low',
      mathInputMode: 'choices',
    },
    learnedJapanese: [],
    wordStats: {},
    lastPlayedAt: new Date().toISOString(),
    tutorialComplete: false,
    freeSailUnlocked: false,
    ...overrides,
  };
}

async function createPage(browser, saveData = null, viewport = { width: 1280, height: 720 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') report.errors.push({ type: 'console', text: message.text() });
  });
  page.on('pageerror', (error) => report.errors.push({ type: 'pageerror', text: String(error) }));
  await page.addInitScript((initialSave) => {
    window.__mallangSpokenTexts = [];
    class QuietUtterance {
      constructor(text) {
        this.text = text;
        this.lang = '';
        this.rate = 1;
        this.pitch = 1;
        this.volume = 1;
        this.voice = null;
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
      }
    }
    const speech = {
      cancel() {},
      getVoices() { return [{ lang: 'ja-JP', name: 'QA Japanese' }]; },
      speak(utterance) {
        window.__mallangSpokenTexts.push({ text: utterance.text, language: utterance.lang });
        utterance.onstart?.();
        window.setTimeout(() => utterance.onend?.(), 15);
      },
    };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: QuietUtterance, configurable: true });
    Object.defineProperty(window, 'speechSynthesis', { value: speech, configurable: true });
    if (initialSave && !localStorage.getItem('mallang-sea-adventure.save.v1')) {
      localStorage.setItem('mallang-sea-adventure.save.v1', JSON.stringify(initialSave));
    }
  }, saveData);
  return { context, page };
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});

try {
  {
    const { context, page } = await createPage(browser, null);
    await page.goto(`${baseUrl}/?seed=9`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
    await screenshot(page, '01-menu');
    check((await state(page)).mode === 'MENU', 'menu renders');

    await page.click('#start-btn');
    check(await page.locator('#course-screen').isVisible(), 'first run opens course setup');
    await screenshot(page, '02-course-setup');
    await page.locator('.subject-option', { hasText: '일본어' }).click();
    await page.locator('.difficulty-option', { hasText: '쉬움' }).click();
    await page.click('#course-confirm-btn');
    check((await state(page)).mode === 'TUTORIAL', 'first run opens tutorial');
    await screenshot(page, '02-tutorial');
    await page.click('#tutorial-skip-btn');
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'SAILING');
    let snapshot = await state(page);
    check(snapshot.blocks.filter((block) => block.correct).length === 1, 'sailing quiz has exactly one correct block');
    const quizLayout = await page.evaluate(() => {
      const card = document.querySelector('#quiz-card').getBoundingClientRect();
      const items = document.querySelector('#item-bar').getBoundingClientRect();
      return { top: card.top, bottom: card.bottom, itemTop: items.top, height: window.innerHeight };
    });
    check(quizLayout.top > quizLayout.height * 0.45, 'quiz card is placed in the lower view', JSON.stringify(quizLayout));
    check(quizLayout.bottom <= quizLayout.itemTop, 'quiz card does not overlap the item bar', JSON.stringify(quizLayout));
    await screenshot(page, '03-sailing');

    const scoreBefore = snapshot.score;
    const correctBlock = snapshot.blocks.find((block) => block.correct);
    check(Boolean(correctBlock), 'correct block is exposed to deterministic smoke state');
    snapshot = await steerBoatTo(
      page,
      { x: correctBlock.x, z: correctBlock.z },
      (value) => value.score > scoreBefore,
    );
    check(snapshot.score >= scoreBefore + 100, 'keyboard sailing reaches answer and scores');
    check(snapshot.stage.correct === 1, 'language progress increments once');
    await screenshot(page, '04-correct-feedback');
    await advance(page, 1200);
    snapshot = await state(page);
    check(snapshot.blocks.filter((block) => block.correct).length === 1, 'next question appears after feedback');

    const compassBefore = snapshot.items.find((item) => item.id === 'starlightCompass').count;
    const speedBeforeBoost = Math.abs(snapshot.boat.speed);
    await page.keyboard.down('Space');
    await advance(page, 1000);
    snapshot = await state(page);
    check(snapshot.boat.boosting === true, 'Space activates unlimited sailing boost');
    check(Math.abs(snapshot.boat.speed) > speedBeforeBoost, 'Space boost increases boat speed');
    check(snapshot.items.find((item) => item.id === 'starlightCompass').count === compassBefore, 'boost does not consume inventory');
    await page.keyboard.up('Space');
    await advance(page, 30);
    await keyFrames(page, 'KeyQ', 2);
    snapshot = await state(page);
    check(snapshot.items.find((item) => item.id === 'starlightCompass').count === compassBefore - 1, 'Q uses selected item');
    check(snapshot.items.find((item) => item.id === 'starlightCompass').active > 0, 'item effect activates');

    await page.keyboard.press('KeyM');
    await advance(page, 50);
    check((await state(page)).overlay === 'WORLD_MAP', 'M opens world map');
    await screenshot(page, '05-world-map');
    await page.keyboard.press('KeyM');
    await advance(page, 50);
    await page.keyboard.press('Escape');
    await advance(page, 50);
    check((await state(page)).mode === 'PAUSED', 'Escape pauses game');
    await page.keyboard.press('Escape');
    await advance(page, 50);
    check((await state(page)).mode === 'SAILING', 'Escape resumes game');

    const savedScore = (await state(page)).score;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
    check((await state(page)).mode === 'MENU', 'reload returns to menu safely');
    await page.click('#continue-btn');
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'SAILING');
    check((await state(page)).score === savedScore, 'continue restores saved score');
    await screenshot(page, '06-continued');
    await context.close();
  }

  for (const subject of ['mathematics', 'science']) {
    const courseSave = defaultSave({
      version: 2,
      selectedSubject: subject,
      selectedDifficulty: 'easy',
      courseSetupComplete: true,
      starPoints: 0,
      ownedBoatSkins: ['boat-sunrise'],
      ownedCharacterSkins: ['character-sky'],
      equippedBoatSkin: 'boat-sunrise',
      equippedCharacterSkin: 'character-sky',
      tutorialComplete: true,
    });
    const { context, page } = await createPage(browser, courseSave);
    await page.goto(`${baseUrl}/?seed=${subject === 'mathematics' ? 13 : 14}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
    await page.click('#continue-btn');
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'SAILING');
    await advance(page, 50);
    const snapshot = await state(page);
    const visiblePrompt = await page.locator('#quiz-prompt').innerText();
    const visibleMeaning = await page.locator('#quiz-meaning').innerText();
    const spoken = await page.evaluate(() => window.__mallangSpokenTexts.at(-1));
    check(snapshot.quiz.subject === subject, `${subject} course starts a real sailing question`);
    check(visiblePrompt === snapshot.quiz.prompt, `${subject} card shows the question prompt`);
    check(!visibleMeaning.includes(snapshot.quiz.answer), `${subject} card hides the answer before success`);
    check(spoken?.text === snapshot.quiz.prompt, `${subject} autoplay speaks the prompt, not the answer`);
    await context.close();
  }

  {
    const islandSave = defaultSave({
      highestStage: 7,
      currentStage: 7,
      score: 800,
      highScore: 800,
      unlockedIslands: ['start-island', 'dokdo-marine-islet'],
      tutorialComplete: true,
    });
    const { context, page } = await createPage(browser, islandSave);
    await page.goto(`${baseUrl}/?qa=island&seed=21`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
    await page.click('#continue-btn');
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'SAILING');
    await steerBoatTo(
      page,
      { x: 58, z: 94 },
      (value) => value.interaction?.kind === 'dock',
      130,
    );
    const shoreBoat = (await state(page)).boat;
    check(Math.hypot(shoreBoat.x - 45, shoreBoat.z - 91) > 4, 'landing prompt works away from the fixed dock');
    await page.keyboard.press('KeyE');
    await advance(page, 900);
    let snapshot = await state(page);
    check(snapshot.mode === 'ISLAND_EXPLORATION', 'E docks and switches to character mode');
    check(snapshot.activeIsland === 'jeju-wind-island', 'Jeju island unlocks when stage 7 begins');
    check(!(await page.locator('#item-bar').innerText()).includes('별빛 나침반'), 'sailing-only compass is absent from island slots');
    const appleBefore = snapshot.items.find((item) => item.id === 'healingApple').count;
    await keyFrames(page, 'KeyQ', 2);
    snapshot = await state(page);
    check(snapshot.items.find((item) => item.id === 'healingApple').count === appleBefore - 1, 'Q uses the selected island item once');
    check(snapshot.items.find((item) => item.id === 'healingApple').cooldown > 0, 'island item cooldown starts after Q');
    const beforeCameraTurn = snapshot;
    await keyFrames(page, 'ArrowRight', 8);
    snapshot = await state(page);
    check(Math.abs(normalizeAngle(snapshot.camera.yaw - beforeCameraTurn.camera.yaw)) > 0.1, 'island arrow key rotates the camera');
    check(
      Math.hypot(snapshot.player.x - beforeCameraTurn.player.x, snapshot.player.z - beforeCameraTurn.player.z) < 0.05,
      'camera rotation does not move the player',
    );
    const beforeForward = snapshot;
    await keyFrames(page, 'KeyW', 8);
    snapshot = await state(page);
    const movedX = snapshot.player.x - beforeForward.player.x;
    const movedZ = snapshot.player.z - beforeForward.player.z;
    check(
      movedX * Math.sin(beforeForward.camera.yaw) + movedZ * Math.cos(beforeForward.camera.yaw) > 0,
      'W moves the island player toward the camera view',
    );
    await screenshot(page, '07-jeju-island');

    await walkPlayerTo(
      page,
      { x: 48.2, z: 126.8 },
      (value) => value.interaction?.kind === 'chest',
      150,
    );
    await page.keyboard.press('KeyE');
    await advance(page, 50);
    snapshot = await state(page);
    check(snapshot.mode === 'QUIZ' && Boolean(snapshot.mathQuiz), 'E opens math treasure chest');
    check(
      ['two-digit-add', 'two-digit-subtract'].includes(snapshot.mathQuiz.kind),
      'stage 7 Jeju chest uses two-digit math',
      snapshot.mathQuiz.kind,
    );
    await screenshot(page, '08-math-chest');
    const answer = String(snapshot.mathQuiz.answer);
    await page.locator('.math-choice', { hasText: answer }).click();
    await advance(page, 100);
    snapshot = await state(page);
    check(snapshot.mode === 'ISLAND_EXPLORATION' && snapshot.mathQuiz === null, 'correct math answer opens chest without penalty');
    let storedIslandProgress = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-sea-adventure.save.v1')));
    check(storedIslandProgress.discoveredIslands.includes('jeju-wind-island'), 'island discovery persists in save data');
    check(storedIslandProgress.claimedIslandInteractions.includes('jeju-wind-island-chest'), 'opened chest persists in save data');

    const enemyBefore = snapshot.enemies.length;
    if (enemyBefore > 0) {
      const enemy = snapshot.enemies[0];
      await walkPlayerTo(
        page,
        { x: enemy.x, z: enemy.z },
        (value) => {
          const target = value.enemies.find((candidate) => candidate.id === enemy.id);
          return !target || Math.hypot(target.x - value.player.x, target.z - value.player.z) < 2.7;
        },
        100,
      );
      await keyFrames(page, 'KeyF', 2);
      await advance(page, 520);
      await keyFrames(page, 'KeyF', 2);
      await advance(page, 150);
      snapshot = await state(page);
      check(snapshot.enemies.length < enemyBefore, 'friendly sword combat turns a monster into stars');
    }
    await screenshot(page, '09-island-after-combat');

    await walkPlayerTo(
      page,
      { x: shoreBoat.x, z: shoreBoat.z },
      (value) => value.interaction?.kind === 'board',
      180,
    );
    await page.keyboard.press('KeyE');
    await advance(page, 600);
    check((await state(page)).mode === 'SAILING', 'E boards the boat again');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
    await page.click('#continue-btn');
    await steerBoatTo(
      page,
      { x: 58, z: 94 },
      (value) => value.interaction?.kind === 'dock',
      130,
    );
    await page.keyboard.press('KeyE');
    await advance(page, 900);
    await walkPlayerTo(
      page,
      { x: 48.2, z: 126.8 },
      (value) => value.interaction?.kind === 'chest',
      150,
    );
    await page.keyboard.press('KeyE');
    await advance(page, 80);
    snapshot = await state(page);
    check(
      snapshot.mode === 'ISLAND_EXPLORATION' && snapshot.mathQuiz === null,
      'reload cannot reopen an already rewarded chest',
      JSON.stringify({ mode: snapshot.mode, mathQuiz: snapshot.mathQuiz, usedInteractions: snapshot.usedInteractions }),
    );

    await page.keyboard.press('Escape');
    await advance(page, 50);
    await page.click('#menu-btn');
    page.once('dialog', (dialog) => dialog.accept());
    await page.click('#parent-reset-btn');
    snapshot = await state(page);
    storedIslandProgress = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-sea-adventure.save.v1')));
    check(snapshot.usedInteractions.length === 0, 'parent reset clears island runtime reward state on the same page');
    check(storedIslandProgress.claimedIslandInteractions.length === 0, 'parent reset clears persisted island rewards');
    check(storedIslandProgress.discoveredIslands.length === 0, 'parent reset clears persisted discoveries');
    await context.close();
  }

  {
    const sakuraSave = defaultSave({
      highestStage: 8,
      currentStage: 8,
      score: 1200,
      highScore: 1200,
      unlockedIslands: ['start-island', 'dokdo-marine-islet', 'jeju-wind-island', 'sakura-learning-island'],
      tutorialComplete: true,
    });
    const { context, page } = await createPage(browser, sakuraSave);
    await page.goto(`${baseUrl}/?qa=sakura&seed=31`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
    await page.click('#continue-btn');
    await steerBoatTo(
      page,
      { x: 121, z: -75 },
      (value) => value.interaction?.kind === 'dock',
      90,
    );
    await page.keyboard.press('KeyE');
    await advance(page, 900);
    check((await state(page)).activeIsland === 'sakura-learning-island', 'Sakura learning island is explorable');
    await walkPlayerTo(
      page,
      { x: 151.2, z: -71.3 },
      (value) => value.interaction?.kind === 'language-sign',
      160,
    );
    await page.keyboard.press('KeyE');
    await advance(page, 50);
    let snapshot = await state(page);
    check(snapshot.mode === 'QUIZ' && Boolean(snapshot.islandLanguageQuiz), 'language sign opens picture quiz');
    await screenshot(page, '10-island-language-quiz');
    const answer = snapshot.islandLanguageQuiz.answer;
    await page.locator('.language-choice', { hasText: answer }).click();
    await advance(page, 100);
    snapshot = await state(page);
    check(snapshot.mode === 'ISLAND_EXPLORATION' && snapshot.score > 1200, 'picture quiz scores and returns to exploration');
    await context.close();
  }

  {
    const shopSave = defaultSave({ score: 900, highScore: 900, tutorialComplete: true });
    const { context, page } = await createPage(browser, shopSave);
    await page.goto(`${baseUrl}/?seed=35`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
    let snapshot = await state(page);
    check(snapshot.starPoints === 900, 'version 1 score migrates to star points once');
    await page.click('#shop-btn');
    await page.locator('.cosmetic-card', { hasText: '잎새 탐험가' }).locator('.cosmetic-action').click();
    snapshot = await state(page);
    check(snapshot.cosmetics.character === 'character-leaf-scout', 'shop purchase equips a character skin');
    check(snapshot.starPoints === 400 && snapshot.score === 900, 'shop spends wallet points without reducing score');
    await screenshot(page, '10-shop-equipped');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
    snapshot = await state(page);
    check(snapshot.cosmetics.character === 'character-leaf-scout', 'equipped skin persists after reload');
    check(snapshot.starPoints === 400, 'save version 2 does not mint migration points again');
    await context.close();
  }

  {
    const reloadBoundarySave = defaultSave({ tutorialComplete: true });
    const { context, page } = await createPage(browser, reloadBoundarySave);
    await page.goto(`${baseUrl}/?qa=stage10&seed=37`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
    await page.click('#continue-btn');
    for (let answerIndex = 0; answerIndex < 3; answerIndex += 1) {
      const snapshot = await state(page);
      const scoreBefore = snapshot.score;
      const correct = snapshot.blocks.find((block) => block.correct);
      await steerBoatTo(
        page,
        { x: correct.x, z: correct.z },
        (value) => value.score > scoreBefore,
        60,
      );
      await advance(page, 1250);
    }
    let snapshot = await state(page);
    check(snapshot.mode === 'STAGE_CLEAR', 'stage 1 reaches clear state before reload boundary check');
    const beforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-sea-adventure.save.v1')));
    check(beforeReload.completedStages.includes(1), 'stage completion claim is persisted with the reward');
    check(beforeReload.currentStage === 2, 'next stage is persisted before the clear button is clicked');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
    await page.click('#continue-btn');
    snapshot = await state(page);
    const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-sea-adventure.save.v1')));
    check(snapshot.mode === 'SAILING' && snapshot.stage.id === 2, 'reload from stage clear continues at the next stage');
    check(afterReload.score === beforeReload.score, 'reload does not duplicate stage score reward');
    check(
      afterReload.inventory.starlightCompass === beforeReload.inventory.starlightCompass,
      'reload does not duplicate stage item reward',
    );
    await context.close();
  }

  {
    const finalSave = defaultSave({
      highestStage: 10,
      currentStage: 10,
      score: 3000,
      highScore: 3000,
      unlockedIslands: ['start-island', 'dokdo-marine-islet', 'jeju-wind-island', 'sakura-learning-island'],
      tutorialComplete: true,
    });
    const { context, page } = await createPage(browser, finalSave);
    await page.goto(`${baseUrl}/?qa=stage10&seed=41`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
    await page.click('#continue-btn');
    for (let answerIndex = 0; answerIndex < 10; answerIndex += 1) {
      let snapshot = await state(page);
      const scoreBefore = snapshot.score;
      const correct = snapshot.blocks.find((block) => block.correct);
      check(Boolean(correct), `stage 10 question ${answerIndex + 1} has a correct block`);
      await steerBoatTo(
        page,
        { x: correct.x, z: correct.z },
        (value) => value.score > scoreBefore,
        60,
      );
      await advance(page, 1250);
    }
    let snapshot = await state(page);
    check(snapshot.mode === 'STAGE_CLEAR' && snapshot.stage.correct === 10, 'stage 10 reaches clear state');
    await page.click('#next-stage-btn');
    await page.waitForSelector('#celebration-screen:not(.hidden)');
    await screenshot(page, '11-stage10-celebration');
    await page.click('#free-sail-btn');
    await advance(page, 100);
    snapshot = await state(page);
    check(snapshot.mode === 'SAILING' && snapshot.stage.freeSail, 'celebration unlocks free sailing');
    check(snapshot.blocks.filter((block) => block.correct).length === 1, 'free sailing starts a fresh learning question');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('mallang-sea-adventure.save.v1')));
    check(stored.freeSailUnlocked === true, 'free sailing unlock persists');
    await context.close();
  }

  {
    const narrowSave = defaultSave({ tutorialComplete: true });
    const { context, page } = await createPage(browser, narrowSave, { width: 390, height: 844 });
    await page.goto(`${baseUrl}/?seed=51`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function');
    await page.click('#continue-btn');
    const layout = await page.evaluate(() => {
      const card = document.querySelector('#quiz-card').getBoundingClientRect();
      const items = document.querySelector('#item-bar').getBoundingClientRect();
      return {
        cardBottom: card.bottom,
        itemTop: items.top,
        bodyWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    });
    check(layout.cardBottom <= layout.itemTop, 'narrow quiz card stays above item slots', JSON.stringify(layout));
    check(layout.bodyWidth <= layout.viewportWidth, 'narrow HUD has no horizontal overflow', JSON.stringify(layout));
    await screenshot(page, '12-narrow-sailing');
    await context.close();
  }

  check(report.errors.length === 0, 'browser console is clean', JSON.stringify(report.errors));
  report.completedAt = new Date().toISOString();
  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Smoke checks passed: ${report.checks.length}`);
} catch (error) {
  report.completedAt = new Date().toISOString();
  report.failure = String(error?.stack ?? error);
  await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
