import { BASE_MODES, type SceneSignal } from '@cringe-court/core';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CLOSE_UPS, CourtroomRuntime, asScenePort } from '../index';
import { realData } from './fixtures';

async function runtime(reducedMotion = false) {
  const data = await realData();
  const textures = Object.fromEntries(Object.keys(data.atlas.characters).map((c) => [c, new THREE.Texture()]));
  const timers: (() => void)[] = [];
  const rt = new CourtroomRuntime({ data, textures, reducedMotion, random: () => 0.5, setTimer: (fn) => timers.push(fn) });
  const def = BASE_MODES.solo;
  rt.setCast(def.staging(def.terms()));
  const signals: SceneSignal[] = [];
  rt.subscribe((s) => signals.push(s));
  return { rt, signals, timers, port: asScenePort(rt) };
}

const run = (rt: CourtroomRuntime, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 30) rt.update(1 / 30);
};

describe('CourtroomRuntime (headless three.js)', () => {
  it('builds 16 room draw calls, 3 spotlights and the Solo cast on their marks', async () => {
    const { rt } = await runtime();
    expect(rt.drawCalls).toBe(16);
    expect(rt.lighting.spotCount).toBe(3);
    expect(rt.actors).toEqual(expect.arrayContaining(['judge', 'prosecutor', 'defense', 'creator', 'juror-1', 'juror-3']));
    expect(rt.actor('judge')!.sprite.object.position.toArray()).toEqual([0, 21, -62]);
    expect(rt.actor('juror-1')!.animator.animation).toBe('seated_idle');
  });

  it('resolves animate() when the one-shot ends and relays the callout', async () => {
    const { rt, signals, port } = await runtime();
    let done = false;
    void port.animate('prosecutor', 'objection').then(() => (done = true));
    run(rt, 0.5);
    expect(done).toBe(false);
    expect(signals).toContainEqual({ type: 'callout', text: 'OBJECTION!', style: 'objection', actor: 'prosecutor' });
    run(rt, 2);
    await Promise.resolve();
    expect(done).toBe(true);
    expect(rt.actor('prosecutor')!.sprite.frame).toBe('idle');
  });

  it('runs system timelines and binds their actions (ballot box, lighting, cards)', async () => {
    const { rt, signals, port } = await runtime();
    let done = false;
    void port.system('verdict_guilty').then(() => (done = true));
    run(rt, 3);
    await Promise.resolve();
    expect(done).toBe(true);
    const actions = signals.flatMap((s) => (s.type === 'action' ? [s.action] : []));
    expect(actions).toEqual(expect.arrayContaining(['gavel_strike', 'lighting_shift_red', 'card_guilty']));
    expect(rt.lighting.mood).toBe('guilty');
    expect(signals.some((s) => s.type === 'action' && s.sound === 'gavel')).toBe(true);
  });

  it('moves the camera smoothly, or cuts under reduced motion', async () => {
    const { rt, port } = await runtime();
    port.camera('close_judge', 1);
    run(rt, 0.5);
    const mid = rt.camera.position.clone();
    run(rt, 1);
    expect(rt.camera.position.distanceTo(new THREE.Vector3(...CLOSE_UPS.close_judge.pos))).toBeLessThan(2);
    expect(mid.distanceTo(rt.camera.position)).toBeGreaterThan(5);
    const reduced = await runtime(true);
    reduced.port.camera('close_defense', 1);
    reduced.rt.update(1 / 60);
    expect(reduced.rt.camera.position.distanceTo(new THREE.Vector3(...CLOSE_UPS.close_defense.pos))).toBeLessThan(0.01);
  });

  it('reports unknown actors and animations instead of throwing', async () => {
    const { signals, port } = await runtime();
    await port.animate('nobody', 'idle');
    await port.animate('judge', 'moonwalk');
    expect(signals.filter((s) => s.type === 'error')).toHaveLength(2);
  });

  it('falls back to a timer so promises settle when no frames run', async () => {
    const { timers, port } = await runtime();
    let done = false;
    void port.animate('defense', 'defeated').then(() => (done = true));
    timers.forEach((fn) => fn());
    await Promise.resolve();
    expect(done).toBe(true);
  });
});
