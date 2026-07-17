import * as THREE from 'three';
import type { InputManager } from '../game/InputManager';
import type { CosmeticPalette, IslandDefinition } from '../types';
import type { CollisionManager } from './CollisionManager';
import { addBox } from './voxel';

export interface PlayerState {
  x: number;
  y: number;
  z: number;
  heading: number;
  health: number;
}

export interface PlayerSpawnPoint {
  readonly x: number;
  readonly z: number;
  readonly heading?: number;
}

export class PlayerController {
  readonly group = new THREE.Group();
  health = 100;
  maxHealth = 100;
  heading = Math.PI;
  shieldRemaining = 0;
  private verticalVelocity = 0;
  private grounded = true;
  private walkPhase = 0;
  private leftLeg: THREE.Object3D | null = null;
  private rightLeg: THREE.Object3D | null = null;
  private readonly appearanceMeshes: THREE.Mesh[] = [];

  constructor() {
    this.group.visible = false;
    this.group.name = 'island-player';
    this.buildModel();
  }

  update(
    delta: number,
    input: InputManager,
    island: IslandDefinition,
    collisions: CollisionManager,
    cameraYaw = this.heading,
  ): void {
    const strafe = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
    const forward = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
    const inputLength = Math.hypot(strafe, forward);
    const running = input.isDown('ShiftLeft', 'ShiftRight');
    const speed = running ? 8.2 : 5.2;
    if (inputLength > 0) {
      const normalizedStrafe = strafe / inputLength;
      const normalizedForward = forward / inputLength;
      const forwardX = Math.sin(cameraYaw);
      const forwardZ = Math.cos(cameraYaw);
      const rightX = Math.cos(cameraYaw);
      const rightZ = -Math.sin(cameraYaw);
      const dx = forwardX * normalizedForward + rightX * normalizedStrafe;
      const dz = forwardZ * normalizedForward + rightZ * normalizedStrafe;
      this.group.position.x += dx * speed * delta;
      this.group.position.z += dz * speed * delta;
      const desiredHeading = Math.atan2(dx, dz);
      const shortestTurn = Math.atan2(
        Math.sin(desiredHeading - this.heading),
        Math.cos(desiredHeading - this.heading),
      );
      this.heading += shortestTurn * (1 - Math.exp(-13 * delta));
      this.group.rotation.y = this.heading;
      this.walkPhase += delta * (running ? 13 : 9);
      if (this.leftLeg && this.rightLeg) {
        this.leftLeg.rotation.x = Math.sin(this.walkPhase) * 0.55;
        this.rightLeg.rotation.x = -Math.sin(this.walkPhase) * 0.55;
      }
    } else if (this.leftLeg && this.rightLeg) {
      this.leftLeg.rotation.x = THREE.MathUtils.damp(this.leftLeg.rotation.x, 0, 9, delta);
      this.rightLeg.rotation.x = THREE.MathUtils.damp(this.rightLeg.rotation.x, 0, 9, delta);
    }

    if (input.consume('Space') && this.grounded) {
      this.verticalVelocity = 7.2;
      this.grounded = false;
    }
    this.verticalVelocity -= 18 * delta;
    this.group.position.y += this.verticalVelocity * delta;
    if (this.group.position.y <= 1.15) {
      this.group.position.y = 1.15;
      this.verticalVelocity = 0;
      this.grounded = true;
    }
    collisions.constrainPlayer(this.group.position, island);
    this.shieldRemaining = Math.max(0, this.shieldRemaining - delta);
  }

  spawn(island: IslandDefinition, spawnPoint?: PlayerSpawnPoint): void {
    const dx = island.position.x - island.dock.x;
    const dz = island.position.z - island.dock.z;
    const length = Math.max(0.001, Math.hypot(dx, dz));
    const fallbackX = island.dock.x + (dx / length) * 9;
    const fallbackZ = island.dock.z + (dz / length) * 9;
    const fallbackHeading = Math.atan2(dx, dz);
    const spawnX = spawnPoint && Number.isFinite(spawnPoint.x) ? spawnPoint.x : fallbackX;
    const spawnZ = spawnPoint && Number.isFinite(spawnPoint.z) ? spawnPoint.z : fallbackZ;
    const spawnHeading = spawnPoint && Number.isFinite(spawnPoint.heading)
      ? spawnPoint.heading
      : fallbackHeading;
    this.group.position.set(
      spawnX,
      1.15,
      spawnZ,
    );
    this.heading = spawnHeading ?? fallbackHeading;
    this.group.rotation.y = this.heading;
    this.group.visible = true;
    this.health = Math.max(1, this.health);
    this.verticalVelocity = 0;
    this.grounded = true;
  }

  hide(): void {
    this.group.visible = false;
  }

  heal(amount: number): number {
    this.health = Math.min(this.maxHealth, this.health + Math.max(0, amount));
    return this.health;
  }

  damage(amount: number): boolean {
    if (this.shieldRemaining > 0) return false;
    this.health = Math.max(0, this.health - Math.max(0, amount));
    return this.health === 0;
  }

  activateShield(seconds: number): void {
    this.shieldRemaining = Math.max(this.shieldRemaining, seconds);
  }

  getState(): PlayerState {
    return {
      x: Number(this.group.position.x.toFixed(2)),
      y: Number(this.group.position.y.toFixed(2)),
      z: Number(this.group.position.z.toFixed(2)),
      heading: Number(this.heading.toFixed(3)),
      health: this.health,
    };
  }

  applyAppearance(palette: CosmeticPalette): void {
    const colors = [palette.primary, palette.secondary, palette.accent];
    this.appearanceMeshes.forEach((mesh, index) => {
      const material = mesh.material;
      if (material instanceof THREE.MeshStandardMaterial) {
        material.color.set(colors[index % colors.length] ?? palette.primary);
      }
    });
  }

  private buildModel(): void {
    const body = new THREE.Group();
    this.appearanceMeshes.push(addBox(body, [1.0, 1.15, 0.65], [0, 1.65, 0], 0x55b8ca));
    addBox(body, [0.88, 0.88, 0.82], [0, 2.7, 0], 0xf0bd8e);
    this.appearanceMeshes.push(
      addBox(body, [0.98, 0.28, 0.94], [0, 3.2, 0], 0xef765d),
      addBox(body, [0.62, 0.2, 0.72], [0.2, 3.35, -0.02], 0xef765d),
    );
    addBox(body, [0.15, 0.15, 0.05], [-0.2, 2.78, 0.42], 0x173c4b);
    addBox(body, [0.15, 0.15, 0.05], [0.2, 2.78, 0.42], 0x173c4b);
    this.leftLeg = addBox(body, [0.38, 0.92, 0.45], [-0.28, 0.62, 0], 0x356f82);
    this.rightLeg = addBox(body, [0.38, 0.92, 0.45], [0.28, 0.62, 0], 0x356f82);
    this.appearanceMeshes.push(this.leftLeg as THREE.Mesh, this.rightLeg as THREE.Mesh);
    addBox(body, [0.29, 1.0, 0.3], [-0.66, 1.74, 0], 0xf0bd8e);
    addBox(body, [0.29, 1.0, 0.3], [0.66, 1.74, 0], 0xf0bd8e);
    this.group.add(body);
  }
}
