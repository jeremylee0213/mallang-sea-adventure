import * as THREE from 'three';
import type { InputManager } from '../game/InputManager';

export interface CameraMovementBasis {
  readonly forward: THREE.Vector3;
  readonly right: THREE.Vector3;
}

const PLAYER_MIN_PITCH = 0.18;
const PLAYER_MAX_PITCH = 0.9;
const PLAYER_DEFAULT_PITCH = 0.42;
const PLAYER_DISTANCE = 8.8;

export class CameraController {
  private readonly desired = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private mode: 'boat' | 'player' = 'boat';
  private playerYawValue = Math.PI;
  private playerPitchValue = PLAYER_DEFAULT_PITCH;

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly colliders: readonly THREE.Object3D[],
  ) {}

  setMode(mode: 'boat' | 'player', immediate = false, focus?: THREE.Object3D): void {
    this.mode = mode;
    if (mode === 'player' && focus) this.playerYawValue = focus.rotation.y;
    if (immediate && focus) this.snap(focus);
  }

  get playerYaw(): number {
    return this.playerYawValue;
  }

  get playerPitch(): number {
    return this.playerPitchValue;
  }

  setPlayerOrientation(yaw: number, pitch = this.playerPitchValue): void {
    if (Number.isFinite(yaw)) this.playerYawValue = yaw;
    if (Number.isFinite(pitch)) {
      this.playerPitchValue = THREE.MathUtils.clamp(pitch, PLAYER_MIN_PITCH, PLAYER_MAX_PITCH);
    }
  }

  updatePlayerInput(delta: number, input: InputManager): void {
    if (this.mode !== 'player') return;
    const look = input.consumeLookDelta();
    const keyboardYaw = (input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('ArrowLeft') ? 1 : 0);
    const keyboardPitch = (input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('ArrowDown') ? 1 : 0);
    this.playerYawValue += look.x * 0.006 + keyboardYaw * 1.65 * delta;
    this.playerPitchValue = THREE.MathUtils.clamp(
      this.playerPitchValue - look.y * 0.004 + keyboardPitch * 1.05 * delta,
      PLAYER_MIN_PITCH,
      PLAYER_MAX_PITCH,
    );
  }

  getMovementBasis(): CameraMovementBasis {
    return {
      forward: new THREE.Vector3(Math.sin(this.playerYawValue), 0, Math.cos(this.playerYawValue)),
      right: new THREE.Vector3(Math.cos(this.playerYawValue), 0, -Math.sin(this.playerYawValue)),
    };
  }

  update(delta: number, focus: THREE.Object3D, heading: number): void {
    const focusPosition = focus.getWorldPosition(new THREE.Vector3());
    const cameraHeading = this.mode === 'boat' ? heading : this.playerYawValue;
    const distance = this.mode === 'boat' ? 12.5 : PLAYER_DISTANCE;
    const horizontalDistance = this.mode === 'boat'
      ? distance
      : Math.cos(this.playerPitchValue) * distance;
    const height = this.mode === 'boat' ? 8.4 : Math.sin(this.playerPitchValue) * distance + 2;
    const targetHeight = this.mode === 'boat' ? 1.4 : 2.0;
    this.target.set(focusPosition.x, focusPosition.y + targetHeight, focusPosition.z);
    this.desired.set(
      focusPosition.x - Math.sin(cameraHeading) * horizontalDistance,
      focusPosition.y + height,
      focusPosition.z - Math.cos(cameraHeading) * horizontalDistance,
    );
    this.resolveCameraCollision();
    const lambda = this.mode === 'boat' ? 4.2 : 7.5;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.desired.x, lambda, delta);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.desired.y, lambda, delta);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.desired.z, lambda, delta);
    this.camera.lookAt(this.target);
  }

  snap(focus: THREE.Object3D): void {
    const cameraHeading = this.mode === 'boat' ? focus.rotation.y : this.playerYawValue;
    const focusPosition = focus.getWorldPosition(new THREE.Vector3());
    const distance = this.mode === 'boat' ? 12.5 : PLAYER_DISTANCE;
    const horizontalDistance = this.mode === 'boat'
      ? distance
      : Math.cos(this.playerPitchValue) * distance;
    const height = this.mode === 'boat' ? 8.4 : Math.sin(this.playerPitchValue) * distance + 2;
    const targetHeight = this.mode === 'boat' ? 1.4 : 2.0;
    this.target.set(focusPosition.x, focusPosition.y + targetHeight, focusPosition.z);
    this.desired.set(
      focusPosition.x - Math.sin(cameraHeading) * horizontalDistance,
      focusPosition.y + height,
      focusPosition.z - Math.cos(cameraHeading) * horizontalDistance,
    );
    this.resolveCameraCollision();
    this.camera.position.copy(this.desired);
    this.camera.lookAt(this.target);
  }

  private resolveCameraCollision(): void {
    const direction = this.desired.clone().sub(this.target);
    const distance = direction.length();
    if (distance <= 0.01) return;
    this.raycaster.set(this.target, direction.normalize());
    this.raycaster.far = distance;
    const hits = this.raycaster.intersectObjects([...this.colliders], false);
    const hit = hits[0];
    if (!hit || hit.distance >= distance) return;
    const safeDistance = Math.max(3.2, hit.distance - 1.1);
    this.desired.copy(this.target).add(direction.normalize().multiplyScalar(safeDistance));
    this.desired.y = Math.max(this.desired.y, this.target.y + 2.8);
  }
}
