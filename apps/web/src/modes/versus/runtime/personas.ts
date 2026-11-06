/**
 * Demo personas: who "you" are in this tab. Each tab gets its own persona (so
 * one browser can hold Side A, Side B and a juror at once); every persona made
 * on this device is remembered so you can pick yourself up again in a new tab.
 *
 * A persona is a demo wallet address plus the "human" the mock World ID
 * verifier proves. Nothing here is a real wallet or a real World ID.
 */
import { t } from '@/i18n';
import type { Hex } from '@cringe-court/core';
import type { Persona } from '@cringe-court/modes-versus';

const REGISTRY = 'cc:versus:personas';
const CURRENT = 'cc:versus:persona';

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** CSPRNG-backed [0, 1) for invite codes and ids. */
export function secureRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 2 ** 32;
}

export function listPersonas(storage: Storage = window.localStorage): Persona[] {
  try {
    const raw = storage.getItem(REGISTRY);
    const list = raw ? (JSON.parse(raw) as Persona[]) : [];
    return Array.isArray(list) ? list.filter((p) => p && typeof p.id === 'string' && /^0x[0-9a-f]{40}$/.test(p.account)) : [];
  } catch {
    return [];
  }
}

function saveRegistry(list: readonly Persona[], storage: Storage) {
  storage.setItem(REGISTRY, JSON.stringify(list));
}

export function createPersona(storage: Storage = window.localStorage): Persona {
  const list = listPersonas(storage);
  const persona: Persona = { id: `p-${randomHex(6)}`, name: t('versus.persona.defaultName', { n: list.length + 1 }), account: `0x${randomHex(20)}` as Hex };
  saveRegistry([...list, persona], storage);
  return persona;
}

/** This tab's persona, created on first use. */
export function tabPersona(session: Storage = window.sessionStorage, storage: Storage = window.localStorage): Persona {
  const id = session.getItem(CURRENT);
  const found = id ? listPersonas(storage).find((p) => p.id === id) : undefined;
  if (found) return found;
  const fresh = createPersona(storage);
  session.setItem(CURRENT, fresh.id);
  return fresh;
}

export function switchTabPersona(id: string, session: Storage = window.sessionStorage, storage: Storage = window.localStorage): Persona | null {
  const found = listPersonas(storage).find((p) => p.id === id);
  if (!found) return null;
  session.setItem(CURRENT, found.id);
  return found;
}

export function forgetPersonas(session: Storage = window.sessionStorage, storage: Storage = window.localStorage): void {
  storage.removeItem(REGISTRY);
  session.removeItem(CURRENT);
}

export function shortAccount(account: Hex): string {
  return `${account.slice(0, 6)}…${account.slice(-4)}`;
}
