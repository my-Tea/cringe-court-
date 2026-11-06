/**
 * Local deployment and dry run. Never reads or creates keys and never
 * broadcasts to a public network (DECISIONS D14; this phase is local only).
 *
 *   npm run deploy:local                       # deploy into the in-process Hardhat network, print a manifest
 *   npm run deploy:dry-run                     # same, plus a per-transaction gas plan for an Arc testnet rollout
 *   TIMING=demo PRICING=launch npm run deploy:local
 *
 * On any network other than `hardhat` the script prints the plan and exits
 * without sending anything. A real Arc testnet deployment is a separate,
 * reviewed step: it needs a funded deployer key held outside this repo, the
 * real USDC ERC-20 address and a World-ID-backed attester service.
 */
import fs from "node:fs";
import path from "node:path";
import { ethers, network } from "hardhat";
import { buildTerms, MODE, TERMS, type Pricing, type Timing } from "./terms";

const timing = (process.env.TIMING ?? "production") as Timing;
const pricing = (process.env.PRICING ?? "hackathon") as Pricing;
const dryRun = process.env.DRY_RUN === "1";

interface Step {
  what: string;
  gas: bigint;
}

async function main() {
  if (!(timing in TERMS.timing)) throw new Error(`TIMING must be one of ${Object.keys(TERMS.timing).join(", ")}`);
  if (pricing !== "hackathon" && pricing !== "launch") throw new Error("PRICING must be hackathon or launch");

  if (network.name !== "hardhat") {
    console.log(`Refusing to broadcast on "${network.name}". This script only deploys to the in-process Hardhat network.`);
    console.log("Run `npm run deploy:dry-run` for the plan and gas estimate.");
    return;
  }

  const [deployer, operator, assigner, curator, attester, treasury, aiTreasury] = await ethers.getSigners();
  const steps: Step[] = [];
  const record = async (what: string, tx: { wait: () => Promise<{ gasUsed: bigint } | null> }) => {
    const r = await tx.wait();
    steps.push({ what, gas: r?.gasUsed ?? 0n });
  };

  const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
  await record("deploy MockUSDC (local stand-in for Arc USDC)", usdc.deploymentTransaction()!);
  const registry = await (await ethers.getContractFactory("HumanRegistry")).deploy(deployer.address, attester.address);
  await record("deploy HumanRegistry", registry.deploymentTransaction()!);
  const court = await (await ethers.getContractFactory("CringeCourt")).deploy(
    await usdc.getAddress(), await registry.getAddress(), deployer.address, treasury.address, aiTreasury.address,
  );
  await record("deploy CringeCourt", court.deploymentTransaction()!);

  await record("grant OPERATOR_ROLE", await court.grantRole(await court.OPERATOR_ROLE(), operator.address));
  await record("grant ASSIGNER_ROLE", await court.grantRole(await court.ASSIGNER_ROLE(), assigner.address));
  await record("grant CURATOR_ROLE", await court.grantRole(await court.CURATOR_ROLE(), curator.address));
  for (const [name, m] of Object.entries(MODE)) {
    await record(`setTerms(${name}, ${timing}/${pricing})`, await court.setTerms(m, buildTerms(m, timing, pricing)));
  }
  await record(`setMarketingCap(${TERMS.marketingCap[pricing]})`, await court.setMarketingCap(TERMS.marketingCap[pricing]));

  // Incident-stipend reserve: enough to open 10 Grand Jury courts at once (7 × 0.20 each).
  const reserve = ethers.parseUnits("14", 6);
  await usdc.mint(deployer.address, reserve);
  await record("approve reserve", await usdc.approve(await court.getAddress(), reserve));
  await record("fundReserve(14.00)", await court.fundReserve(reserve));

  const quotes = {
    solo: ethers.formatUnits(await court.quote(MODE.Solo, true, false), 6),
    versusPerSide: ethers.formatUnits(await court.quote(MODE.Versus, true, false), 6),
    grandJuryTarget: ethers.formatUnits(await court.quote(MODE.GrandJury, true, false), 6),
  };
  const size = async (name: string) => {
    const code = await ethers.provider.getCode(name);
    return (code.length - 2) / 2;
  };

  const manifest = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    timing,
    pricing,
    demoTiming: TERMS.timing[timing].demoTiming,
    contracts: {
      usdc: await usdc.getAddress(),
      registry: await registry.getAddress(),
      court: await court.getAddress(),
    },
    roles: {
      admin: deployer.address, operator: operator.address, assigner: assigner.address,
      curator: curator.address, attester: attester.address,
    },
    treasuries: { treasury: treasury.address, aiTreasury: aiTreasury.address },
    quotes,
    runtimeBytes: { CringeCourt: await size(await court.getAddress()), HumanRegistry: await size(await registry.getAddress()) },
  };

  console.log(JSON.stringify(manifest, null, 2));
  if (dryRun) {
    const total = steps.reduce((a, s) => a + s.gas, 0n);
    console.log("\nRollout plan (gas measured on the in-process Hardhat network):");
    for (const s of steps) console.log(`  ${s.gas.toString().padStart(9)}  ${s.what}`);
    console.log(`  ${total.toString().padStart(9)}  total`);
    console.log("\nOn Arc testnet, skip the MockUSDC step and pass Arc's USDC ERC-20 address instead. Not broadcast.");
  } else {
    const dir = path.resolve(__dirname, "../deployments");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `local-${timing}-${pricing}.json`);
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`\nwrote ${path.relative(process.cwd(), file)} (gitignored; the in-process network is gone when this exits)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
