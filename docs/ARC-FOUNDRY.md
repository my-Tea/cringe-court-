# Arc testnet: Foundry deploy and game configuration

How the court contracts go onto Arc testnet with Foundry, how Circle USDC pays both gas and case money, and how Multicall3 keeps the game from waiting on a round trip per read.

Testnet only (decision D14). No mainnet RPC, key, or address belongs in this repo. The existing Hardhat package under `contracts/` still compiles and tests the Solidity. Foundry is the path that broadcasts.

## The three contracts the game uses

| Contract | Who deploys it | Address the game stores |
|---|---|---|
| Circle USDC | Already on Arc. Do not deploy a token. | `VITE_ARC_USDC` = `0x3600000000000000000000000000000000000000` |
| `HumanRegistry` | This deploy | `VITE_ARC_REGISTRY` |
| `CringeCourt` | This deploy | `VITE_ARC_COURT` |

`CourtMath` is the third Solidity file, and it is not a fourth address. It is an internal library. Foundry compiles it into `CringeCourt`'s bytecode, the same way the Hardhat build does. Settlement in the app stays the TypeScript mirror at `packages/chain-client/src/settlement.ts`.

`MockUSDC` stays a local test double. On Arc the court is constructed with Circle's USDC.

Multicall3 is also already on the network. The deploy does not create it.

| Preinstalled on Arc testnet | Address |
|---|---|
| Chain id | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Circle USDC (ERC-20 interface) | `0x3600000000000000000000000000000000000000` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| Test USDC faucet | `https://faucet.circle.com` |

Sources: [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses), Circle's `ARC_TESTNET` chain definition (same Multicall3 and USDC addresses).

## Why Circle USDC is the gas token

Arc's native gas currency is USDC. A player funds one balance and that balance pays the transaction fee and, through the ERC-20 interface, the case charge, the juror bond, and the refund.

That is the cheap-gas property for this game. A Solo filing is 1.20 USDC and a juror bond is 0.40 USDC. The fee to send the transaction is a fraction of a cent of the same USDC, not a second volatile coin whose price can exceed the case. Testnet USDC comes from the Circle faucet. There is no ETH to bridge.

Two decimal scales share that balance. Mixing them is the configuration bug to avoid.

| Use | Decimals | Where |
|---|---|---|
| Gas, wallet native balance, `msg.value` | 18 | viem `nativeCurrency`, `formatEther` / `parseEther` |
| Case money: bond, fee, quote, `approve`, `transferFrom` | 6 | `config/terms.json`, `court.quote`, ERC-20 `decimals()` |

Circle documents that both interfaces sit on the same underlying balance. `400000` on the token is 0.40 USDC of case money. The gas field on the same transaction is an 18-decimal amount. The court never reads the native balance. The wallet never sends a 6-decimal number as gas.

## What Foundry is taking over

The Solidity in `contracts/src` stays the source of truth:

- `CringeCourt.sol` — escrow, bonds, commit–reveal, deadlines, settlement
- `CourtMath.sol` — pure settlement, compiled into the court
- `HumanRegistry.sol` — World ID attestation written by the backend attester

Foundry replaces the broadcast step only. `contracts/scripts/deploy.ts` refuses every network except the in-process Hardhat chain. The Foundry script is the one allowed to send to chain id `5042002`.

Keep these Hardhat jobs until the Forge tests cover them: `npm test` (250 tests), coverage, and `npm run export-abis` into `packages/chain-client`. A Foundry deploy must not change the ABI the game already binds.

Compiler settings match the size budget already measured (CringeCourt runtime about 23.9 KB, under the 24,576 byte limit):

```toml
# contracts/foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.28"
optimizer = true
optimizer_runs = 1
via_ir = true
evm_version = "cancun"
fs_permissions = [{ access = "read", path = "./config" }]

[rpc_endpoints]
arc_testnet = "${ARC_RPC_URL}"

[etherscan]
arc_testnet = { key = "no-key", url = "https://testnet.arcscan.app/api", chain = 5042002 }
```

OpenZeppelin comes from `forge install OpenZeppelin/openzeppelin-contracts` at the version the Hardhat package already pins, so `AccessControl`, `ReentrancyGuard`, `EIP712`, and `SafeERC20` do not drift. Remap `openzeppelin-contracts/=lib/openzeppelin-contracts/`.

The deploy key lives in the shell, never in the repo and never in a `VITE_` variable:

```bash
export ARC_RPC_URL=https://rpc.testnet.arc.network
export PRIVATE_KEY=0x…          # deployer, funded from faucet.circle.com
```

## Deploy order

One Forge script, `contracts/script/Deploy.s.sol`, broadcast with:

```bash
forge script script/Deploy.s.sol \
  --rpc-url arc_testnet \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --verify
```

A dry run is the same command without `--broadcast`. The script reverts if `block.chainid` is not `5042002`.

Constructors, in order:

```text
HumanRegistry(admin, attester)
CringeCourt(usdc, registry, admin, treasury, aiTreasury)
```

`usdc` is the Circle address above. `admin` holds `DEFAULT_ADMIN_ROLE` on both contracts. Then, from that admin:

| Step | Call | Notes |
|---|---|---|
| 1 | `court.grantRole(OPERATOR_ROLE, operator)` | `openCourt`, `failPreparation`, `protectiveCancel` |
| 2 | `court.grantRole(ASSIGNER_ROLE, assigner)` | Signs juror seat offers. The browser cannot do this on Arc. |
| 3 | `court.grantRole(CURATOR_ROLE, curator)` | Publishes Grand Jury cases |
| 4 | `court.setTerms(Solo, …)` | From `config/terms.json`, mode `solo` |
| 5 | `court.setTerms(Versus, …)` | Mode `versus` |
| 6 | `court.setTerms(GrandJury, …)` | `grandJuryHackathon` or `grandJuryLaunch` via `PRICING` |
| 7 | `court.setMarketingCap` | 40 for hackathon, 0 for launch |
| 8 | `usdc.approve(court, reserve)` then `court.fundReserve(reserve)` | Incident stipends. 14.000000 USDC covers 10 Grand Jury courts at 7 × 0.20 |

`TIMING=demo` writes the short windows and `demoTiming = true`. The game already has to label those windows as demo settings. A public playtest uses `TIMING=production`.

Terms are copied onto a case at creation. `setTerms` after that does not change an open case.

The script writes `contracts/deployments/arc-testnet.json` (gitignored) with the two new addresses, the Circle USDC address, the Multicall3 address, the role addresses, `timing`, and `pricing`. That file is what the web env is filled from. It is not a secret. The key is.

## Roles the game must not put in the browser

| Role | Holds | In the game |
|---|---|---|
| Admin | Terms, treasuries, role grants | Deploy machine only |
| Operator | Opens court, can cancel for a platform fault | Court server |
| Assigner | EIP-712 `SeatOffer` | Court server. `acceptSeat` on Arc returns `not-allowed` until this signer exists |
| Curator | `publishGrandJury` | Court server |
| Attester | `HumanRegistry.attest` after a server-side World ID check | `VITE_WORLD_BACKEND_URL`, never the page |
| Treasury / AI treasury | Pull `withdraw()` for protocol fees and AI fees | Separate addresses. AI fees are USDC. 0G credits stay on the Compute Router |

The demo ledger plays these roles with throwaway keys inside the tab. That stays the fallback when `VITE_LEDGER=demo`. It is not the Arc configuration.

## Multicall3 and game latency

A court screen today wants many reads at once: the case, its frozen terms, the juror list, each juror's commit, `quote` for the filing button, USDC `balanceOf` and `allowance`, and `humanOf` for the connected wallet. One `eth_call` each is a round trip, and the vote screen polls `getCase` because a deadline can pass without an event. That polling is the latency players feel.

Multicall3 at `0xcA11bde05977b3631167028862bE2a173976CA11` runs those reads in one call. The game uses it for reads only. `aggregate3` executed as a transaction would make Multicall3 the `msg.sender`, so it cannot `approve` or `fileSolo` on behalf of the player. Filing, bonding, commit, and reveal stay one transaction each, signed by that wallet.

Wire it in two places.

**Chain definition** (`packages/chain-client/src/chains.ts`). viem batches on its own once the chain names the contract:

```ts
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 0,
    },
  },
  testnet: true,
});
```

**Read port** (`createViemChainPort`). Screens that load together go through `publicClient.multicall`, one HTTP request, `allowFailure: true` so a missing case does not blank the rest of the docket.

| Screen | Calls inside the one multicall |
|---|---|
| File / join | `quote(mode)`, USDC `balanceOf`, USDC `allowance(player, court)`, `humanOf(player)` |
| Case page | `getCase`, frozen terms, juror addresses, each juror's sealed commit |
| Settings → Court connections | `quote` and `getTerms` for Solo, Versus, and Grand Jury, checked against the amounts the UI shows |
| Vote poll | `getCase` plus the caller's juror row, on the existing poll, still one request |

Writes are unchanged: the wallet sends `approve` only when the allowance is short, then the court call. The multicall above is what tells the UI whether that approve is needed, without a second lookup after the screen has already rendered.

## Game configuration

`apps/web` already selects the chain in `platform/config.ts`. After the Forge script prints addresses, the production-shaped env is:

```bash
VITE_LEDGER=arc-testnet
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_ARC_COURT=0x…          # CringeCourt from arc-testnet.json
VITE_ARC_USDC=0x3600000000000000000000000000000000000000
VITE_ARC_REGISTRY=0x…       # HumanRegistry from arc-testnet.json

VITE_IDENTITY=world-idkit
VITE_WORLD_APP_ID=app_…
VITE_WORLD_BACKEND_URL=https://…   # attester posts HumanRegistry.attest

VITE_BACKEND_URL=https://…         # operator, assigner, curator
```

A missing court, USDC, or registry address falls back to the in-browser twin and Settings names the missing variable. A half-configured Arc deploy must not look like a live court.

`createLedger.ts` builds `ArcLedger` over `createViemChainPort` with those three addresses and chain id `5042002`. The public client stays read-only until `window.ethereum` connects, then `attach` swaps in the wallet client. Point that wallet at Arc testnet (chain id `5042002`, native currency USDC, 18 decimals) before the first `fileSolo`. Explorer links stay `https://testnet.arcscan.app/tx/…`.

The player pays gas from the same Circle USDC the court pulls for the charge. Show both numbers in the pay panel, labeled separately: case charge in 6-decimal USDC, network fee in the wallet's 18-decimal estimate. The TESTNET badge stays on (D14). Nothing in this configuration is a mainnet switch.

## Checks before calling the deploy done

1. `forge script` without `--broadcast` prints the two new addresses and reverts on any chain id other than `5042002`.
2. `court.quote(Solo)`, `quote(Versus)`, and `quote(GrandJury)` match `config/terms.json` `expectedCharges` (1.20, 0.70 per side, 7.30 or 7.80).
3. `court.usdc()` and `VITE_ARC_USDC` are the Circle address, and `decimals()` returns 6.
4. A faucet-funded wallet can `approve` and the allowance shows up in the filing multicall.
5. Settings on `VITE_LEDGER=arc-testnet` shows Arc testnet, the court address, and the three terms. It does not show the demo-ledger warning.
6. `acceptSeat` still explains that the relayer is absent, until `VITE_BACKEND_URL` is signing offers. Deploying the contracts does not invent that signer.
