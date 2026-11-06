/**
 * Finds user-visible copy written straight into TSX instead of going through
 * the message catalog (src/i18n). Used by src/i18n/hardcoded.test.ts and by hand:
 *
 *   npx tsx scripts/find-hardcoded.ts [dir-or-file ...]   (CLI wrapper)
 *
 * Flags JSX text, string literals rendered as JSX children, and string literals
 * passed to text-bearing props (aria-label, title, placeholder, alt, label,
 * *Label, *Text, *Title, ...). Literals inside t()/tRich() calls are keys, not
 * copy. Escape hatch for genuinely untranslatable text (a brand glyph, a key
 * cap): put `i18n-ignore` in a comment on the same or previous line.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

export interface Hardcoded {
  file: string;
  line: number;
  text: string;
  kind: 'jsx-text' | 'jsx-child' | 'prop';
}

const TEXT_PROPS = new Set([
  'aria-label', 'aria-description', 'aria-roledescription', 'aria-valuetext', 'aria-placeholder',
  'title', 'placeholder', 'alt', 'label', 'heading', 'description', 'hint', 'eyebrow', 'caption',
  'subtitle', 'tagline', 'message', 'details', 'tooltip', 'content', 'legend', 'summary', 'speaker', 'name',
]);
const TEXT_PROP_SUFFIX = /(Label|Text|Title|Message|Hint|Heading|Caption|Description|Copy|Placeholder|Tooltip)$/;
const TRANSLATE_FNS = new Set(['t', 'tRich']);
/** Copy is a word of 2+ letters; class names, ids and keys never contain spaces and are lowercase/kebab. */
const looksLikeCopy = (s: string) => {
  const v = s.trim();
  if (!/[A-Za-z]{2,}/.test(v)) return false;
  if (/^[a-z0-9]+([-_:./][a-z0-9]+)*$/.test(v)) return false; // css-ish tokens, ids, urls, keys
  if (/^(https?:|mailto:|\/|#|\.|data:)/.test(v)) return false;
  return true;
};

export function scanSource(file: string, source: string): Hardcoded[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines = source.split('\n');
  const ignored = (pos: number) => {
    const line = sf.getLineAndCharacterOfPosition(pos).line;
    return /i18n-ignore/.test(lines[line] ?? '') || /i18n-ignore/.test(lines[line - 1] ?? '');
  };
  const out: Hardcoded[] = [];
  const report = (node: ts.Node, text: string, kind: Hardcoded['kind']) => {
    if (ignored(node.getStart(sf))) return;
    out.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text: text.trim().replace(/\s+/g, ' ').slice(0, 80), kind });
  };
  const insideTranslate = (node: ts.Node): boolean => {
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && TRANSLATE_FNS.has(p.expression.text)) return true;
      if (ts.isJsxAttribute(p) || ts.isJsxExpression(p) || ts.isJsxElement(p)) {
        if (!ts.isJsxExpression(p)) return false;
      }
    }
    return false;
  };
  /** Every copy-like literal inside an expression, skipping keys passed to t(). */
  const literalsIn = (expr: ts.Node, kind: Hardcoded['kind']) => {
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && TRANSLATE_FNS.has(n.expression.text)) return;
      // Comparisons and object keys are logic, not copy.
      if (ts.isBinaryExpression(n) && /^(===|!==|==|!=)$/.test(n.operatorToken.getText(sf))) return;
      if (ts.isElementAccessExpression(n)) return;
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return; // visited by the main walk
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && looksLikeCopy(n.text) && !insideTranslate(n)) report(n, n.text, kind);
      if (ts.isTemplateExpression(n)) {
        const parts = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(' ');
        if (looksLikeCopy(parts) && /\s/.test(parts.trim()) && !insideTranslate(n)) report(n, n.getText(sf), kind);
      }
      ts.forEachChild(n, visit);
    };
    visit(expr);
  };
  const walk = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      if (looksLikeCopy(node.text) || /[A-Za-z]{2,}/.test(node.text)) report(node, node.text, 'jsx-text');
    } else if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      literalsIn(node.expression, 'jsx-child');
    } else if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      if (TEXT_PROPS.has(name) || TEXT_PROP_SUFFIX.test(name)) {
        const init = node.initializer;
        if (init && ts.isStringLiteral(init)) {
          if (looksLikeCopy(init.text) && !ignored(init.getStart(sf))) report(init, init.text, 'prop');
        } else if (init && ts.isJsxExpression(init) && init.expression) {
          literalsIn(init.expression, 'prop');
        }
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return out;
}

const SKIP = /(\.test\.tsx?$|\.d\.ts$|\/test\/|\/i18n\/|\/gallery\/)/;

export function scanPaths(paths: string[], root = process.cwd()): Hardcoded[] {
  const files: string[] = [];
  const collect = (p: string) => {
    const st = statSync(p);
    if (st.isDirectory()) readdirSync(p).forEach((c) => collect(join(p, c)));
    else if (p.endsWith('.tsx') && !SKIP.test(p)) files.push(p);
  };
  paths.forEach(collect);
  return files.flatMap((f) => scanSource(relative(root, f), readFileSync(f, 'utf8')));
}

