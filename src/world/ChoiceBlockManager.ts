import * as THREE from 'three';
import type { CourseQuizChoice, QuizChoice } from '../types';
import { createTextTexture, disposeObject } from './voxel';

export interface ChoiceBlockState {
  id: string;
  label: string;
  x: number;
  z: number;
  correct: boolean;
}

interface ChoiceBlockRuntime {
  choice: ChoiceBlock;
  group: THREE.Group;
  phase: number;
  basePosition: THREE.Vector3;
  driftDirection: THREE.Vector3;
}

type ChoiceBlock = Pick<QuizChoice, 'id' | 'label' | 'isCorrect'> | CourseQuizChoice;

const BLOCK_COLORS = [0xffcf66, 0x74d3c1, 0xff9e83, 0x8fc8ef, 0xb7da78];

export class ChoiceBlockManager {
  readonly group = new THREE.Group();
  private blocks: ChoiceBlockRuntime[] = [];
  private elapsed = 0;
  private moving = false;
  private highlightRemaining = 0;
  private beam: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial> | null = null;

  constructor() {
    this.group.name = 'quiz-choice-blocks';
  }

  setQuestion(
    question: { readonly choices: readonly ChoiceBlock[] },
    origin: THREE.Vector3,
    moving: boolean,
    seed = 0,
  ): void {
    this.clear();
    this.moving = moving;
    const count = question.choices.length;
    const angleOffset = (seed * 1.47 + origin.x * 0.03 + origin.z * 0.05) % (Math.PI * 2);
    question.choices.forEach((choice, index) => {
      const angle = angleOffset + (index / count) * Math.PI * 2;
      const distance = 15 + (index % 2) * 7 + (seed % 3);
      const position = new THREE.Vector3(
        THREE.MathUtils.clamp(origin.x + Math.sin(angle) * distance, -190, 190),
        1.25,
        THREE.MathUtils.clamp(origin.z + Math.cos(angle) * distance, -190, 190),
      );
      const runtime = this.createBlock(choice, position, index);
      this.blocks.push(runtime);
      this.group.add(runtime.group);
    });
  }

  update(
    delta: number,
    options: { slowMultiplier?: number; magnetTarget?: THREE.Vector3; magnetActive?: boolean } = {},
  ): void {
    this.elapsed += delta;
    const slow = options.slowMultiplier ?? 1;
    for (const block of this.blocks) {
      block.group.position.y = 1.25 + Math.sin(this.elapsed * 1.7 + block.phase) * 0.2;
      block.group.rotation.y += delta * 0.28 * slow;
      if (this.moving && !block.choice.isCorrect) {
        block.basePosition.addScaledVector(block.driftDirection, delta * 0.7 * slow);
        if (Math.abs(block.basePosition.x) > 192) block.driftDirection.x *= -1;
        if (Math.abs(block.basePosition.z) > 192) block.driftDirection.z *= -1;
        block.group.position.x = THREE.MathUtils.damp(
          block.group.position.x,
          block.basePosition.x,
          2.5,
          delta,
        );
        block.group.position.z = THREE.MathUtils.damp(
          block.group.position.z,
          block.basePosition.z,
          2.5,
          delta,
        );
      }
      if (block.choice.isCorrect && options.magnetActive && options.magnetTarget) {
        const direction = options.magnetTarget.clone().sub(block.group.position);
        if (direction.length() < 20 && direction.length() > 4) {
          block.group.position.add(direction.normalize().multiplyScalar(delta * 2.2));
          block.basePosition.copy(block.group.position);
        }
      }
    }

    this.highlightRemaining = Math.max(0, this.highlightRemaining - delta);
    if (this.beam) {
      this.beam.visible = this.highlightRemaining > 0;
      this.beam.material.opacity = 0.18 + Math.sin(this.elapsed * 5) * 0.07;
      const correct = this.getCorrectRuntime();
      if (correct) {
        this.beam.position.set(correct.group.position.x, 12.5, correct.group.position.z);
        correct.group.scale.setScalar(1 + Math.sin(this.elapsed * 6) * 0.06);
      }
    }
    if (this.highlightRemaining <= 0) {
      for (const block of this.blocks) block.group.scale.setScalar(1);
    }
  }

  checkCollision(position: THREE.Vector3, radius = 2.25): ChoiceBlock | null {
    for (const block of this.blocks) {
      const distanceSquared = (
        (block.group.position.x - position.x) ** 2
        + (block.group.position.z - position.z) ** 2
      );
      if (distanceSquared <= radius * radius) return block.choice;
    }
    return null;
  }

  remove(choiceId: string): void {
    const index = this.blocks.findIndex((block) => block.choice.id === choiceId);
    if (index < 0) return;
    const block = this.blocks[index];
    if (!block) return;
    this.group.remove(block.group);
    disposeObject(block.group);
    this.blocks.splice(index, 1);
  }

  highlightCorrect(seconds = 5): void {
    this.highlightRemaining = Math.max(this.highlightRemaining, seconds);
    if (!this.beam) {
      this.beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.8, 3.2, 24, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xffe16b,
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      this.beam.renderOrder = 2;
      this.group.add(this.beam);
    }
    this.beam.visible = true;
  }

  getCorrectPosition(): THREE.Vector3 | null {
    const correct = this.getCorrectRuntime();
    return correct?.group.position.clone() ?? null;
  }

  placeCorrectNear(origin: THREE.Vector3, heading: number, distance = 8): void {
    const correct = this.getCorrectRuntime();
    if (!correct) return;
    correct.group.position.set(
      origin.x + Math.sin(heading) * distance,
      1.25,
      origin.z + Math.cos(heading) * distance,
    );
    correct.basePosition.copy(correct.group.position);
  }

  getStates(): ChoiceBlockState[] {
    return this.blocks.map((block) => ({
      id: block.choice.id,
      label: block.choice.label,
      x: Number(block.group.position.x.toFixed(2)),
      z: Number(block.group.position.z.toFixed(2)),
      correct: block.choice.isCorrect,
    }));
  }

  clear(): void {
    for (const block of this.blocks) {
      this.group.remove(block.group);
      disposeObject(block.group);
    }
    this.blocks = [];
    if (this.beam) {
      this.group.remove(this.beam);
      this.beam.geometry.dispose();
      this.beam.material.dispose();
      this.beam = null;
    }
    this.highlightRemaining = 0;
  }

  private createBlock(choice: ChoiceBlock, position: THREE.Vector3, index: number): ChoiceBlockRuntime {
    const group = new THREE.Group();
    group.name = `choice-${choice.id}`;
    group.position.copy(position);
    const material = new THREE.MeshStandardMaterial({
      color: BLOCK_COLORS[index % BLOCK_COLORS.length],
      roughness: 0.72,
      flatShading: true,
    });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(3.25, 3.25, 3.25), material);
    cube.castShadow = true;
    cube.receiveShadow = true;
    group.add(cube);

    const texture = createTextTexture(choice.label, '', {
      background: '#fffdf0',
      foreground: '#173c4b',
      accent: index % 2 ? '#e46e58' : '#258ba5',
    });
    for (const rotation of [0, Math.PI]) {
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(2.72, 2.72),
        new THREE.MeshBasicMaterial({ map: texture, transparent: false }),
      );
      label.position.z = rotation === 0 ? 1.631 : -1.631;
      label.rotation.y = rotation;
      group.add(label);
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.12, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.85;
    group.add(ring);

    return {
      choice,
      group,
      phase: index * 1.4,
      basePosition: position.clone(),
      driftDirection: new THREE.Vector3(Math.sin(index * 2.7), 0, Math.cos(index * 1.9)).normalize(),
    };
  }

  private getCorrectRuntime(): ChoiceBlockRuntime | undefined {
    return this.blocks.find((block) => block.choice.isCorrect);
  }
}
