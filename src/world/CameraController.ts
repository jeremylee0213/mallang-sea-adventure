import * as THREE from 'three';

export class CameraController {
  private readonly desired = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private mode: 'boat' | 'player' = 'boat';

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly colliders: readonly THREE.Object3D[],
  ) {}

  setMode(mode: 'boat' | 'player', immediate = false, focus?: THREE.Object3D): void {
    this.mode = mode;
    if (immediate && focus) this.snap(focus);
  }

  update(delta: number, focus: THREE.Object3D, heading: number): void {
    const focusPosition = focus.getWorldPosition(new THREE.Vector3());
    const cameraHeading = this.mode === 'boat' ? heading : heading + 0.9;
    const distance = this.mode === 'boat' ? 12.5 : 8.2;
    const height = this.mode === 'boat' ? 8.4 : 5.5;
    const targetHeight = this.mode === 'boat' ? 1.4 : 2.0;
    this.target.set(focusPosition.x, focusPosition.y + targetHeight, focusPosition.z);
    this.desired.set(
      focusPosition.x - Math.sin(cameraHeading) * distance,
      focusPosition.y + height,
      focusPosition.z - Math.cos(cameraHeading) * distance,
    );
    this.resolveCameraCollision();
    const lambda = this.mode === 'boat' ? 4.2 : 7.5;
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.desired.x, lambda, delta);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.desired.y, lambda, delta);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.desired.z, lambda, delta);
    this.camera.lookAt(this.target);
  }

  snap(focus: THREE.Object3D): void {
    const heading = focus.rotation.y;
    const cameraHeading = this.mode === 'boat' ? heading : heading + 0.9;
    const focusPosition = focus.getWorldPosition(new THREE.Vector3());
    const distance = this.mode === 'boat' ? 12.5 : 8.2;
    const height = this.mode === 'boat' ? 8.4 : 5.5;
    this.camera.position.set(
      focusPosition.x - Math.sin(cameraHeading) * distance,
      focusPosition.y + height,
      focusPosition.z - Math.cos(cameraHeading) * distance,
    );
    this.camera.lookAt(focusPosition.x, focusPosition.y + 1.5, focusPosition.z);
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
