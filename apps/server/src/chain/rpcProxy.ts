/**
 * Browsers read Arc through this server. The public RPC answers 429 to browser
 * traffic at very low volume, so one queue here, with a short cache and patient
 * retries, is what keeps prices and balances loading. Reads only: every write
 * is signed and sent by the player's own wallet, or by the relayer.
 */
const READ_METHODS = new Set([
  'eth_blockNumber',
  'eth_call',
  'eth_chainId',
  'eth_estimateGas',
  'eth_feeHistory',
  'eth_gasPrice',
  'eth_getBalance',
  'eth_getBlockByNumber',
  'eth_getCode',
  'eth_getLogs',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_maxPriorityFeePerGas',
]);
/** A stake must be seen as soon as it lands, so what changes per transaction is never cached. */
const UNCACHED = new Set(['eth_getTransactionReceipt', 'eth_getTransactionByHash', 'eth_getTransactionCount', 'eth_estimateGas']);
const CACHE_MS = 4000;
const GAP_MS = 150;
const RETRIES = 6;
const BACKOFF_MS = 500;

export interface RpcRequest {
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

export type RpcOutcome = { status: number; body: unknown };

export function createRpcProxy(o: { url: string; fetch?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void> }) {
  const send = o.fetch ?? ((...a: Parameters<typeof fetch>) => globalThis.fetch(...a));
  const now = o.now ?? Date.now;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const cache = new Map<string, { at: number; result: unknown }>();
  const inFlight = new Map<string, Promise<RpcOutcome>>();
  let queue: Promise<unknown> = Promise.resolve();

  const upstream = async (method: string, params: unknown): Promise<RpcOutcome> => {
    for (let attempt = 0; ; attempt += 1) {
      const res = await send(o.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }).catch(() => null);
      if (res && res.status !== 429 && res.status < 500) return { status: 200, body: await res.json() };
      if (attempt >= RETRIES) return { status: 503, body: { error: { code: -32005, message: 'Arc is busy. Try again.' } } };
      await sleep(BACKOFF_MS * (attempt + 1));
    }
  };

  const inTurn = (method: string, params: unknown): Promise<RpcOutcome> => {
    const run = queue.then(async () => {
      const out = await upstream(method, params);
      await sleep(GAP_MS);
      return out;
    });
    queue = run.catch(() => undefined);
    return run;
  };

  return {
    async forward(req: RpcRequest): Promise<RpcOutcome> {
      const { id, method, params } = req;
      if (typeof method !== 'string' || !READ_METHODS.has(method)) {
        return { status: 400, body: { jsonrpc: '2.0', id, error: { code: -32601, message: 'Only reads go through the court.' } } };
      }
      const key = `${method}:${JSON.stringify(params ?? [])}`;
      const cached = UNCACHED.has(method) ? undefined : cache.get(key);
      if (cached && now() - cached.at < CACHE_MS) return { status: 200, body: { jsonrpc: '2.0', id, result: cached.result } };

      // Several tabs asking the same thing share one upstream call.
      let job = inFlight.get(key);
      if (!job) {
        job = inTurn(method, params).finally(() => inFlight.delete(key));
        inFlight.set(key, job);
      }
      const out = await job;
      const body = out.body as { result?: unknown; error?: unknown };
      // Arc is busy: the last good answer beats a dead button. Prices never change, and a balance catches up.
      if (out.status !== 200 && cache.has(key)) return { status: 200, body: { jsonrpc: '2.0', id, result: cache.get(key)!.result } };
      if (out.status === 200 && body.error === undefined && !UNCACHED.has(method)) cache.set(key, { at: now(), result: body.result });
      return { status: out.status, body: { ...body, jsonrpc: '2.0', id } };
    },
  };
}
