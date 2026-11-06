import { Fragment, type ReactNode } from 'react';
import type { MessageKey } from './catalog';
import type { MessageParams } from './format';
import { t } from './runtime';

type Tags = Readonly<Record<string, (chunk: ReactNode) => ReactNode>>;

const TAG = /<(\w+)>([\s\S]*?)<\/\1>/g;

/**
 * Translates a message that wraps parts of its copy in tags, e.g.
 * `"Read the <rules>house rules</rules> first."`, mapping each tag to an element
 * so translators can move the link without touching code.
 */
export function tRich(key: MessageKey, tags: Tags, params?: MessageParams): ReactNode {
  const text = t(key, params);
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const render = tags[m[1]!];
    out.push(<Fragment key={m.index}>{render ? render(m[2]) : m[2]}</Fragment>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
