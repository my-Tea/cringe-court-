# CringeCourt contracts (Arc testnet)

Case escrow, juror bonds, commit-reveal ballots, deadlines, payouts, refunds,
forfeits and fee splits for all three modes, implemented exactly per
[`docs/DECISIONS.md`](../docs/DECISIONS.md) and [`docs/ECONOMICS.md`](../docs/ECONOMICS.md).
**Testnet only (D14).** This is a self-contained Hardhat package. It is not part of
any root workspace.

| Contract | Role |
|---|---|
| `src/CringeCourt.sol` | The court: all modes, the jury, ballots and settlement. 23,933 bytes of runtime, under the 24,576 EIP-170 limit |
| `src/CourtMath.sol` | Pure settlement rules (internal library), mirrored in `packages/chain-client/src/settlement.ts` |
| `src/HumanRegistry.sol` | World-ID-backed attestations: `wallet → (humanId, level, expiresAt)` |
| `src/interfaces/ICringeCourt.sol` | Enums, structs, events and errors (bind to these) |
| `src/interfaces/IHumanRegistry.sol` | `humanOf(wallet) → (humanId, level)`; swap in another identity source without touching the court |
| `src/test/MockUSDC.sol` | 6-decimal test token for local runs only |
| `config/terms.json` | **The single source of every amount and window**, from the DECISIONS "Implementation constants" table |

Front ends and mode tracks should not call these contracts directly. Use
[`packages/chain-client`](../packages/chain-client): typed bindings, the
`ChainPort` interface, a viem adapter and an in-memory mock with the same
semantics. World ID verification lives in [`packages/world-id`](../packages/world-id).

```bash
npm ci
npm run build             # hardhat compile (+ typechain)
npm test                  # 250 tests (settlement oracle, lifecycle, access, terms, rounding, registry, ABI drift)
npm run coverage          # solidity-coverage report in coverage/
npm run export-abis       # regenerate packages/chain-client/src/generated/* after any ABI or terms change
npm run deploy:local      # deploy into the in-process Hardhat network and print a manifest
npm run deploy:dry-run    # the same, plus a per-transaction gas plan
TIMING=demo PRICING=launch npm run deploy:dry-run
```

---

## 1. Money (USDC base units, 6 decimals: `400000` = 0.40)

All terms are copied into a case when it is created, and **can never change for that case** (DECISIONS rule 2).
`setTerms` affects only cases created afterwards.

| Term | Mode 1 Solo | Mode 2 Versus | Mode 3 hackathon | Mode 3 launch |
|---|---:|---:|---:|---:|
| `n` → jurors / verdict threshold | 1 → 3 / 2 | 1 → 3 / 2 | 3 → 7 / 4 | 3 → 7 / 4 |
| `bond` per juror | 0.40 | 0.40 | 1.20 | 1.20 |
| `successBonus` per timely juror | 0.30 | 0.30 | 0.90 | 0.90 |
| `failedTrialBonus` (from forfeits) | 0.20 | 0.20 | 0.20 | 0.20 |
| jury pool = (2n+1) × bonus | 0.90 | 0.90 | 6.30 | 6.30 |
| `protocolFee` | 0.10 | 0.10 (0.05 per side) | 0.50 | 1.00 |
| `aiFeePerAgent` | 0.20 | 0.20 per side | 0.50 | 0.50 |
| **Charge** (`quote`) | **1.20** (1.00 with Pass) | **0.70 per side** | **7.30 target** | **7.80 target** |
| `incidentStipend` (platform reserve) | 0.20 | 0.20 | 0.20 | 0.20 |
| `minContribution` / `sponsorFloor` | — | — | 0.10 / 2.00 | 0.10 / 2.00 |
| marketing cap (unsponsored cases) | — | — | 40 | 0 |
| juror / party World level | ORB / DEVICE | ORB / DEVICE | ORB / — | ORB / — |
| pending · recruit · prep · commit · reveal | — · 30m · 60m · 20m · 10m | 24h · … | 48h · … | 48h · … |

`timing: "demo"` uses 15m / 30m pending windows, then 5m · 5m · 2m · 2m. It sets `demoTiming = true` on the case, and
the UI must label those windows as demo settings (V4 §8, D14).

### Settlement (`CourtMath.settle`, after the reveal deadline or once every juror revealed)

*Timely* = committed **and** revealed in time. Absent = everyone else, including jurors who committed but never revealed.

| Outcome | Each timely juror | Each absent juror | Payers | Treasury | AI treasury |
|---|---|---|---|---|---|
| **Verdict** (≥ n+1 matching reveals) | bond + success bonus | loses bond | nothing back | fee + forfeits + unearned bonus + sponsor | AI fees |
| **NO VERDICT** | bond + failed-trial bonus | loses bond | **everything back, fees included** | forfeits − timely × 0.20 + sponsor | 0 |

Terms validation enforces `bond ≥ 2n × failedTrialBonus`. A NO VERDICT always has at least one absent juror, because
2n+1 binary reveals always contain n+1 matching. So one forfeited bond always covers the failed-trial bonus (V4 §9).
Every row of the V4 §9 three-person table and of the ECONOMICS N = 3 table is a test case in
`test/fixtures/settlement-scenarios.json`. That oracle was written by hand from the docs, not generated, and it runs
against both the contract and the mock.

### Cancellation (nobody is slashed; everyone is made whole)

| Reason | Trigger | Who |
|---|---|---|
| `ConsentExpired` / `FundingExpired` | pending deadline passed (Versus Side B never funded / crowdfund short) | anyone: `cancelExpired` |
| `InviteWithdrawn` | Side A withdraws before Side B funds | Side A: `withdrawInvite` |
| `JuryNotFilled` | recruitment deadline passed | anyone: `cancelExpired` |
| `PreparationExpired` | no `openCourt` before the preparation deadline | anyone: `cancelExpired` |
| `PreparationFailed` | AI could not prepare a fair case (D1 balance gate) | `OPERATOR`: `failPreparation` |
| `ProtectiveCancel` | platform fault or fairness incident (V4 §8) | `OPERATOR`: `protectiveCancel`. Not allowed once the result is fixed |

On every cancel, payers get a full refund, every seated juror gets the bond back, and the sponsor deposit is
returned. On a `ProtectiveCancel` during voting, each juror who had committed also gets the **0.20 incident stipend
from the platform reserve**, never from other jurors' bonds. `openCourt` locks `jurySize × stipend` of reserve up
front, so the stipend is guaranteed to exist ("platform-fault compensation requires separately available company
funds", V4 §8).

### Pull payments

Settlement and cancellation only credit balances:

- `claimable[account]` (jurors, treasury, AI treasury, sponsor) → `withdraw()`.
- Payers (Solo filer, Versus sides, Grand Jury contributors) → `claimRefund(caseId)`, or the permissionless
  `claimRefundFor(caseId, payer)`, which always pays the payer.

No loop ever transfers tokens, so one bad recipient can't block a case.

---

## 2. Lifecycle

```
Solo:        fileSolo ───────────────────────────────┐
Versus:      openVersus ─(Pending, 24h)─ joinVersus ─┤
Grand Jury:  publishGrandJury ─(Pending, 48h)─ contribute… (target reached) ─┤
                                                     ▼
                              Recruiting (30m): acceptSeat × (2n+1), signed random offers
                                                     ▼  jury full
                              Preparing (60m): AI writes and freezes the transcript
                                                     ▼  openCourt(transcriptHash), deadlines fixed
                              Voting: Commit (20m) → Reveal (10m)
                                                     ▼  all revealed, or reveal deadline
                              finalize (anyone) → Finalized { Choice0 | Choice1 | NoVerdict }
```

- **Early reveal:** once every juror has committed, the reveal opens immediately and committing closes. The reveal
  **deadline never moves**.
- **Early verdict:** once every juror has revealed, anyone can finalize (V4 §6 step 9). Otherwise finalization waits
  for the reveal deadline, even if the majority is already obvious.
- **Re-commit:** a juror may replace their commitment while the commit window is open, e.g. after losing the salt.
- **Phase** for UI: `phaseOf(caseId)` → `AwaitingCounterparty | Crowdfunding | Recruiting | Preparing | Commit | Reveal |
  Finalizable | Expired | Finalized | Cancelled`. `Expired` means a pending, recruit or prep deadline passed and
  `cancelExpired` will succeed.
- **No pause.** Once duty is slashable the platform has no lever over deadlines (D13 safeguard 3). The only platform
  actions during voting are `protectiveCancel` (no revenue for the platform) and nothing else.

### Ballot

`commitment = keccak256(abi.encode(block.chainid, court, caseId, juror, choice, salt))`, available on-chain as
`commitmentOf(...)` and off-chain as `commitmentOf` / `sealBallot` in chain-client. `choice` is `0` or `1`. Labels are
case metadata (D5): GUILTY / NOT COOKED, SIDE A / SIDE B, or the two reviewed Grand Jury titles. Binding the juror and
court stops a commitment from being copied to another seat or deployment.

### Jury gating (V4 §6 step 3–4, §10)

`acceptSeat(caseId, expiresAt, signature)` requires:

1. an EIP-712 `SeatOffer(uint256 caseId,address juror,uint64 expiresAt)` signed by an `ASSIGNER`. This is the backend
   that randomly offers seats from the verified waiting pool, so a creator can't seat their friends. Domain:
   `{name: "CringeCourt", version: "1", chainId, verifyingContract: court}`;
2. a live `HumanRegistry` attestation at `minJurorLevel` (ORB);
3. the juror's wallet is not the creator, Side B or the sponsor, **and their humanId is not the creator's or Side B's**,
   so a party can't judge their own case from another wallet;
4. one seat per humanId per case.

It then pulls the bond. Declining an offer is simply not calling it, and costs nothing.

Parties: `fileSolo`, `openVersus` and `joinVersus` require the caller to be attested at `minPartyLevel` (DEVICE). That
is what makes rule 3 enforceable.

### Grand Jury specifics (D9, D10)

- `publishGrandJury(contentHash, sponsor, sponsorAmount)`: `CURATOR` only, because every public case is editorially
  reviewed (V4 §12). A deposit ≥ `sponsorFloor` makes the case *sponsored*. Otherwise it must fit in the marketing
  cap: 40 at the hackathon, 0 at launch, where it reverts `SponsorRequired`. The deposit is pulled from `sponsor` in
  the same transaction ("committed before publication"), so the sponsor must have approved the court.
- `contribute(caseId, amount)` takes at most what the target still needs and returns `accepted`. The minimum is 0.10,
  except that the final top-up may be smaller. Contributions earn nothing that depends on the outcome.
- The sponsor fee goes to the treasury once the trial runs (verdict or NO VERDICT). It is returned on any
  cancellation, including a protective cancel during voting, which is a platform fault.

---

## 3. Interface reference

**Writes**

| Function | Who | Notes |
|---|---|---|
| `fileSolo(bytes32 contentHash, bool usePass) → caseId` | verified party | pays `quote(Solo)` |
| `openVersus(address sideB, bytes32 contentHash, bool usePass) → caseId` | verified Side A | pays Side A's half |
| `joinVersus(uint256 caseId, bool usePass)` | Side B | pays its half, opens recruitment |
| `withdrawInvite(uint256 caseId)` | Side A | while Pending |
| `publishGrandJury(bytes32 contentHash, address sponsor, uint128 sponsorAmount) → caseId` | CURATOR | |
| `contribute(uint256 caseId, uint256 amount) → accepted` | anyone | |
| `acceptSeat(uint256 caseId, uint64 expiresAt, bytes signature)` | offered juror | pulls the bond |
| `openCourt(uint256 caseId, bytes32 transcriptHash)` | OPERATOR | freezes the transcript fingerprint, fixes deadlines, locks stipends |
| `failPreparation(uint256 caseId)` | OPERATOR | |
| `commitVote(uint256 caseId, bytes32 commitment)` / `revealVote(uint256 caseId, uint8 choice, bytes32 salt)` | juror | |
| `finalize(uint256 caseId)` | anyone | emits the full settlement receipt |
| `cancelExpired(uint256 caseId)` | anyone | |
| `protectiveCancel(uint256 caseId)` | OPERATOR | |
| `claimRefund(uint256 caseId)` / `claimRefundFor(uint256 caseId, address payer)` | anyone | |
| `withdraw()` | anyone with a balance | |
| `fundReserve(uint256)` | anyone | incident-stipend reserve |
| `setTerms`, `setTreasuries`, `setRegistry`, `setMarketingCap`, `withdrawReserve` | admin | terms affect future cases only; `withdrawReserve` only unlocked reserve |

**Reads:** `getCase`, `caseTerms`, `termsOf(mode)`, `jurorsOf`, `jurorOf`, `phaseOf`, `quote(mode, sideA, usePass)`,
`isRefundable`, `paidBy(caseId, payer)`, `claimable(account)`, `commitmentOf`, `seatOfferDigest`, `reserveBalance`,
`reserveLocked`, `marketingCap`, `marketingUsed`, `caseCount`.

**Events:** `CaseCreated`, `PaymentReceived`, `SponsorDeposited`, `RecruitmentOpened`, `SeatAccepted`, `JuryFilled`,
`CourtOpened`, `VoteCommitted`, `VoteRevealed`, `CaseFinalized(caseId, Settlement)`, `CaseCancelled(caseId, reason,
stipendsPaid)`, `IncidentStipendPaid`, `RefundClaimed`, `Withdrawn`, `TermsUpdated`, `TreasuryUpdated`,
`RegistryUpdated`, `MarketingCapUpdated`, `ReserveFunded`, `ReserveWithdrawn`.

`Settlement` is the public receipt (D13 disclosure): outcome, timely/absent counts, payout and bonus per timely
juror, forfeited bonds, unearned bonus, protocol fees, AI fees, sponsor fee, totals to the treasury and AI treasury,
and the amount refundable to payers.

**Errors** are custom errors. chain-client surfaces them as `CourtError.code`, with friendly copy in
`COURT_ERROR_COPY`: `ModeDisabled, InvalidTerms, ZeroAddress, PassDisabled, PartyNotVerified, SamePerson,
NotCounterparty, NotCreator, WrongMode, WrongStatus, DeadlinePassed, NotExpired, BelowMinContribution,
SponsorRequired, MarketingCapReached, OfferExpired, InvalidSeatOffer, AlreadySeated, PartyCannotServe,
JurorNotVerified, HumanAlreadySeated, NotJuror, ZeroValue, CommitClosed, RevealNotOpen, NoCommitment,
AlreadyRevealed, InvalidChoice, CommitmentMismatch, NotFinalizable, InsufficientReserve, NotRefundable,
NothingToClaim`.

**Roles:** `DEFAULT_ADMIN_ROLE` (terms, treasuries, registry, cap, reserve withdrawal), `OPERATOR_ROLE` (court
preparation and incidents), `ASSIGNER_ROLE` (seat-offer signer), `CURATOR_ROLE` (Grand Jury publishing), and on the
registry, `ATTESTER_ROLE` (the World ID verification backend).

---

## 4. Design decisions made here (beyond DECISIONS.md)

| Decision | Why |
|---|---|
| Versus Side A escrows its half at `openVersus`; refunded in full if Side B never funds | Two wallets can't fund atomically. D6 ("Side A pays nothing") holds because the refund is full and the platform still absorbs the intake inference. The D6 limit of 3 open invites stays in the app layer, as decided |
| Parties must be World-verified (DEVICE) to file or join | Without a party humanId, cross-wallet self-judging exclusion (V4 §6.4, §10) can't be enforced. Teasers stay verification-free (D3) because they never touch the chain |
| Signed seat offers instead of on-chain randomness | Arc has no native VRF here. The assigner's randomness is off-chain and auditable from events, and the contract still enforces gating, exclusion and one seat per human |
| Reveal opens early when all have committed; the deadline is unchanged | Faster demo verdicts with no loss of anyone's time. No one can be slashed early |
| Stipends are reserved when the court opens | Turns V4 §8's "requires company funds" into a guarantee instead of a hope |
| `protectiveCancel` is impossible once the result is fixed | The platform can't undo a verdict it dislikes (V4 §8: "a creator no longer likes the verdict" is not a fault) |
| Commit-reveal binds chain, court, case and juror | Stops cross-seat copying and replay |
| Treasury addresses are read at settlement, not snapshotted | Lets a compromised treasury be rotated. Amounts are still snapshotted per case |
| Odd base units in a Versus split go to Side A | Deterministic, and the split always sums exactly. Tested with odd fees |
| `optimizer.runs = 1`, `viaIR` | Keeps runtime under EIP-170 (23.9 KB). Gas per call is slightly higher |

## 5. What is verified, and what is not

**Verified (locally):** `npm test` (250 Hardhat tests) and the chain-client conformance suite. That suite runs the
same oracle and lifecycle tests against **this contract on a live Hardhat node through the viem adapter** and against
the in-memory mock, 68 tests in total. Conservation is checked after every money-moving test: the court's USDC
balance always equals everything it still owes. The deploy script runs on the in-process network and prints a gas
plan.

**Not verified:**

- **Nothing has been deployed to Arc testnet.** No keys were created or read. The Arc chain id `5042002` and RPC URL
  in `hardhat.config.ts` were not checked against a live node, and the address of Arc's USDC ERC-20 interface is not
  configured.
- **No external audit.** `npm run coverage` (solidity-coverage): CringeCourt 100 % statements, lines and functions, 93.5 % branches. CourtMath and HumanRegistry are at 100 %. Coverage is not proof of correctness.
- **World ID semantics:** see `packages/world-id/README.md`, which includes the cross-credential nullifier gate.
- **The A-number economics are assumptions** (DECISIONS "Not verified"). The contract implements the decided
  numbers. It doesn't validate them.
