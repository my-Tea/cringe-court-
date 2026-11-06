# @cringe-court/chain-client

Everything an app needs to talk to the CringeCourt contracts. Testnet only (D14).

- **`ChainPort`** (`src/port.ts`): one interface for every read and write the modes need. Reverts throw
  `CourtError` whose `code` is the Solidity custom error name, with player-facing copy in `COURT_ERROR_COPY`.
- **`createViemChainPort`** (`src/viem.ts`): the real thing. It simulates before sending, so reverts surface before a
  wallet prompt, then waits for the receipt and decodes results from events (`caseId`, `accepted`, the `Settlement`
  receipt, the cancel `reason`, refund and withdrawal amounts).
- **`createMemoryChain`** (`src/memory.ts`): an in-memory court with the **same state machine, check order, error
  names and settlement**, plus a tiny ERC-20 and HumanRegistry, a controllable clock and atomic, revert-safe writes.
  Use it for UI work, storybook, offline demos and app tests. `memory.as(address)` gives a port acting as that account.
- **Typed ABIs** (`src/generated/abis.ts`) and **terms** (`src/generated/terms.ts`) are generated from the contracts
  by `cd contracts && npm run export-abis`. A contracts test fails if they drift.
- Helpers: `sealBallot` / `commitmentOf` / `encodeScroll` / `decodeScroll`, which form the "Secret Verdict Scroll" a
  juror keeps to reveal (V4 §7). Also `signSeatOffer` (backend assigner, EIP-712), `quoteFor` / `priceBreakdown`
  (the "see price and risks" screen), `parseUsdc` / `formatUsdc`, `BALLOT_LABELS`, `arcTestnet`, and `settle` (a
  mirror of `CourtMath`).

```ts
import { createMemoryChain, ROLES, Mode, sealBallot, parseUsdc, formatUsdc } from "@cringe-court/chain-client";

const chain = createMemoryChain({ timing: "demo" });     // demo windows → caseTerms(id).demoTiming === true
chain.mint(alice, parseUsdc("10"));
const me = chain.as(alice);
await me.approveUsdc(parseUsdc("10"));
const { caseId } = await me.fileSolo({ contentHash });    // 1.20 (needs a DEVICE+ attestation first)
const { commitment, scroll } = sealBallot({ chainId: me.chainId, court: me.court, caseId, juror, choice: 0 });
// … juror.commitVote(caseId, commitment); keep `scroll`; later decodeScroll(scroll) → revealVote(caseId, choice, salt)
chain.advance(20 * 60);                                    // move the mock clock
```

With real contracts:

```ts
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { createViemChainPort, arcTestnet } from "@cringe-court/chain-client";

const port = createViemChainPort({
  publicClient: createPublicClient({ chain: arcTestnet, transport: http() }),
  walletClient: createWalletClient({ chain: arcTestnet, transport: custom(window.ethereum), account }),
  addresses: { court, usdc, registry },   // from the deployment manifest; nothing is deployed on Arc yet
});
```

Tip: viem's `http` transport retries failed `eth_call`s by default, and some nodes report reverts as retryable
internal errors. For snappy error UX use `http(url, { retryCount: 0 })` for the public client, or a small count.

## Tests: one suite, two worlds

`test/conformance.test.ts` runs the same code against both implementations through `ChainPort` only:

1. the hand-written settlement oracle, `contracts/test/fixtures/settlement-scenarios.json` (28 cases from the V4 §9
   and ECONOMICS tables);
2. lifecycle and error-code checks: phases, early reveal, early verdict, seat-offer forgery, unverified and
   device-level jurors, a party on another wallet, one seat per human, timeouts, the protective-cancel stipend,
   marketing cap and sponsor floor, capped contributions, and the scroll round trip.

The EVM half starts a throwaway `hardhat node` from `../../contracts` (`test/evm-global-setup.ts`), deploys from the
compiled artifacts, and reverts to a snapshot between tests. It needs `contracts/` installed and compiled; set
`SKIP_EVM=1` to run only the memory half.

```bash
npm ci && npm test        # 73 tests: 34 memory + 34 EVM conformance + 5 unit
npm run typecheck && npm run build
```

**Verified:** all of the above pass locally (Hardhat node 2.29, viem 2.x). **Not verified:** the viem adapter against
Arc testnet or a browser wallet; `onEvent` (watchContractEvent) has no automated test; the `arcTestnet` chain
definition values were not checked against a live node.
