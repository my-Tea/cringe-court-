// Minimal MCP (streamable HTTP) client for the Blockbench MCP plugin.
// Usage: node tools/bbmcp/client.mjs <command> [args]
//   node tools/bbmcp/client.mjs list
//   node tools/bbmcp/client.mjs call <toolName> '<jsonArgs>'
// No dependencies: uses global fetch (node >= 20).
const URL_ = process.env.BB_MCP_URL ?? 'http://localhost:3000/bb-mcp';
let sessionId = null;
let nextId = 1;

async function rpc(method, params, isNotification = false) {
  const body = { jsonrpc: '2.0', method, ...(params ? { params } : {}) };
  if (!isNotification) body.id = nextId++;
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const res = await fetch(URL_, { method: 'POST', headers, body: JSON.stringify(body) });
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  const text = await res.text();
  if (isNotification) return null;
  // Streamable HTTP may answer as SSE frames.
  if ((res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    for (const line of text.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        const msg = JSON.parse(payload);
        if (msg.id === body.id) return msg;
      } catch {
        /* keep scanning */
      }
    }
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`non-JSON response (${res.status}): ${text.slice(0, 400)}`);
  }
}

export async function connect() {
  const init = await rpc('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'cringecourt-art', version: '1.0.0' },
  });
  if (init?.error) throw new Error(`initialize failed: ${JSON.stringify(init.error)}`);
  await rpc('notifications/initialized', undefined, true);
  return init.result;
}

export async function listTools() {
  const out = [];
  let cursor;
  do {
    const r = await rpc('tools/list', cursor ? { cursor } : {});
    if (r?.error) throw new Error(`tools/list failed: ${JSON.stringify(r.error)}`);
    out.push(...(r.result?.tools ?? []));
    cursor = r.result?.nextCursor;
  } while (cursor);
  return out;
}

export async function callTool(name, args = {}) {
  const r = await rpc('tools/call', { name, arguments: args });
  if (r?.error) throw new Error(`tools/call ${name} failed: ${JSON.stringify(r.error)}`);
  return r.result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...rest] = process.argv.slice(2);
  const info = await connect();
  console.error(`# connected: ${info.serverInfo?.name} ${info.serverInfo?.version} (protocol ${info.protocolVersion})`);
  if (cmd === 'list') {
    const tools = await listTools();
    console.log(JSON.stringify(tools, null, 2));
    console.error(`# ${tools.length} tools`);
  } else if (cmd === 'call') {
    const [name, json] = rest;
    const result = await callTool(name, json ? JSON.parse(json) : {});
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.error('usage: node tools/bbmcp/client.mjs list | call <tool> <jsonArgs>');
    process.exit(2);
  }
}
