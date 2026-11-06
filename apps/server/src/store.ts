/**
 * Durability behind one small interface: an append-only log of records.
 *
 * Both games are event-sourced, so a log is the whole persistence story: the
 * Versus fact log *is* the case state, and the Grand Jury court is rebuilt by
 * replaying its command log over the seeded world. Node 20 has no built-in
 * SQLite (node:sqlite arrived in 22.5), so the durable adapter is a JSON-lines
 * file per stream, written with appendFileSync (one line per record, flushed
 * before the request answers). Swapping in SQLite later means implementing
 * `DurableLog` again; nothing else changes.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { decodeWire, encodeWire } from '@cringe-court/net';

export interface DurableLog<T> {
  readAll(): T[];
  append(record: T): void;
}

export interface Storage {
  log<T>(name: string): DurableLog<T>;
  /** A server secret that survives restarts (HMAC key), created on first use. */
  secret(): string;
  readonly durable: boolean;
}

export class MemoryLog<T> implements DurableLog<T> {
  readonly #records: T[] = [];
  readAll(): T[] {
    return [...this.#records];
  }
  append(record: T): void {
    this.#records.push(record);
  }
}

export class MemoryStorage implements Storage {
  readonly durable = false;
  readonly #logs = new Map<string, MemoryLog<unknown>>();
  #secret = randomBytes(32).toString('base64url');

  log<T>(name: string): DurableLog<T> {
    let l = this.#logs.get(name);
    if (!l) this.#logs.set(name, (l = new MemoryLog()));
    return l as DurableLog<T>;
  }

  secret(): string {
    return this.#secret;
  }
}

/** One JSON-lines file per log. A torn last line (crash mid-write) is skipped, not fatal. */
export class FileLog<T> implements DurableLog<T> {
  constructor(readonly path: string) {}

  readAll(): T[] {
    if (!existsSync(this.path)) return [];
    const out: T[] = [];
    const lines = readFileSync(this.path, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!line.trim()) return;
      try {
        out.push(decodeWire<T>(line));
      } catch {
        if (i < lines.length - 2) throw new Error(`${this.path}: line ${i + 1} is damaged`);
      }
    });
    return out;
  }

  append(record: T): void {
    appendFileSync(this.path, `${encodeWire(record)}\n`, { mode: 0o600 });
  }
}

export class FileStorage implements Storage {
  readonly durable = true;
  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  log<T>(name: string): DurableLog<T> {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Bad log name ${name}`);
    return new FileLog<T>(join(this.dir, `${name}.jsonl`));
  }

  secret(): string {
    const path = join(this.dir, 'secret.key');
    if (existsSync(path)) return readFileSync(path, 'utf8').trim();
    const s = randomBytes(32).toString('base64url');
    writeFileSync(path, `${s}\n`, { mode: 0o600 });
    return s;
  }
}
