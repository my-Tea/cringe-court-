import { backend } from './messages/en/backend';
import { common } from './messages/en/common';
import { domain } from './messages/en/domain';
import { ds } from './messages/en/ds';
import { grandJury } from './messages/en/grandJury';
import { shell } from './messages/en/shell';
import { solo } from './messages/en/solo';
import { trial } from './messages/en/trial';
import { versus } from './messages/en/versus';

/**
 * The source catalog. English is the reference locale: every other locale is
 * a `LocaleMessages` (same namespaces and keys, any wording).
 */
export const en = { common, shell, ds, trial, solo, versus, grandJury, domain, backend } as const;

export type Catalog = typeof en;
export type Namespace = keyof Catalog;
export type MessageKey = { [N in Namespace]: `${N}.${Extract<keyof Catalog[N], string>}` }[Namespace];
export type LocaleMessages = { readonly [N in Namespace]: { readonly [K in keyof Catalog[N]]: string } };

export function lookup(messages: LocaleMessages, key: MessageKey): string | undefined {
  const dot = key.indexOf('.');
  const ns = messages[key.slice(0, dot) as Namespace] as Readonly<Record<string, string>> | undefined;
  return ns?.[key.slice(dot + 1)];
}

/** Every key in a catalog, for tests and tooling. */
export function allKeys(messages: LocaleMessages): MessageKey[] {
  return (Object.keys(messages) as Namespace[]).flatMap((ns) => Object.keys(messages[ns]).map((k) => `${ns}.${k}` as MessageKey));
}
