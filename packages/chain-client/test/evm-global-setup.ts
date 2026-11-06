/**
 * Starts a throwaway Hardhat node from ../../contracts for the EVM half of the
 * conformance suite and kills it afterwards. Set SKIP_EVM=1 to run only the
 * in-memory half (e.g. when contracts/ has not been installed and compiled).
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import type { TestProject } from "vitest/node";

const CONTRACTS = path.resolve(__dirname, "../../../contracts");

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function waitForRpc(url: string, child: ChildProcess, ms = 60_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (child.exitCode !== null) throw new Error(`hardhat node exited with ${child.exitCode}`);
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }) });
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("hardhat node did not start");
}

let child: ChildProcess | undefined;

export default async function setup(project: TestProject) {
  if (process.env.SKIP_EVM === "1") {
    project.provide("evmRpcUrl", "");
    return;
  }
  const bin = path.join(CONTRACTS, "node_modules/.bin/hardhat");
  const artifact = path.join(CONTRACTS, "artifacts/src/CringeCourt.sol/CringeCourt.json");
  if (!fs.existsSync(bin) || !fs.existsSync(artifact)) {
    throw new Error(
      "EVM conformance needs contracts/ installed and compiled: (cd contracts && npm ci && npx hardhat compile). Or set SKIP_EVM=1.",
    );
  }
  const port = await freePort();
  child = spawn(bin, ["node", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: CONTRACTS, stdio: "ignore" });
  const url = `http://127.0.0.1:${port}`;
  await waitForRpc(url, child);
  project.provide("evmRpcUrl", url);
  return async () => {
    child?.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 200));
    if (child && child.exitCode === null) child.kill("SIGKILL");
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    evmRpcUrl: string;
  }
}
