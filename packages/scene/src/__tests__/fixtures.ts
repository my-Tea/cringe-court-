import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { COURTROOM_URLS } from '../assets';
import type { CourtroomData } from '../load';
import { loadCourtroomData } from '../load';

/** The real generated assets, read from disk through the same URLs the app uses. */
export const readJson = async (url: string) => JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as unknown;

let cached: Promise<CourtroomData> | null = null;
export function realData(): Promise<CourtroomData> {
  cached ??= loadCourtroomData(readJson);
  return cached;
}

export const rawAnimations = () => readJson(COURTROOM_URLS.animations);
