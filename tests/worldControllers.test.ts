// @vitest-environment node
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { ISLANDS } from '../src/data/islands';
import type { InputManager } from '../src/game/InputManager';
import { BoatController } from '../src/world/BoatController';
import { CameraController } from '../src/world/CameraController';
import { CollisionManager } from '../src/world/CollisionManager';
import { PlayerController } from '../src/world/PlayerController';
import { ParticleManager } from '../src/world/ParticleManager';

class FakeInput {
  readonly down = new Set<string>();

  isDown(...codes: string[]): boolean {
    return codes.some((code) => this.down.has(code));
  }

  consume(): boolean {
    return false;
  }

  consumeLookDelta(): { x: number; y: number } {
    return { x: 0, y: 0 };
  }

  asInput(): InputManager {
    return this as unknown as InputManager;
  }
}

describe('third-person world controllers', () => {
  it('Space boost is unlimited, faster than normal sailing, and remains capped', () => {
    const collisions = new CollisionManager();
    const normalInput = new FakeInput();
    const boostedInput = new FakeInput();
    const normalBoat = new BoatController();
    const boostedBoat = new BoatController();

    normalInput.down.add('KeyW');
    for (let i = 0; i < 180; i += 1) normalBoat.update(1 / 60, normalInput.asInput(), collisions);
    normalInput.down.delete('KeyW');

    boostedInput.down.add('Space');
    for (let i = 0; i < 360; i += 1) boostedBoat.update(1 / 60, boostedInput.asInput(), collisions);
    expect(boostedBoat.isBoosting).toBe(true);
    expect(boostedBoat.speed).toBeGreaterThan(normalBoat.speed);
    expect(boostedBoat.speed).toBeLessThanOrEqual(boostedBoat.maxSpeed * 1.5);

    for (let i = 0; i < 600; i += 1) boostedBoat.update(1 / 60, boostedInput.asInput(), collisions);
    expect(boostedBoat.speed).toBeLessThanOrEqual(boostedBoat.maxSpeed * 1.5);
  });

  it('W moves the player along the flattened camera forward direction', () => {
    const input = new FakeInput();
    const collisions = new CollisionManager();
    const player = new PlayerController();
    const island = ISLANDS[0];
    player.spawn(island, { x: island.position.x, z: island.position.z, heading: 0 });

    input.down.add('KeyW');
    player.update(0.1, input.asInput(), island, collisions, Math.PI / 2);

    expect(player.group.position.x).toBeGreaterThan(island.position.x);
    expect(player.group.position.z).toBeCloseTo(island.position.z, 5);
  });

  it('arrow keys orbit the player camera without becoming player movement input', () => {
    const input = new FakeInput();
    const camera = new CameraController(new THREE.PerspectiveCamera(), []);
    const player = new PlayerController();
    const island = ISLANDS[0];
    player.spawn(island, { x: island.position.x, z: island.position.z, heading: 0 });
    camera.setMode('player', true, player.group);
    const startYaw = camera.playerYaw;
    const startPosition = player.group.position.clone();

    input.down.add('ArrowRight');
    camera.updatePlayerInput(0.25, input.asInput());
    player.update(0.25, input.asInput(), island, new CollisionManager(), camera.playerYaw);

    expect(camera.playerYaw).toBeGreaterThan(startYaw);
    expect(player.group.position.distanceTo(startPosition)).toBeCloseTo(0, 6);
  });

  it('finds a safe landing at any unlocked shoreline and rejects locked islands', () => {
    const collisions = new CollisionManager();
    const island = ISLANDS[0];
    const boatPosition = new THREE.Vector3(
      island.position.x + island.radius + 3,
      0.74,
      island.position.z,
    );

    expect(collisions.nearestShore(boatPosition, ISLANDS, () => false)).toBeNull();
    const landing = collisions.nearestShore(
      boatPosition,
      ISLANDS,
      (candidate) => candidate.id === island.id,
    );

    expect(landing?.island.id).toBe(island.id);
    expect(landing?.shoreDistance).toBeCloseTo(3, 6);
    expect(landing?.boatPosition).toEqual({ x: boatPosition.x, z: boatPosition.z });
    expect(landing?.playerSpawn.x).toBeCloseTo(island.position.x + island.radius - 4, 6);
    expect(landing?.playerSpawn.z).toBeCloseTo(island.position.z, 6);
    expect(landing?.playerSpawn.heading).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('reuses the bounded particle pool for boost flames and lets the trail fade', () => {
    const particles = new ParticleManager(12);
    const origin = new THREE.Vector3(0, 1, 0);
    const backward = new THREE.Vector3(0, 0, -1);

    for (let index = 0; index < 20; index += 1) {
      particles.emitBoostTrail(origin, backward, 2);
    }
    expect(particles.getActiveCount('flame')).toBeLessThanOrEqual(12);
    expect(particles.getActiveCount('flame')).toBeGreaterThan(0);

    particles.update(0.6);
    expect(particles.getActiveCount('flame')).toBe(0);
    particles.burst(origin, 4);
    expect(particles.getActiveCount('star')).toBe(4);
  });
});
