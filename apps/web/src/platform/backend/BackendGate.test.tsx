import { encodeWire } from '@cringe-court/net';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { BackendGate } from './BackendGate';
import { BackendClient } from './client';

const SERVER = { url: 'http://court.test:8787' };
const persona = { id: 'p-abc', name: 'device-1', account: `0x${'ab'.repeat(20)}` };
const features = { demoClock: true, npcJurors: 'late' };

function json(body: unknown, status = 200): Response {
  return new Response(encodeWire(body), { status, headers: { 'Content-Type': 'application/json', 'x-court-time': String(Date.now()) } });
}

/** A court server that answers sessions and keeps the live stream open. */
function serverFetch(): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/v1/sessions') && init?.method === 'POST') return json({ token: 'tok-1', persona, features }, 201);
    if (url.endsWith('/api/v1/sessions/me')) return json({ persona, features });
    if (url.endsWith('/api/v1/events')) return new Response(new ReadableStream({ start() {} }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    return json({ error: { code: 'not-found', message: 'no' } }, 404);
  }) as unknown as typeof fetch;
}

const down = () => vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;

const body = (court: { kind: string }) => <p>{court.kind === 'remote' ? 'Playing on the shared court' : 'Playing the local demo'}</p>;

describe('BackendGate', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => localStorage.clear());

  it('with no court server configured, plays the local demo as before', () => {
    render(<BackendGate backend={null}>{body}</BackendGate>);
    expect(screen.getByText('Playing the local demo')).toBeInTheDocument();
  });

  it('connects, starts a session and plays on the shared court; a reload resumes the same session', async () => {
    const fetch = serverFetch();
    const client = new BackendClient(SERVER, { fetch });
    render(<BackendGate backend={SERVER} client={client}>{body}</BackendGate>);
    expect(screen.getByText('Connecting to the court server…')).toBeInTheDocument();
    expect(await screen.findByText('Playing on the shared court')).toBeInTheDocument();
    expect(client.sessions()).toHaveLength(1);
    client.connection.stop();

    // A new page load on this device: the stored token is reused, no new session is made.
    const again = new BackendClient(SERVER, { fetch });
    await again.connect();
    expect(again.session?.persona.id).toBe('p-abc');
    expect((fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls.filter(([u, i]) => String(u).endsWith('/sessions') && i?.method === 'POST')).toHaveLength(1);
    again.connection.stop();
  });

  it('says honestly when the server is unreachable, retries, and lets the player choose the local demo', async () => {
    const fetch = down();
    const client = new BackendClient(SERVER, { fetch });
    const { container } = render(<BackendGate backend={SERVER} client={client}>{body}</BackendGate>);
    expect(await screen.findByRole('heading', { name: 'The court server is not answering' })).toBeInTheDocument();
    expect(screen.getByText(/court\.test:8787/)).toBeInTheDocument();
    expect(screen.getByText(/Could not reach the court server\. Nothing was sent\./)).toBeInTheDocument();
    // Never a silent fallback: nothing is playing yet.
    expect(screen.queryByText(/Playing/)).toBeNull();
    expect(await axe(container, { rules: { 'color-contrast': { enabled: false } } })).toHaveNoViolations();

    const calls = (fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThan(calls));
    expect(await screen.findByRole('heading', { name: 'The court server is not answering' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Play the local demo instead' }));
    expect(screen.getByText('Playing the local demo')).toBeInTheDocument();
    // The choice is visible and reversible.
    expect(screen.getByText('Local demo')).toBeInTheDocument();
    expect(localStorage.getItem('cc:backend:mode')).toBe('local');
    await userEvent.click(screen.getByRole('button', { name: 'Use the shared court' }));
    expect(localStorage.getItem('cc:backend:mode')).toBeNull();
    expect(await screen.findByRole('heading', { name: 'The court server is not answering' })).toBeInTheDocument();
  });

  it('a server that forgot this device gives it a fresh session and says so', async () => {
    localStorage.setItem(`cc:backend:sessions:${SERVER.url}`, JSON.stringify([{ token: 'stale', persona: { ...persona, id: 'p-old' } }]));
    const base = serverFetch();
    const forgetful = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (String(input).endsWith('/sessions/me') && headers.get('Authorization') === 'Bearer stale') return json({ error: { code: 'unauthorized', message: 'unknown' } }, 401);
      return base(input, init);
    }) as unknown as typeof globalThis.fetch;
    const client = new BackendClient(SERVER, { fetch: forgetful });
    render(<BackendGate backend={SERVER} client={client}>{body}</BackendGate>);
    expect(await screen.findByText('Fresh seat on the court server')).toBeInTheDocument();
    expect(screen.getByText('Playing on the shared court')).toBeInTheDocument();
    expect(client.sessions().map((s) => s.persona.id)).toEqual(['p-abc']);
    client.connection.stop();
  });
});
