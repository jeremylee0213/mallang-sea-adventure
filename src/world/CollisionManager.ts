import * as THREE from 'three';
import type { IslandDefinition } from '../types';

export interface CircleCollision {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export interface ShoreLanding {
  readonly island: IslandDefinition;
  readonly shoreDistance: number;
  readonly centerDistance: number;
  readonly boatPosition: { readonly x: number; readonly z: number };
  readonly playerSpawn: { readonly x: number; readonly z: number; readonly heading: number };
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

  nearestShore(
    position: THREE.Vector3,
    definitions: readonly IslandDefinition[],
    isUnlocked: (island: IslandDefinition) => boolean,
    maxShoreDistance = 9,
    playerInset = 4,
  ): ShoreLanding | null {
    let closest: ShoreLanding | null = null;
    for (const island of definitions) {
      if (!island.explorable || !isUnlocked(island)) continue;
      const dx = position.x - island.position.x;
      const dz = position.z - island.position.z;
      const centerDistance = Math.hypot(dx, dz);
      const shoreDistance = Math.max(0, centerDistance - island.radius);
      if (shoreDistance > maxShoreDistance || (closest && closest.shoreDistance <= shoreDistance)) continue;

      let outwardX = dx / Math.max(centerDistance, 0.001);
      let outwardZ = dz / Math.max(centerDistance, 0.001);
      if (!Number.isFinite(outwardX) || !Number.isFinite(outwardZ) || centerDistance < 0.001) {
        const dockDx = island.dock.x - island.position.x;
        const dockDz = island.dock.z - island.position.z;
        const dockLength = Math.max(0.001, Math.hypot(dockDx, dockDz));
        outwardX = dockDx / dockLength;
        outwardZ = dockDz / dockLength;
      }
      const walkableRadius = Math.max(2, island.radius - Math.max(2, playerInset));
      closest = {
        island,
        shoreDistance,
        centerDistance,
        boatPosition: { x: position.x, z: position.z },
        playerSpawn: {
          x: island.position.x + outwardX * walkableRadius,
          z: island.position.z + outwardZ * walkableRadius,
          heading: Math.atan2(-outwardX, -outwardZ),
        },
      };
    }
    return closest;
  }
}
