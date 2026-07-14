import './styles.css';
import { GameEngine } from './game/GameEngine';

const canvas = document.getElementById('game-canvas');

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('게임 캔버스를 찾을 수 없습니다.');
}

try {
  const game = new GameEngine(canvas);
  game.start();
} catch (error) {
  console.error('말랑바다 모험단을 시작하지 못했습니다.', error);
  const fallback = document.createElement('section');
  fallback.setAttribute('role', 'alert');
  fallback.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;padding:24px;background:#eafcff;color:#173c4b;text-align:center;font:700 18px sans-serif;';
  fallback.innerHTML = '<div><h1>잠시 바다가 쉬고 있어요</h1><p>Chrome을 새로고침하면 다시 출항할 수 있어요.</p></div>';
  document.body.append(fallback);
}
