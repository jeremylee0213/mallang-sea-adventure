import type { IslandDefinition } from '../types';

export interface MapFrame {
  x: number;
  z: number;
  heading: number;
  mode: 'boat' | 'player';
  currentIslandId: string | null;
  stage: number;
  discovered: readonly string[];
  compassTarget: { x: number; z: number } | null;
}

export class MinimapRenderer {
  private readonly miniContext: CanvasRenderingContext2D;
  private readonly worldContext: CanvasRenderingContext2D;

  constructor(
    private readonly miniCanvas: HTMLCanvasElement,
    private readonly worldCanvas: HTMLCanvasElement,
    private readonly islands: readonly IslandDefinition[],
  ) {
    const miniContext = miniCanvas.getContext('2d');
    const worldContext = worldCanvas.getContext('2d');
    if (!miniContext || !worldContext) throw new Error('Map canvas context is unavailable');
    this.miniContext = miniContext;
    this.worldContext = worldContext;
  }

  render(frame: MapFrame): void {
    this.renderMini(frame);
    this.renderWorld(frame);
  }

  private renderMini(frame: MapFrame): void {
    const { width, height } = this.miniCanvas;
    const context = this.miniContext;
    context.clearRect(0, 0, width, height);
    this.paintOcean(context, width, height);
    const scale = 0.72;

    for (const island of this.islands.filter((entry) => entry.explorable)) {
      const x = width / 2 + (island.position.x - frame.x) * scale;
      const y = height / 2 + (island.position.z - frame.z) * scale;
      if (x < -30 || x > width + 30 || y < -30 || y > height + 30) continue;
      const unlocked = island.unlockStage === null || frame.stage >= island.unlockStage;
      context.save();
      context.globalAlpha = unlocked ? 1 : 0.42;
      context.fillStyle = island.theme === 'rocky-marine' ? '#7f9994' : '#72b96b';
      context.strokeStyle = '#fff6cc';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x, y, Math.max(5, island.radius * scale * 0.35), 0, Math.PI * 2);
      context.fill();
      context.stroke();
      if (frame.discovered.includes(island.id) || island.id === frame.currentIslandId) {
        context.fillStyle = '#164b5c';
        context.font = '800 10px sans-serif';
        context.textAlign = 'center';
        context.fillText(island.name.replace('말랑 ', '').replace(' 학습', ''), x, y - 10);
      }
      if (!unlocked) {
        context.font = '15px sans-serif';
        context.fillText('🔒', x, y + 5);
      }
      context.restore();
    }

    if (frame.compassTarget) {
      const dx = frame.compassTarget.x - frame.x;
      const dz = frame.compassTarget.z - frame.z;
      const angle = Math.atan2(dx, -dz);
      context.save();
      context.translate(width / 2, height / 2);
      context.rotate(angle);
      context.fillStyle = '#ffcf4e';
      context.strokeStyle = '#ffffff';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(0, -63);
      context.lineTo(-7, -47);
      context.lineTo(7, -47);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
    }

    this.drawPlayer(context, width / 2, height / 2, frame.heading, frame.mode);
    context.strokeStyle = 'rgba(255,255,255,.65)';
    context.lineWidth = 3;
    context.strokeRect(1.5, 1.5, width - 3, height - 3);
  }

  private renderWorld(frame: MapFrame): void {
    const { width, height } = this.worldCanvas;
    const context = this.worldContext;
    context.clearRect(0, 0, width, height);
    this.paintOcean(context, width, height);
    const extentX = 720;
    const extentZ = 480;
    const mapX = (x: number): number => width / 2 + (x / extentX) * width * 0.88;
    const mapY = (z: number): number => height / 2 + (z / extentZ) * height * 0.82;

    context.save();
    context.strokeStyle = 'rgba(255,255,255,.22)';
    context.lineWidth = 1;
    for (let x = 60; x < width; x += 60) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 60; y < height; y += 60) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    context.restore();

    for (const island of this.islands) {
      const x = mapX(island.position.x);
      const y = mapY(island.position.z);
      const unlocked = island.explorable
        && (island.unlockStage === null || frame.stage >= island.unlockStage);
      const discovered = frame.discovered.includes(island.id);
      context.save();
      context.globalAlpha = island.explorable ? 1 : 0.55;
      context.fillStyle = island.theme === 'rocky-marine'
        ? '#78928c'
        : island.theme === 'future'
          ? '#9caeac'
          : '#75b96d';
      context.strokeStyle = discovered ? '#ffd653' : '#fff3c5';
      context.lineWidth = discovered ? 6 : 3;
      context.beginPath();
      context.roundRect(x - 26, y - 18, 52, 36, 12);
      context.fill();
      context.stroke();
      context.fillStyle = '#17485a';
      context.font = '900 14px sans-serif';
      context.textAlign = 'center';
      context.fillText(island.name, x, y - 28);
      context.font = '750 11px sans-serif';
      context.fillStyle = '#476d73';
      context.fillText(island.region, x, y + 34);
      if (!unlocked) {
        context.font = '22px sans-serif';
        context.fillText('🔒', x, y + 7);
      } else if (discovered) {
        context.font = '17px sans-serif';
        context.fillText('★', x, y + 6);
      }
      context.restore();
    }

    this.drawPlayer(context, mapX(frame.x), mapY(frame.z), frame.heading, frame.mode);
  }

  private paintOcean(context: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#92dfe4');
    gradient.addColorStop(1, '#4fb9cf');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = 'rgba(255,255,255,.23)';
    context.lineWidth = 2;
    for (let y = 14; y < height; y += 22) {
      for (let x = (y % 44) - 20; x < width; x += 48) {
        context.beginPath();
        context.moveTo(x, y);
        context.quadraticCurveTo(x + 10, y - 5, x + 20, y);
        context.stroke();
      }
    }
  }

  private drawPlayer(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    heading: number,
    mode: 'boat' | 'player',
  ): void {
    context.save();
    context.translate(x, y);
    context.rotate(-heading);
    context.fillStyle = mode === 'boat' ? '#f36f55' : '#247c9b';
    context.strokeStyle = '#ffffff';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, -11);
    context.lineTo(8, 9);
    context.lineTo(0, 5);
    context.lineTo(-8, 9);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }
}
