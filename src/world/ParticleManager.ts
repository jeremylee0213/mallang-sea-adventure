import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  spin: number;
  kind: 'star' | 'flame';
}

export class ParticleManager {
  readonly group = new THREE.Group();
  private readonly particles: Particle[] = [];
  private readonly starGeometry = this.createStarGeometry();
  private readonly flameGeometry = this.createFlameGeometry();
  private readonly colors = [0xffd75a, 0xff8a72, 0x65d5d2, 0xffffff, 0x8ec6f0];
  private readonly flameColors = [0xff4f2e, 0xff8b32, 0xffd84e, 0xfff4a8];
  private cursor = 0;

  constructor(private readonly maxParticles = 90) {
    this.group.name = 'soft-particles';
    for (let index = 0; index < maxParticles; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: this.colors[index % this.colors.length],
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.starGeometry, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        spin: 1,
        kind: 'star',
      });
    }
  }

  burst(position: THREE.Vector3, count = 12, color?: THREE.ColorRepresentation): void {
    for (let index = 0; index < Math.min(count, this.maxParticles); index += 1) {
      const particle = this.particles[this.cursor % this.particles.length];
      this.cursor += 1;
      if (!particle) continue;
      particle.kind = 'star';
      particle.mesh.geometry = this.starGeometry;
      particle.mesh.material.blending = THREE.AdditiveBlending;
      const angle = (index / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 1.8 + Math.random() * 3;
      particle.mesh.position.copy(position);
      particle.mesh.position.y += 0.6;
      particle.mesh.scale.setScalar(0.35 + Math.random() * 0.35);
      particle.mesh.visible = true;
      particle.mesh.material.opacity = 1;
      particle.mesh.material.color.set(color ?? this.colors[(index + this.cursor) % this.colors.length] ?? 0xffffff);
      particle.velocity.set(Math.sin(angle) * speed, 2.2 + Math.random() * 3, Math.cos(angle) * speed);
      particle.life = 0.65 + Math.random() * 0.6;
      particle.maxLife = particle.life;
      particle.spin = (Math.random() - 0.5) * 8;
    }
  }

  emitBoostTrail(
    origin: THREE.Vector3,
    backward: THREE.Vector3,
    count = 1,
  ): void {
    const direction = backward.clone().setY(0).normalize();
    if (direction.lengthSq() === 0) direction.set(0, 0, -1);
    const side = new THREE.Vector3(-direction.z, 0, direction.x);
    for (let index = 0; index < Math.min(count, this.maxParticles); index += 1) {
      const particle = this.particles[this.cursor % this.particles.length];
      this.cursor += 1;
      if (!particle) continue;
      particle.kind = 'flame';
      particle.mesh.geometry = this.flameGeometry;
      particle.mesh.material.blending = THREE.NormalBlending;
      particle.mesh.position.copy(origin);
      particle.mesh.position.x += side.x * (Math.random() - 0.5) * 0.35;
      particle.mesh.position.y += (Math.random() - 0.5) * 0.16;
      particle.mesh.position.z += side.z * (Math.random() - 0.5) * 0.35;
      particle.mesh.scale.setScalar(0.62 + Math.random() * 0.32);
      particle.mesh.visible = true;
      particle.mesh.material.opacity = 0.9;
      particle.mesh.material.color.set(
        this.flameColors[(index + this.cursor) % this.flameColors.length] ?? 0xff9b38,
      );
      particle.velocity.copy(direction).multiplyScalar(3.2 + Math.random() * 3.2);
      particle.velocity.addScaledVector(side, (Math.random() - 0.5) * 1.5);
      particle.velocity.y = 0.35 + Math.random() * 0.8;
      particle.life = 0.36 + Math.random() * 0.18;
      particle.maxLife = particle.life;
      particle.spin = (Math.random() - 0.5) * 5;
    }
  }

  getActiveCount(kind?: Particle['kind']): number {
    return this.particles.filter((particle) => (
      particle.life > 0 && (kind === undefined || particle.kind === kind)
    )).length;
  }

  update(delta: number): void {
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      particle.life -= delta;
      particle.velocity.y += (particle.kind === 'flame' ? 0.55 : -4.5) * delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.mesh.rotation.z += particle.spin * delta;
      particle.mesh.material.opacity = Math.max(0, particle.life / particle.maxLife);
      if (particle.kind === 'flame') {
        particle.mesh.scale.multiplyScalar(Math.max(0.8, 1 - delta * 2.4));
      }
      if (particle.life <= 0) particle.mesh.visible = false;
    }
  }

  private createStarGeometry(): THREE.ShapeGeometry {
    const shape = new THREE.Shape();
    const points = 10;
    for (let index = 0; index < points; index += 1) {
      const radius = index % 2 === 0 ? 0.55 : 0.24;
      const angle = (index / points) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (index === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }

  private createFlameGeometry(): THREE.ShapeGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.8);
    shape.lineTo(0.42, 0.16);
    shape.lineTo(0.24, -0.62);
    shape.lineTo(0, -0.9);
    shape.lineTo(-0.24, -0.62);
    shape.lineTo(-0.42, 0.16);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }
}
