import * as THREE from 'three';
import type { InputManager } from '../game/InputManager';
import type { CollisionManager } from './CollisionManager';
import { addBox } from './voxel';

export interface BoatState {
  x: number;
  z: number;
  heading: number;
  speed: number;
}

export class BoatController {
  readonly group = new THREE.Group();
  speed = 0;
  heading = 0;
  maxSpeed = 9;
  rocking = 0;
  private turnVelocity = 0;
  private elapsed = 0;

  constructor() {
    this.group.name = 'player-boat';
    this.buildModel();
  }

  update(
    delta: number,
    input: InputManager,
    collisions: CollisionManager,
    speedMultiplier = 1,
  ): string | null {
    this.elapsed += delta;
    const previous = this.group.position.clone();
    const forward = input.isDown('KeyW', 'ArrowUp');
    const backward = input.isDown('KeyS', 'ArrowDown');
    const steer = (input.isDown('KeyA', 'ArrowLeft') ? 1 : 0)
      - (input.isDown('KeyD', 'ArrowRight') ? 1 : 0);

    const targetMax = this.maxSpeed * Math.min(1.35, Math.max(1, speedMultiplier));
    if (forward) this.speed += 7.2 * delta;
    if (backward) this.speed -= (this.speed > 0 ? 10 : 4.5) * delta;
    if (!forward && !backward) this.speed *= Math.exp(-1.35 * delta);
    this.speed = THREE.MathUtils.clamp(this.speed, -3.1, targetMax);

    const steerStrength = 0.55 + Math.min(1, Math.abs(this.speed) / 4) * 0.75;
    const desiredTurn = steer * steerStrength * Math.sign(this.speed || 1);
    this.turnVelocity = THREE.MathUtils.damp(this.turnVelocity, desiredTurn, 6, delta);
    this.heading += this.turnVelocity * delta;

    this.group.position.x += Math.sin(this.heading) * this.speed * delta;
    this.group.position.z += Math.cos(this.heading) * this.speed * delta;
    const collided = collisions.resolveBoat(this.group.position, previous);
    if (collided) this.speed *= -0.08;

    this.group.position.y = 0.74 + Math.sin(this.elapsed * 1.7) * 0.075;
    this.group.rotation.y = this.heading;
    const rock = this.rocking > 0 ? Math.sin(this.elapsed * 15) * 0.1 * this.rocking : 0;
    this.group.rotation.z = THREE.MathUtils.damp(
      this.group.rotation.z,
      -this.turnVelocity * 0.09 + rock,
      5,
      delta,
    );
    this.group.rotation.x = Math.sin(this.elapsed * 1.25) * 0.018;
    this.rocking = Math.max(0, this.rocking - delta * 1.8);
    return collided;
  }

  triggerFriendlyRock(): void {
    this.rocking = 1;
  }

  teleport(x: number, z: number, heading = 0): void {
    this.group.position.set(x, 0.74, z);
    this.heading = heading;
    this.group.rotation.y = heading;
    this.speed = 0;
  }

  getState(): BoatState {
    return {
      x: Number(this.group.position.x.toFixed(2)),
      z: Number(this.group.position.z.toFixed(2)),
      heading: Number(this.heading.toFixed(3)),
      speed: Number(this.speed.toFixed(2)),
    };
  }

  private buildModel(): void {
    const hull = new THREE.Group();
    addBox(hull, [3.4, 0.65, 5.1], [0, 0, 0], 0xb85e45);
    addBox(hull, [2.8, 0.55, 4.7], [0, 0.5, 0.05], 0xf2b45f);
    addBox(hull, [2.15, 0.28, 3.35], [0, 0.83, 0.1], 0xffe0a0);
    addBox(hull, [0.25, 5.2, 0.25], [0, 3.15, 0.1], 0x7b4d37);
    addBox(hull, [0.13, 0.13, 2.8], [0, 5.05, -0.15], 0x7b4d37);
    const sail = addBox(hull, [0.12, 3.25, 2.65], [-0.03, 3.45, -0.7], 0xfff4c3);
    sail.rotation.x = -0.04;
    const accent = addBox(hull, [0.14, 0.48, 2.72], [-0.1, 3.85, -0.72], 0x55b8ca);
    accent.rotation.x = -0.04;
    addBox(hull, [0.72, 0.72, 0.72], [0, 1.4, 0.5], 0xf2c28c);
    addBox(hull, [0.82, 0.35, 0.82], [0, 1.9, 0.5], 0xef7357);
    hull.rotation.y = Math.PI;
    this.group.add(hull);
  }
}
