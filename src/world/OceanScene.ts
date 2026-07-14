import * as THREE from 'three';
import type { IslandDefinition } from '../types';
import { BoatController } from './BoatController';
import { CameraController } from './CameraController';
import { ChoiceBlockManager } from './ChoiceBlockManager';
import { CollisionManager } from './CollisionManager';
import { IslandManager } from './IslandManager';
import { MonsterManager } from './MonsterManager';
import { ParticleManager } from './ParticleManager';
import { PlayerController } from './PlayerController';
import { addBox } from './voxel';

export class OceanScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 620);
  readonly renderer: THREE.WebGLRenderer;
  readonly boat = new BoatController();
  readonly player = new PlayerController();
  readonly collisions = new CollisionManager(205);
  readonly islands: IslandManager;
  readonly choices = new ChoiceBlockManager();
  readonly particles = new ParticleManager();
  readonly monsters: MonsterManager;
  readonly cameraController: CameraController;
  private readonly waterGeometry: THREE.PlaneGeometry;
  private readonly waterBase: Float32Array;
  private readonly clouds = new THREE.Group();
  private elapsed = 0;

  constructor(canvas: HTMLCanvasElement, definitions: readonly IslandDefinition[]) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color(0x8bddeb);
    this.scene.fog = new THREE.Fog(0x9edfe5, 110, 345);
    this.islands = new IslandManager(definitions);
    this.collisions.setIslands(definitions);
    this.monsters = new MonsterManager(this.particles);

    this.waterGeometry = new THREE.PlaneGeometry(440, 440, 44, 44);
    this.waterGeometry.rotateX(-Math.PI / 2);
    const waterPosition = this.waterGeometry.getAttribute('position') as THREE.BufferAttribute;
    this.waterBase = new Float32Array(waterPosition.array as Float32Array);
    const waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x29afd0,
      roughness: 0.37,
      metalness: 0.05,
      flatShading: true,
      transparent: true,
      opacity: 0.93,
    });
    const water = new THREE.Mesh(this.waterGeometry, waterMaterial);
    water.name = 'wide-blocky-ocean';
    water.receiveShadow = true;
    this.scene.add(water);

    this.setupLights();
    this.createSkyDecor();
    this.scene.add(
      this.islands.group,
      this.boat.group,
      this.player.group,
      this.choices.group,
      this.particles.group,
      this.monsters.group,
      this.clouds,
    );
    this.cameraController = new CameraController(this.camera, this.islands.getLandMeshes());
    this.camera.position.set(0, 10, -12);
    this.resize();
  }

  updateEnvironment(delta: number): void {
    this.elapsed += delta;
    const attribute = this.waterGeometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = attribute.array as Float32Array;
    for (let index = 0; index < positions.length; index += 3) {
      const x = this.waterBase[index] ?? 0;
      const z = this.waterBase[index + 2] ?? 0;
      positions[index + 1] = (
        Math.sin(x * 0.09 + this.elapsed * 1.25) * 0.16
        + Math.cos(z * 0.075 - this.elapsed * 1.05) * 0.13
      );
    }
    attribute.needsUpdate = true;
    this.waterGeometry.computeVertexNormals();
    this.clouds.position.x = Math.sin(this.elapsed * 0.018) * 16;
    this.particles.update(delta);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  setShadowQuality(quality: 'off' | 'low' | 'high'): void {
    this.renderer.shadowMap.enabled = quality !== 'off';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 1.75 : 1.3));
  }

  dispose(): void {
    this.choices.clear();
    this.renderer.dispose();
    this.waterGeometry.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
  }

  private setupLights(): void {
    const hemisphere = new THREE.HemisphereLight(0xdffbff, 0x4f826d, 2.15);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(0xfff1c7, 3.2);
    sun.position.set(-48, 72, -36);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 190;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
  }

  private createSkyDecor(): void {
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(8, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe275, fog: false }),
    );
    sun.position.set(-82, 72, 118);
    this.scene.add(sun);

    const positions = [
      [-55, 34, -50], [30, 39, -82], [72, 31, -10], [-88, 28, 46], [5, 45, 72],
    ] as const;
    positions.forEach(([x, y, z], index) => {
      const cloud = new THREE.Group();
      addBox(cloud, [7, 2.5, 3.4], [0, 0, 0], 0xf7fffc);
      addBox(cloud, [4.3, 3.4, 3.2], [-2.5, 1.2, 0], 0xffffff);
      addBox(cloud, [4.8, 3, 3], [2.8, 0.8, 0.1], 0xf0fbf8);
      cloud.position.set(x, y, z);
      cloud.scale.setScalar(0.75 + (index % 3) * 0.15);
      this.clouds.add(cloud);
    });

    for (let index = 0; index < 18; index += 1) {
      const foam = new THREE.Mesh(
        new THREE.BoxGeometry(2.2 + (index % 3), 0.05, 0.25),
        new THREE.MeshBasicMaterial({ color: 0xbbeff0, transparent: true, opacity: 0.5 }),
      );
      foam.position.set(
        Math.sin(index * 5.7) * (25 + (index % 5) * 17),
        0.25,
        Math.cos(index * 4.3) * (18 + (index % 6) * 16),
      );
      foam.rotation.y = index * 1.2;
      this.scene.add(foam);
    }
  }
}
