import * as THREE from 'three';

const geometryCache = new Map<string, THREE.BoxGeometry>();

export function box(
  width: number,
  height: number,
  depth: number,
  color: THREE.ColorRepresentation,
  options: { roughness?: number; metalness?: number } = {},
): THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> {
  const key = `${width}:${height}:${depth}`;
  let geometry = geometryCache.get(key);
  if (!geometry) {
    geometry = new THREE.BoxGeometry(width, height, depth);
    geometryCache.set(key, geometry);
  }
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.86,
    metalness: options.metalness ?? 0,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function addBox(
  group: THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  color: THREE.ColorRepresentation,
): THREE.Mesh {
  const mesh = box(size[0], size[1], size[2], color);
  mesh.position.set(position[0], position[1], position[2]);
  group.add(mesh);
  return mesh;
}

export function createTextTexture(
  primary: string,
  secondary = '',
  options: { background?: string; foreground?: string; accent?: string; size?: number } = {},
): THREE.CanvasTexture {
  const size = options.size ?? 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');

  context.fillStyle = options.background ?? '#fff9dc';
  context.fillRect(0, 0, size, size);
  context.strokeStyle = options.accent ?? '#1d8ca8';
  context.lineWidth = size * 0.045;
  context.strokeRect(size * 0.045, size * 0.045, size * 0.91, size * 0.91);
  context.fillStyle = options.foreground ?? '#173c4b';
  const primarySize = primary.length > 3 ? size * 0.28 : size * 0.46;
  context.font = `900 ${primarySize}px "Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(primary, size / 2, secondary ? size * 0.43 : size / 2, size * 0.84);

  if (secondary) {
    context.fillStyle = '#c85f4d';
    context.font = `800 ${size * 0.09}px "Apple SD Gothic Neo", sans-serif`;
    context.fillText(secondary, size / 2, size * 0.79, size * 0.78);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createLabelSprite(
  text: string,
  foreground = '#17485a',
  background = 'rgba(255,253,238,0.94)',
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  context.fillStyle = background;
  context.roundRect(8, 8, 496, 112, 24);
  context.fill();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 10;
  context.stroke();
  context.fillStyle = foreground;
  context.font = '900 48px "Apple SD Gothic Neo", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 256, 66, 460);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(8, 2, 1);
  sprite.renderOrder = 10;
  return sprite;
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite)) return;
    const mesh = object as THREE.Mesh;
    if (mesh.geometry && ![...geometryCache.values()].includes(mesh.geometry as THREE.BoxGeometry)) {
      mesh.geometry.dispose();
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      const withMap = material as THREE.Material & { map?: THREE.Texture | null };
      withMap.map?.dispose();
      material.dispose();
    }
  });
}
