import { mapMessageText } from './format';

/**
 * Pseudo-locale (en-XA): accents every letter and pads the text by ~35 % so
 * untranslated strings and layouts that cannot grow stand out. Placeholders
 * and plural/select syntax are left intact so the message still formats.
 */
const MAP: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'đ', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
  n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ŧ', u: 'ü', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Đ', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ',
  N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ŧ', U: 'Ü', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
};

const accent = (s: string) => s.replace(/[A-Za-z]/g, (c) => MAP[c] ?? c);

export const PSEUDO_OPEN = '⟦';
export const PSEUDO_CLOSE = '⟧';

export function pseudoLocalize(message: string): string {
  const pad = '·'.repeat(Math.max(1, Math.round((message.length * 0.35) / 2)));
  return `${PSEUDO_OPEN}${mapMessageText(message, (text) => accent(text))} ${pad}${PSEUDO_CLOSE}`;
}
