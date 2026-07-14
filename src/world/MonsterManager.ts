import * as THREE from 'three';
import type { IslandDefinition } from '../types';
import type { ParticleManager } from './ParticleManager';
import { addBox } from './voxel';

interface MonsterRuntime {
  id: string;
  group: THREE.Group;
  health: number;
  maxHealth: number;
  origin: THREE.Vector3;
  phase: number;
  contactCooldown: number;
  alive: boolean;
}

export interface MonsterState {
  id: string;
  name: string;
  x: number;
  z: number;
  health: number;
}

export interface AttackResult {
  hit: boolean;
  defeated: boolean;
  monsterId?: string;
  position?: THREE.Vector3;
}

export class MonsterManager {
  readonly group = new THREE.Group();
  private monsters: MonsterRuntime[] = [];
  private elapsed = 0;
  private activeIslandId: string | null = null;

  constructor(private readonly particles: ParticleManager) {
    this.group.name = 'friendly-monsters';
  }

  spawnForIsland(island: IslandDefinition, stageMonsterCount: number): void {
    if (this.activeIslandId === island.id && this.monsters.some((monster) => monster.alive)) return;
    this.clear();
    this.activeIslandId = island.id;
    if (island.peaceful || island.content.monsters <= 0) return;
    const count = Math.max(1, Math.min(4, stageMonsterCount || island.content.monsters));
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + 0.7;
      const distance = island.radius * 0.45;
      const origin = new THREE.Vector3(
        island.position.x + Math.sin(angle) * distance,
        1.5,
        island.position.z + Math.cos(angle) * distance,
      );
      const monster = this.createMonster(`${island.id}-monster-${index + 1}`, origin, island.theme, index);
      this.monsters.push(monster);
      this.group.add(monster.group);
    }
  }

  update(delta: number, playerPosition: THREE.Vector3, slowMultiplier = 1): number {
    this.elapsed += delta;
    let damage = 0;
    for (const monster of this.monsters) {
      if (!monster.alive) continue;
      monster.contactCooldown = Math.max(0, monster.contactCooldown - delta);
      const offset = playerPosition.clone().sub(monster.group.position);
      const distance = offset.length();
      if (distance < 8 && distance > 1.4) {
        monster.group.position.add(offset.normalize().multiplyScalar(delta * 1.25 * slowMultiplier));
        monster.group.rotation.y = Math.atan2(offset.x, offset.z);
      } else if (distance >= 8) {
        const patrolTarget = monster.origin.clone().add(new THREE.Vector3(
          Math.sin(this.elapsed * 0.55 + monster.phase) * 2.2,
          0,
          Math.cos(this.elapsed * 0.48 + monster.phase) * 2.2,
        ));
        monster.group.position.lerp(patrolTarget, Math.min(1, delta * 0.7 * slowMultiplier));
      }
      monster.group.position.y = 1.45 + Math.sin(this.elapsed * 3 + monster.phase) * 0.16;
      if (distance < 1.65 && monster.contactCooldown <= 0) {
        monster.contactCooldown = 1.5;
        damage += 8;
      }
    }
    return damage;
  }

  attack(origin: THREE.Vector3, heading: number, range = 3.5, damage = 1): AttackResult {
    const facing = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    let target: MonsterRuntime | null = null;
    let targetDistance = Infinity;
    for (const monster of this.monsters) {
      if (!monster.alive) continue;
      const offset = monster.group.position.clone().sub(origin);
      offset.y = 0;
      const distance = offset.length();
      if (distance > range || distance <= 0.001) continue;
      if (facing.dot(offset.normalize()) < 0.18 || distance >= targetDistance) continue;
      target = monster;
      targetDistance = distance;
    }
    if (!target) return { hit: false, defeated: false };
    target.health = Math.max(0, target.health - damage);
    const position = target.group.position.clone();
    this.particles.burst(position, 7, 0xffd867);
    target.group.scale.set(1.16, 0.86, 1.16);
    if (target.health <= 0) {
      target.alive = false;
      target.group.visible = false;
      this.particles.burst(position, 18);
    }
    return {
      hit: true,
      defeated: !target.alive,
      monsterId: target.id,
      position,
    };
  }

  resetContactCooldowns(): void {
    for (const monster of this.monsters) monster.contactCooldown = 1;
  }

  getStates(): MonsterState[] {
    return this.monsters
      .filter((monster) => monster.alive)
      .map((monster) => ({
        id: monster.id,
        name: monster.group.userData.name as string,
        x: Number(monster.group.position.x.toFixed(2)),
        z: Number(monster.group.position.z.toFixed(2)),
        health: monster.health,
      }));
  }

  clear(): void {
    for (const monster of this.monsters) this.group.remove(monster.group);
    this.monsters = [];
    this.activeIslandId = null;
  }

  private createMonster(
    id: string,
    position: THREE.Vector3,
    theme: IslandDefinition['theme'],
    index: number,
  ): MonsterRuntime {
    const group = new THREE.Group();
    group.name = id;
    group.position.copy(position);
    const colors = theme === 'volcanic'
      ? [0x7cc9a8, 0x68b895]
      : theme === 'sakura'
        ? [0x9bcf75, 0x87bd65]
        : [0x77c9d1, 0x65b8c2];
    const primary = colors[index % colors.length] ?? colors[0] ?? 0x77c9d1;
    const accent = colors[0] ?? 0x77c9d1;
    const name = theme === 'volcanic' ? '모래 뭉치' : theme === 'sakura' ? '나뭇잎 슬라임' : '젤리 게';
    group.userData.name = name;
    addBox(group, [1.65, 1.2, 1.5], [0, 0.35, 0], primary);
    addBox(group, [0.22, 0.22, 0.18], [-0.38, 0.58, 0.78], 0x173c4b);
    addBox(group, [0.22, 0.22, 0.18], [0.38, 0.58, 0.78], 0x173c4b);
    addBox(group, [0.42, 0.16, 0.16], [0, 0.22, 0.8], 0xffefd6);
    if (theme === 'sakura') {
      const leaf = addBox(group, [0.85, 0.18, 0.5], [0, 1.1, 0], 0x4e9e5f);
      leaf.rotation.z = 0.35;
    } else {
      addBox(group, [0.7, 0.35, 0.5], [-1, 0.05, 0.3], accent);
      addBox(group, [0.7, 0.35, 0.5], [1, 0.05, 0.3], accent);
    }
    return {
      id,
      group,
      health: 2,
      maxHealth: 2,
      origin: position.clone(),
      phase: index * 2.3,
      contactCooldown: 1,
      alive: true,
    };
  }
}
