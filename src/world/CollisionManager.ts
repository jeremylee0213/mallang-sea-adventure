import * as THREE from 'three';
import type { IslandDefinition } from '../types';

export interface CircleCollision {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export class CollisionManager {
  readonly worldHalfSize: number;
  private islands: CircleCollision[] = [];

  constructor(worldHalfSize = 205) {
    this.worldHalfSize = worldHalfSize;
  }

  setIslands(definitions: readonly IslandDefinition[]): void {
    this.islands = definitions
      .filter((island) => island.explorable)
      .map((island) => ({
        id: island.id,
        x: island.position.x,
        z: island.position.z,
        radius: island.radius,
      }));
  }

  resolveBoat(position: THREE.Vector3, previous: THREE.Vector3, boatRadius = 1.7): string | null {
    const limit = this.worldHalfSize - boatRadius;
    position.x = THREE.MathUtils.clamp(position.x, -limit, limit);
    position.z = THREE.MathUtils.clamp(position.z, -limit, limit);

    for (const island of this.islands) {
      const dx = position.x - island.x;
      const dz = position.z - island.z;
      const minimum = island.radius + boatRadius - 0.6;
      if (dx * dx + dz * dz >= minimum * minimum) continue;
      position.x = previous.x;
      position.z = previous.z;
      return island.id;
    }
    return null;
  }

  constrainPlayer(
    position: THREE.Vector3,
    island: IslandDefinition,
    margin = 1.3,
  ): void {
    const dx = position.x - island.position.x;
    const dz = position.z - island.position.z;
    const distance = Math.hypot(dx, dz);
    const maxDistance = Math.max(2, island.radius - margin);
    if (distance <= maxDistance) return;
    const scale = maxDistance / Math.max(distance, 0.001);
    position.x = island.position.x + dx * scale;
    position.z = island.position.z + dz * scale;
  }

  nearestDock(position: THREE.Vector3, definitions: readonly IslandDefinition[]): {
    island: IslandDefinition;
    distance: number;
  } | null {
    let closest: { island: IslandDefinition; distance: number } | null = null;
    for (const island of definitions) {
      if (!island.explorable) continue;
      const distance = Math.hypot(position.x - island.dock.x, position.z - island.dock.z);
      if (!closest || distance < closest.distance) closest = { island, distance };
    }
    return closest;
  }
}
