import * as THREE from 'three';
import type { AudioManager } from '../game/AudioManager';
import type { InputManager } from '../game/InputManager';
import type { MonsterManager, AttackResult } from './MonsterManager';
import type { PlayerController } from './PlayerController';
import { addBox } from './voxel';

export class CombatManager {
  private cooldown = 0;
  private swingRemaining = 0;
  private readonly sword = new THREE.Group();

  constructor(
    private readonly player: PlayerController,
    private readonly monsters: MonsterManager,
    private readonly audio: AudioManager,
  ) {
    addBox(this.sword, [0.24, 1.8, 0.24], [0, 0.9, 0], 0xf2dfad);
    addBox(this.sword, [0.85, 0.18, 0.22], [0, 0.05, 0], 0x8a5b42);
    addBox(this.sword, [0.32, 0.72, 0.32], [0, -0.4, 0], 0x6f4b3c);
    this.sword.position.set(0.78, 2.1, 0.2);
    this.sword.rotation.z = -0.35;
    this.player.group.add(this.sword);
  }

  update(delta: number, input: InputManager): AttackResult | null {
    this.cooldown = Math.max(0, this.cooldown - delta);
    this.swingRemaining = Math.max(0, this.swingRemaining - delta);
    if (this.swingRemaining > 0) {
      const progress = 1 - this.swingRemaining / 0.28;
      this.sword.rotation.z = -0.7 + Math.sin(progress * Math.PI) * 1.65;
      this.sword.rotation.x = -Math.sin(progress * Math.PI) * 0.55;
    } else {
      this.sword.rotation.z = THREE.MathUtils.damp(this.sword.rotation.z, -0.35, 10, delta);
      this.sword.rotation.x = THREE.MathUtils.damp(this.sword.rotation.x, 0, 10, delta);
    }
    if (!input.consume('KeyF', 'Mouse0') || this.cooldown > 0) return null;
    this.cooldown = 0.48;
    this.swingRemaining = 0.28;
    const result = this.monsters.attack(
      this.player.group.position,
      this.player.heading,
      3.7,
      1,
    );
    this.audio.play('hit');
    return result;
  }

  getCooldown(): number {
    return this.cooldown;
  }
}
