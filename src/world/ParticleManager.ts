import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  spin: number;
}

export class ParticleManager {
  readonly group = new THREE.Group();
  private readonly particles: Particle[] = [];
  private readonly starGeometry = this.createStarGeometry();
  private readonly colors = [0xffd75a, 0xff8a72, 0x65d5d2, 0xffffff, 0x8ec6f0];
  private cursor = 0;

  constructor(private readonly maxParticles = 90) {
    this.group.name = 'soft-particles';
    for (let index = 0; index < maxParticles; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: this.colors[index % this.colors.length],
        transparent: true,
        depthWrite: false,
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
      });
    }
  }

  burst(position: THREE.Vector3, count = 12, color?: THREE.ColorRepresentation): void {
    for (let index = 0; index < Math.min(count, this.maxParticles); index += 1) {
      const particle = this.particles[this.cursor % this.particles.length];
      this.cursor += 1;
      if (!particle) continue;
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

  update(delta: number): void {
    for (const particle of this.particles) {
      if (particle.life <= 0) continue;
      particle.life -= delta;
      particle.velocity.y -= 4.5 * delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.mesh.rotation.z += particle.spin * delta;
      particle.mesh.material.opacity = Math.max(0, particle.life / particle.maxLife);
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
}
