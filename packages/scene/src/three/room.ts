/** The voxel room as 16 merged meshes, plus the volumetric look of the spotlight rig. */
import * as THREE from 'three';
import { EMISSIVE, mergeByMaterial, roughnessFor, type Box } from '../courtroom/geometry';

export interface RoomMeshes {
  group: THREE.Group;
  materials: Map<string, THREE.MeshStandardMaterial>;
  drawCalls: number;
}

export function buildRoom(boxes: readonly Box[]): RoomMeshes {
  const group = new THREE.Group();
  group.name = 'courtroom';
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  for (const batch of mergeByMaterial(boxes)) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(batch.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(batch.normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(batch.indices, 1));
    geometry.computeBoundingSphere();
    const emissive = EMISSIVE[batch.color];
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(batch.color),
      roughness: roughnessFor(batch.color),
      metalness: 0,
      flatShading: true,
      emissive: emissive ? new THREE.Color(batch.color) : new THREE.Color(0x000000),
      emissiveIntensity: emissive ?? 0,
    });
    material.name = batch.color;
    materials.set(batch.color, material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `room:${batch.color}`;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
  }
  return { group, materials, drawCalls: group.children.length };
}

/** A soft additive light cone from a rig position down to a target, for the "dramatic spotlight" look. */
export function lightCone(from: THREE.Vector3, to: THREE.Vector3, radius: number, color: THREE.ColorRepresentation): THREE.Mesh {
  const length = from.distanceTo(to);
  const geometry = new THREE.ConeGeometry(radius, length, 32, 1, true);
  geometry.translate(0, -length / 2, 0);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.07,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(geometry, material);
  cone.position.copy(from);
  cone.lookAt(to);
  cone.rotateX(-Math.PI / 2);
  cone.name = 'light-cone';
  return cone;
}
