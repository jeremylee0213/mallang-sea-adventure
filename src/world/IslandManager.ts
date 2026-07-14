import * as THREE from 'three';
import type { IslandDefinition } from '../types';
import { addBox, createLabelSprite } from './voxel';

export type InteractionKind = 'npc' | 'chest' | 'language-sign' | 'marine-life';

export interface WorldInteraction {
  id: string;
  islandId: string;
  kind: InteractionKind;
  object: THREE.Object3D;
  used: boolean;
}

export interface IslandRuntime {
  definition: IslandDefinition;
  group: THREE.Group;
  land: THREE.Mesh;
  label: THREE.Sprite;
}

const THEME_COLORS: Record<IslandDefinition['theme'], { ground: number; side: number; accent: number }> = {
  start: { ground: 0x7ccc79, side: 0xdab86c, accent: 0x48a66e },
  volcanic: { ground: 0x71985c, side: 0x746d61, accent: 0xd76b45 },
  sakura: { ground: 0x82bd75, side: 0xd9bb79, accent: 0xf29aaf },
  'rocky-marine': { ground: 0x8fa59b, side: 0x6f7a78, accent: 0x65c9d0 },
  future: { ground: 0x9daaa9, side: 0x778281, accent: 0x8d9a99 },
};

export class IslandManager {
  readonly group = new THREE.Group();
  readonly islands: IslandRuntime[] = [];
  readonly interactions: WorldInteraction[] = [];
  private readonly sharedLandGeometry = new Map<number, THREE.CylinderGeometry>();

  constructor(definitions: readonly IslandDefinition[]) {
    this.group.name = 'island-world';
    for (const definition of definitions) {
      const runtime = this.createIsland(definition);
      this.islands.push(runtime);
      this.group.add(runtime.group);
    }
  }

  setStage(stage: number): void {
    for (const runtime of this.islands) {
      const unlocked = runtime.definition.explorable
        && (runtime.definition.unlockStage === null || stage >= runtime.definition.unlockStage);
      runtime.group.visible = runtime.definition.explorable || unlocked;
      runtime.group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if ('opacity' in material) {
            material.transparent = !unlocked;
            material.opacity = unlocked ? 1 : 0.45;
          }
        }
      });
      runtime.label.material.opacity = unlocked ? 1 : 0.6;
    }
  }

  findNearestInteraction(position: THREE.Vector3, maxDistance = 4.2): {
    interaction: WorldInteraction;
    distance: number;
  } | null {
    let nearest: { interaction: WorldInteraction; distance: number } | null = null;
    for (const interaction of this.interactions) {
      if (!interaction.object.visible) continue;
      const worldPosition = new THREE.Vector3();
      interaction.object.getWorldPosition(worldPosition);
      const distance = position.distanceTo(worldPosition);
      if (distance > maxDistance || (nearest && nearest.distance <= distance)) continue;
      nearest = { interaction, distance };
    }
    return nearest;
  }

  getLandMeshes(): THREE.Object3D[] {
    return this.islands.map((island) => island.land);
  }

  getIsland(id: string): IslandRuntime | undefined {
    return this.islands.find((island) => island.definition.id === id);
  }

  getUsedInteractionIds(): string[] {
    return this.interactions
      .filter((interaction) => interaction.used)
      .map((interaction) => interaction.id);
  }

  setUsedInteractionIds(ids: readonly string[]): void {
    const usedIds = new Set(ids);
    for (const interaction of this.interactions) {
      interaction.used = usedIds.has(interaction.id);
    }
  }

  private createIsland(definition: IslandDefinition): IslandRuntime {
    const colors = THEME_COLORS[definition.theme];
    const group = new THREE.Group();
    group.name = `island-${definition.id}`;
    group.position.set(definition.position.x, 0, definition.position.z);

    let landGeometry = this.sharedLandGeometry.get(definition.radius);
    if (!landGeometry) {
      landGeometry = new THREE.CylinderGeometry(definition.radius, definition.radius * 1.12, 2.2, 12, 1);
      this.sharedLandGeometry.set(definition.radius, landGeometry);
    }
    const landMaterial = new THREE.MeshStandardMaterial({
      color: colors.side,
      roughness: 0.92,
      flatShading: true,
    });
    const land = new THREE.Mesh(landGeometry, landMaterial);
    land.position.y = -0.45;
    land.receiveShadow = true;
    land.castShadow = true;
    group.add(land);

    const topGeometry = new THREE.CylinderGeometry(definition.radius * 0.94, definition.radius, 0.65, 12);
    const top = new THREE.Mesh(
      topGeometry,
      new THREE.MeshStandardMaterial({ color: colors.ground, roughness: 0.95, flatShading: true }),
    );
    top.position.y = 0.94;
    top.receiveShadow = true;
    top.castShadow = true;
    group.add(top);

    this.createDock(group, definition);
    this.createThemeDecor(group, definition, colors.accent);
    this.createContent(group, definition);

    const label = createLabelSprite(
      definition.unlockStage && !definition.explorable
        ? `🔒 ${definition.name}`
        : definition.name,
    );
    label.position.set(0, 7.4, 0);
    label.scale.set(Math.max(7, definition.name.length * 1.5), 2.2, 1);
    group.add(label);

    return { definition, group, land, label };
  }

  private createDock(group: THREE.Group, definition: IslandDefinition): void {
    const localX = definition.dock.x - definition.position.x;
    const localZ = definition.dock.z - definition.position.z;
    const towardCenter = new THREE.Vector2(-localX, -localZ).normalize();
    const length = 6.4;
    const dock = new THREE.Group();
    dock.position.set(localX + towardCenter.x * 1.4, 0.78, localZ + towardCenter.y * 1.4);
    dock.rotation.y = Math.atan2(towardCenter.x, towardCenter.y);
    for (let i = 0; i < 6; i += 1) {
      addBox(dock, [3.6, 0.28, 0.85], [0, 0, i * 0.85 - length / 2], 0xc9884d);
    }
    addBox(dock, [0.25, 1.8, 0.25], [-1.45, -0.5, -2.2], 0x76513b);
    addBox(dock, [0.25, 1.8, 0.25], [1.45, -0.5, -2.2], 0x76513b);
    group.add(dock);
  }

  private createThemeDecor(group: THREE.Group, definition: IslandDefinition, accent: number): void {
    const radius = definition.radius;
    if (definition.theme === 'volcanic') {
      const volcano = new THREE.Mesh(
        new THREE.ConeGeometry(Math.min(5, radius * 0.32), 6, 8, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x5c5e57, roughness: 1, flatShading: true }),
      );
      volcano.position.set(-2, 4.1, 2);
      volcano.castShadow = true;
      group.add(volcano);
      const crater = new THREE.Mesh(
        new THREE.CylinderGeometry(1.25, 1.25, 0.35, 8),
        new THREE.MeshBasicMaterial({ color: accent }),
      );
      crater.position.set(-2, 6.8, 2);
      group.add(crater);
      for (let i = 0; i < 9; i += 1) {
        addBox(group, [1.2, 0.9, 1.0], [
          Math.sin(i * 2.1) * (radius * 0.55),
          1.65,
          Math.cos(i * 1.7) * (radius * 0.48),
        ], i % 2 ? 0x66675f : 0x88867a);
      }
      this.createTree(group, radius * 0.45, -radius * 0.25, 0x5d9b55, 0x6d4d37);
      return;
    }

    if (definition.theme === 'sakura') {
      for (const [x, z] of [[-5, 3], [4, 4], [6, -3], [-6, -4]] as const) {
        this.createTree(group, x, z, accent, 0x79543e, true);
      }
      const gate = new THREE.Group();
      addBox(gate, [0.55, 4.6, 0.55], [-2.1, 3.2, 0], 0xd45d4c);
      addBox(gate, [0.55, 4.6, 0.55], [2.1, 3.2, 0], 0xd45d4c);
      addBox(gate, [5.6, 0.55, 0.7], [0, 5.2, 0], 0xe5705d);
      addBox(gate, [4.7, 0.35, 0.62], [0, 4.4, 0], 0xe5705d);
      gate.position.set(0, 0, -3);
      group.add(gate);
      return;
    }

    if (definition.theme === 'rocky-marine') {
      for (let i = 0; i < 12; i += 1) {
        const angle = (i / 12) * Math.PI * 2;
        addBox(group, [1 + (i % 3) * 0.3, 1.1 + (i % 2), 1.1], [
          Math.sin(angle) * radius * 0.55,
          1.8,
          Math.cos(angle) * radius * 0.55,
        ], i % 2 ? 0x7e908d : 0xa6b7b0);
      }
      const telescope = new THREE.Group();
      addBox(telescope, [0.45, 2.4, 0.45], [0, 2.3, 0], 0x8b6a4c);
      const tube = addBox(telescope, [0.65, 0.65, 2.2], [0, 3.7, 0.1], 0x50aab7);
      tube.rotation.x = -0.35;
      telescope.position.set(-1.5, 0, 1.2);
      group.add(telescope);
      return;
    }

    if (definition.theme === 'future') {
      addBox(group, [6, 0.6, 6], [0, 2, 0], 0xa5b3b1);
      addBox(group, [3, 5, 3], [0, 4.7, 0], 0xb8c3c2);
      return;
    }

    this.createTree(group, -5, 3, 0x4fa866, 0x79543e);
    this.createTree(group, 5, 1, 0x5dbd73, 0x79543e);
    this.createTree(group, -3, -5, 0x62b870, 0x79543e);
    const flag = new THREE.Group();
    addBox(flag, [0.22, 4.2, 0.22], [0, 3.1, 0], 0x79543e);
    addBox(flag, [2.1, 1.1, 0.15], [1, 4.55, 0], 0xffd45a);
    flag.position.set(1.5, 0, -2.5);
    group.add(flag);
  }

  private createTree(
    group: THREE.Group,
    x: number,
    z: number,
    leafColor: number,
    trunkColor: number,
    blossoms = false,
  ): void {
    const tree = new THREE.Group();
    addBox(tree, [0.75, 3.8, 0.75], [0, 2.7, 0], trunkColor);
    addBox(tree, [2.7, 1.8, 2.7], [0, 5, 0], leafColor);
    addBox(tree, [2.0, 1.5, 2.0], [-1.1, 4.6, 0.4], blossoms ? 0xf6b2c2 : leafColor);
    addBox(tree, [1.9, 1.45, 1.9], [1.05, 5.2, -0.3], blossoms ? 0xf49cb3 : leafColor);
    tree.position.set(x, 0, z);
    group.add(tree);
  }

  private createContent(group: THREE.Group, definition: IslandDefinition): void {
    if (definition.content.npc) {
      const npc = new THREE.Group();
      addBox(npc, [0.9, 1.2, 0.65], [0, 1.7, 0], 0xffca65);
      addBox(npc, [0.82, 0.82, 0.78], [0, 2.7, 0], 0xeeb988);
      addBox(npc, [1.0, 0.28, 0.9], [0, 3.2, 0], 0x4b99a5);
      addBox(npc, [0.12, 0.12, 0.05], [-0.2, 2.78, 0.41], 0x193e49);
      addBox(npc, [0.12, 0.12, 0.05], [0.2, 2.78, 0.41], 0x193e49);
      npc.position.set(-2.5, 0, -0.5);
      group.add(npc);
      this.interactions.push({
        id: `${definition.id}-npc`, islandId: definition.id, kind: 'npc', object: npc, used: false,
      });
    }

    if (definition.content.treasureChest || definition.content.mathQuiz) {
      const chest = new THREE.Group();
      addBox(chest, [2.1, 1.05, 1.45], [0, 1.55, 0], 0xbf7244);
      addBox(chest, [2.16, 0.4, 1.52], [0, 2.25, 0], 0xf0aa4e);
      addBox(chest, [0.38, 0.55, 0.18], [0, 1.9, 0.82], 0xffdf69);
      chest.position.set(3.2, 0, 1.8);
      group.add(chest);
      this.interactions.push({
        id: `${definition.id}-chest`, islandId: definition.id, kind: 'chest', object: chest, used: false,
      });
    }

    if (definition.content.languageSign) {
      const sign = new THREE.Group();
      addBox(sign, [0.3, 2.4, 0.3], [0, 2, 0], 0x74503c);
      addBox(sign, [3.1, 1.55, 0.3], [0, 3.3, 0], 0xf5dd9e);
      const label = createLabelSprite('ことば · 말 배우기');
      label.position.set(0, 3.35, 0.23);
      label.scale.set(3.1, 0.8, 1);
      sign.add(label);
      sign.position.set(-3.8, 0, 3.7);
      group.add(sign);
      this.interactions.push({
        id: `${definition.id}-sign`, islandId: definition.id, kind: 'language-sign', object: sign, used: false,
      });
    }

    if (definition.content.marineLife) {
      const life = new THREE.Group();
      addBox(life, [1.5, 0.55, 0.75], [0, 1.55, 0], 0x58c7cf);
      addBox(life, [0.55, 0.55, 0.4], [0.9, 1.55, 0], 0x58c7cf);
      addBox(life, [0.25, 0.25, 0.1], [1.1, 1.65, 0.23], 0x173c4b);
      life.position.set(2, 0, -2);
      group.add(life);
      this.interactions.push({
        id: `${definition.id}-marine`, islandId: definition.id, kind: 'marine-life', object: life, used: false,
      });
    }
  }
}
