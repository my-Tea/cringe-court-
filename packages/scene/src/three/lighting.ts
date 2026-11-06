/**
 * Lighting rig with moods. The renders in cc-art have no lights ("the mood is
 * yours to finish", SCENE-GUIDE): this adds the three spotlights from the
 * `spotlight_rig` instances, warm sconce fill, and per-beat moods that blend
 * smoothly (house → spotlight → tense → guilty red / acquitted green / mistrial grey).
 */
import type { LightingMood } from '@cringe-court/core';
import * as THREE from 'three';
import type { PropInstance } from '../courtroom/layout';
import { lightCone } from './room';

interface MoodSpec {
  ambient: number;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  key: number;
  spot: number;
  spotColor: string;
  fog: string;
  cone: number;
}

export const MOODS: Readonly<Record<LightingMood, MoodSpec>> = {
  house: { ambient: 0.55, hemiSky: '#FFF2C7', hemiGround: '#4A3A32', hemi: 1.1, key: 1.4, spot: 0.6, spotColor: '#FFF2C7', fog: '#1a1320', cone: 0.03 },
  spotlight: { ambient: 0.28, hemiSky: '#FFD79A', hemiGround: '#2a1d24', hemi: 0.65, key: 0.7, spot: 2.6, spotColor: '#FFF2C7', fog: '#120c16', cone: 0.08 },
  tense: { ambient: 0.22, hemiSky: '#BDF5FF', hemiGround: '#1d1424', hemi: 0.5, key: 0.55, spot: 2.2, spotColor: '#BDF5FF', fog: '#0d0a14', cone: 0.09 },
  guilty: { ambient: 0.3, hemiSky: '#CE4A44', hemiGround: '#3a0d16', hemi: 0.85, key: 0.6, spot: 2.8, spotColor: '#FF6B5E', fog: '#1e0709', cone: 0.11 },
  acquitted: { ambient: 0.38, hemiSky: '#A9D98F', hemiGround: '#1F5B3A', hemi: 0.95, key: 0.9, spot: 2.6, spotColor: '#DFF3D6', fog: '#0b1a12', cone: 0.1 },
  mistrial: { ambient: 0.34, hemiSky: '#A9917D', hemiGround: '#4A3A32', hemi: 0.7, key: 0.6, spot: 1.4, spotColor: '#DCC8B0', fog: '#17141a', cone: 0.05 },
  blackout: { ambient: 0.04, hemiSky: '#2a1d24', hemiGround: '#000000', hemi: 0.08, key: 0, spot: 0, spotColor: '#FFF2C7', fog: '#050307', cone: 0 },
};

/** Where each rig points: bench, well, the two counsel desks. */
const SPOT_TARGETS: readonly THREE.Vector3[] = [new THREE.Vector3(-56, 0, -22), new THREE.Vector3(56, 0, -22), new THREE.Vector3(0, 21, -62)];

export class LightingRig {
  readonly object = new THREE.Group();
  readonly fog = new THREE.Fog('#1a1320', 160, 420);
  readonly #ambient = new THREE.AmbientLight('#ffffff', 0.5);
  readonly #hemi = new THREE.HemisphereLight('#FFF2C7', '#4A3A32', 1);
  readonly #key = new THREE.DirectionalLight('#FFF2C7', 1.2);
  readonly #spots: THREE.SpotLight[] = [];
  readonly #cones: THREE.Mesh[] = [];
  #from: MoodSpec = MOODS.house;
  #to: MoodSpec = MOODS.house;
  #t = 1;
  #duration = 0;
  #flash = 0;
  mood: LightingMood = 'house';

  constructor(props: readonly PropInstance[]) {
    this.object.name = 'lighting';
    this.#key.position.set(40, 120, 90);
    this.object.add(this.#ambient, this.#hemi, this.#key);
    const rigs = props.filter((p) => p.prop === 'spotlight_rig');
    rigs.forEach((rig, i) => {
      const target = SPOT_TARGETS[i % SPOT_TARGETS.length]!;
      const spot = new THREE.SpotLight('#FFF2C7', 2, 260, Math.PI / 9, 0.55, 1.2);
      spot.position.set(rig.pos[0], rig.pos[1] - 2, rig.pos[2]);
      spot.target.position.copy(target);
      this.#spots.push(spot);
      const cone = lightCone(spot.position, target, 16, '#FFF2C7');
      this.#cones.push(cone);
      this.object.add(spot, spot.target, cone);
    });
    // Warm fill from the sconces along the walls.
    for (const s of props.filter((p) => p.prop === 'sconce').slice(0, 6)) {
      const light = new THREE.PointLight('#FFD79A', 18, 70, 2);
      light.position.set(s.pos[0] * 0.96, s.pos[1] + 14, s.pos[2]);
      this.object.add(light);
    }
    this.#apply(MOODS.house);
  }

  get spotCount(): number {
    return this.#spots.length;
  }

  set(mood: LightingMood, seconds = 0.8): void {
    this.#from = this.#current();
    this.#to = MOODS[mood];
    this.#t = 0;
    this.#duration = Math.max(0, seconds);
    this.mood = mood;
    if (this.#duration === 0) {
      this.#t = 1;
      this.#apply(this.#to);
    }
  }

  /** A white pop (flash fx, gavel strike). */
  flash(): void {
    this.#flash = 1;
  }

  update(dt: number): void {
    if (this.#t < 1) {
      this.#t = Math.min(1, this.#t + dt / (this.#duration || 1));
      this.#apply(this.#current());
    }
    if (this.#flash > 0) {
      this.#flash = Math.max(0, this.#flash - dt * 4);
      this.#ambient.intensity = this.#mix(this.#from.ambient, this.#to.ambient) + this.#flash * 2.5;
    }
  }

  #mix(a: number, b: number): number {
    const k = this.#t * this.#t * (3 - 2 * this.#t);
    return a + (b - a) * k;
  }

  #current(): MoodSpec {
    if (this.#t >= 1) return this.#to;
    const c = (a: string, b: string) => `#${new THREE.Color(a).lerp(new THREE.Color(b), this.#t).getHexString()}`;
    return {
      ambient: this.#mix(this.#from.ambient, this.#to.ambient),
      hemiSky: c(this.#from.hemiSky, this.#to.hemiSky),
      hemiGround: c(this.#from.hemiGround, this.#to.hemiGround),
      hemi: this.#mix(this.#from.hemi, this.#to.hemi),
      key: this.#mix(this.#from.key, this.#to.key),
      spot: this.#mix(this.#from.spot, this.#to.spot),
      spotColor: c(this.#from.spotColor, this.#to.spotColor),
      fog: c(this.#from.fog, this.#to.fog),
      cone: this.#mix(this.#from.cone, this.#to.cone),
    };
  }

  #apply(m: MoodSpec): void {
    this.#ambient.intensity = m.ambient;
    this.#hemi.color.set(m.hemiSky);
    this.#hemi.groundColor.set(m.hemiGround);
    this.#hemi.intensity = m.hemi;
    this.#key.intensity = m.key;
    for (const s of this.#spots) {
      s.intensity = m.spot * 900;
      s.color.set(m.spotColor);
    }
    for (const c of this.#cones) {
      const mat = c.material as THREE.MeshBasicMaterial;
      mat.opacity = m.cone;
      mat.color.set(m.spotColor);
      c.visible = m.cone > 0.001;
    }
    this.fog.color.set(m.fog);
  }
}
