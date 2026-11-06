/**
 * A small ICU MessageFormat subset, enough for UI copy:
 *   {name}                                   interpolation
 *   {count, plural, =0 {none} one {# vote} other {# votes}}
 *   {side, select, a {Side A} b {Side B} other {Either side}}
 * `#` inside a plural branch is the formatted count. Apostrophes are literal.
 */
export type MessageParams = Readonly<Record<string, string | number>>;

type Node = string | { arg: string } | { arg: string; kind: 'plural' | 'select'; branches: Record<string, Node[]> };

const cache = new Map<string, Node[]>();

function parse(src: string): Node[] {
  let i = 0;
  const parseUntil = (closer: boolean): Node[] => {
    const out: Node[] = [];
    let text = '';
    while (i < src.length) {
      const ch = src[i];
      if (ch === '{') {
        if (text) out.push(text), (text = '');
        i++;
        out.push(parseArg());
      } else if (ch === '}' && closer) {
        break;
      } else {
        text += ch;
        i++;
      }
    }
    if (text) out.push(text);
    return out;
  };
  const readUntil = (stops: string) => {
    const start = i;
    while (i < src.length && !stops.includes(src[i]!)) i++;
    return src.slice(start, i).trim();
  };
  const parseArg = (): Node => {
    const arg = readUntil(',}');
    if (src[i] === '}') {
      i++;
      return { arg };
    }
    i++; // ,
    const kind = readUntil(',}');
    if (kind !== 'plural' && kind !== 'select') throw new Error(`Unsupported message argument type "${kind}" in: ${src}`);
    i++; // ,
    const branches: Record<string, Node[]> = {};
    for (;;) {
      const key = readUntil('{}');
      if (src[i] === '}') {
        i++;
        break;
      }
      if (!key) throw new Error(`Empty branch selector in: ${src}`);
      i++; // {
      branches[key] = parseUntil(true);
      if (src[i] !== '}') throw new Error(`Unclosed branch "${key}" in: ${src}`);
      i++;
    }
    if (!branches.other) throw new Error(`Missing "other" branch for {${arg}} in: ${src}`);
    return { arg, kind, branches };
  };
  const nodes = parseUntil(false);
  return nodes;
}

export function compile(message: string): Node[] {
  let nodes = cache.get(message);
  if (!nodes) {
    nodes = parse(message);
    cache.set(message, nodes);
  }
  return nodes;
}

export function formatMessage(message: string, params: MessageParams | undefined, locale: string): string {
  const nodes = compile(message);
  const plural = new Intl.PluralRules(locale);
  const number = new Intl.NumberFormat(locale);
  const render = (list: Node[], hash?: string): string =>
    list
      .map((n) => {
        if (typeof n === 'string') return hash === undefined ? n : n.replaceAll('#', hash);
        const value = params?.[n.arg];
        if (!('kind' in n)) {
          if (value === undefined) {
            if (import.meta.env.DEV) console.warn(`[i18n] missing param {${n.arg}} in "${message}"`);
            return `{${n.arg}}`;
          }
          return typeof value === 'number' ? number.format(value) : value;
        }
        if (n.kind === 'plural') {
          const count = Number(value ?? 0);
          const exact = n.branches[`=${count}`];
          const branch = exact ?? n.branches[plural.select(count)] ?? n.branches.other!;
          return render(branch, number.format(count));
        }
        return render(n.branches[String(value)] ?? n.branches.other!);
      })
      .join('');
  return render(nodes);
}

/** Names of every argument a message expects (used by the catalog tests). */
export function messageArgs(message: string): string[] {
  const names = new Set<string>();
  const walk = (list: Node[]) => {
    for (const n of list) {
      if (typeof n === 'string') continue;
      names.add(n.arg);
      if ('kind' in n) Object.values(n.branches).forEach(walk);
    }
  };
  walk(compile(message));
  return [...names];
}

/** Rewrites only the literal copy of a message, keeping its arguments and branches. */
export function mapMessageText(message: string, fn: (text: string) => string): string {
  const out = (list: Node[]): string =>
    list
      .map((n) => {
        if (typeof n === 'string') return fn(n);
        if (!('kind' in n)) return `{${n.arg}}`;
        const branches = Object.entries(n.branches)
          .map(([k, v]) => `${k} {${out(v)}}`)
          .join(' ');
        return `{${n.arg}, ${n.kind}, ${branches}}`;
      })
      .join('');
  return out(compile(message));
}
