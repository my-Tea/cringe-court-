# World IDKit: how to implement it

Plan for the **Best Use of IDKit** bounty. It takes CringeCourt from the mock verifier to a real, server-verified World ID flow.

Written 2026-11-06 against `@worldcoin/idkit-core` 4.6.0 (installed and latest) and the [World docs](#sources). Testnet only (D14). Prices, jury sizes and money rules do not change.

| | |
|---|---|
| **Trust moment** | Accepting a limited, paid jury seat |
| **Credential** | Proof of Human (`proofOfHuman`) |
| **Why it is the minimum** | A paid seat that decides a verdict is only fair if each seat is a different person. Nothing weaker promises that. |
| **Not gated** | Walking the world, watching, teasers, the crowd vote. They need no proof (D-record: teasers). |
| **State today** | Building blocks exist, but the app runs on the mock and a real proof would fail. See [§3](#3-what-blocks-a-live-flow-today). |

---

## 1. The bounty, and where this plan answers it

| Requirement | Answer | Section |
|---|---|---|
| IDKit in a functioning app | Web app plus `apps/server`, on the jury seat | §5 |
| A supported credential, verified on the server | `proofOfHuman`, forwarded to `POST /api/v4/verify/{rp_id}` | §5.2, §5.3 |
| Explain the event and why this credential is the minimum | §2 | §2 |
| A success and one meaningful alternative path | Orb success; no-Orb, party, cancel paths | §6 |
| Integration debrief | Template to fill in from real numbers | §10 |

The judges reward "the best decision about which credential is needed", not the most credentials. So this plan uses **one credential at one moment**.

---

## 2. The trust decision

### The event

A juror accepts a seat on a case. Accepting locks a refundable bond and pays a bonus if the jury reaches a verdict. Seats are scarce: 3 in Solo and Versus, 7 in Grand Jury. A verdict needs 2 of 3 or 4 of 7 matching votes.

### What goes wrong without it

| Attack | Without personhood |
|---|---|
| Seat farming | One person with 3 wallets takes 3 paid seats |
| Rigged verdict | Two wallets decide a three-person jury |
| Judging your own case | A filer sits on their own jury from a second wallet |

Wallets are free, so none of this can be stopped with wallets alone.

### Why Proof of Human, and not something else

| Credential | Decision | Reason |
|---|---|---|
| **Proof of Human** (`proofOfHuman`) | **Chosen for jurors** | World describes it as "a unique human", backed by the Orb. Uniqueness is the exact property a paid, vote-weighted seat needs. |
| Selfie Check (`selfieCheck`) | Not for jurors | World calls it medium-assurance, for "friction and bot deterrence". Its `sybil_score` is a risk signal, but the docs do not state the range's meaning or direction, so we cannot honestly set a threshold on it. Revisit if World documents that. |
| Passport (`passport`) | No | Proves a document. It is more identity than a jury needs and excludes people without an NFC passport. |
| `identityCheck` | No | Preview, by request. Age or nationality says nothing about this seat. |
| `deviceLegacy` | **Stop using** | World marks it deprecated and says new integrations should use Selfie Check. Our adapter still uses it (§3). |

An identity proof shows a person is unique, not that they are impartial. Random seat offers and party exclusion cover the rest (V4 §10). Do not claim more.

### When proof is asked for

| Moment | Proof | Why |
|---|---|---|
| Open the game, walk, explore, watch a teaser, crowd vote | **None** | Nothing scarce is being granted. D-record: World ID is not required to watch. |
| Enter the jury pool or accept a seat | **Proof of Human** | The trust moment |
| File a case or join as a Versus side | Open decision, see below | Needed only so a party can be recognised on their own jury |

**Open decision: what do parties prove?** Blocking a party from their own jury means comparing their ID with a juror's. That only works if both IDs come from the same action, and possibly the same credential (gate G1, §7).

- If G1 shows the same nullifier across credentials: parties use `selfieCheck` (low friction).
- If G1 shows different nullifiers, or stays unknown: parties use `proofOfHuman` too.

`terms.json` needs no change either way, since `minPartyLevel: 1` accepts both. **Default for the demo: `proofOfHuman`**, because it is the only option known to work.

---

## 3. What blocks a live flow today

Found by reading the code against the docs.

| # | Problem | Where | Effect |
|---|---|---|---|
| B1 | **Different action per purpose.** The adapter sends `join-jury-pool`, `accept-jury-seat`, `case-party`. Nullifiers are action-scoped, and the verifier accepts a single action. | `idkitIdentity.ts`, `idkit-verifier.ts` | Real proofs fail with `wrong_action`. If that were relaxed, party and juror IDs would never match, so self-judging could not be caught. |
| B2 | **No server routes.** The adapter calls `/rp-context` and `/verify`; `apps/server` has neither and does not depend on `@cringe-court/world-id`. | `apps/server/src/app.ts` | No live call can happen |
| B3 | **Legacy presets and mixed protocols.** Uses `orbLegacy`/`deviceLegacy` with `allow_legacy_proofs: true`. The package README requires pinning one protocol, because V3 and V4 nullifiers differ. | `idkitIdentity.ts` | One person can get two IDs |
| B4 | **Legacy host.** Default is `developer.worldcoin.org`; the docs use `developer.world.org`. | `idkit-verifier.ts` | Works for now, but is the legacy domain |
| B5 | **No environment.** `environment` is not sent, and the simulator needs `staging`. | Adapter and verifier | Simulator proofs mismatch (`invalid_network`) |
| B6 | **No replay store.** World confirms a proof is valid; "your backend must check that the nullifier hasn't been used". | Nothing exists | Bindings can be replayed |
| B7 | **Signal is not enforced.** The verifier says it does not check `signal_hash`. | `idkit-verifier.ts` | A proof could be moved to another wallet |
| B8 | **The shrine gates everything.** The arrival run forces a `case-party` check before anyone can reach the courthouse. It asks too early, for the wrong action, and breaks the no-proof-to-watch rule. | `GameWorld.tsx`, `profile.ts`, world seal `verify` | Works directly against what this bounty rewards |
| B9 | **Demo jurors are mock.** | `modes/solo/lib/demoCourt.ts` | The seat moment never reaches World |

---

## 4. Target flow

```
Browser (IDKit)                 apps/server                      World
---------------                 -----------                      -----
Player accepts a jury seat
  │  already bound? ──yes──────► seat granted, no prompt
  │  no
  ├─ GET /world/rp-context ───►  signRequest({ signingKeyHex, action })
  │  ◄── rp_context ───────────  (key never leaves the server)
  ├─ IDKit.request(...).preset(proofOfHuman({ signal }))
  ├─ show connectorURI ────────────────────────────────────────► World App
  │  pollUntilCompletion() ◄───────────────────────────────────  proof
  ├─ POST /world/verify ──────►  check action and signal_hash
  │                              forward payload unchanged ────► POST /api/v4/verify/{rp_id}
  │                              ◄── success, nullifier ───────
  │                              humanId = HMAC(pepper, nullifier)
  │                              bind wallet ↔ humanId (replay store)
  │                              party? ──yes──► `conflicted`
  │  ◄── { ok, humanId, level } 
  └─ seat granted
```

**One proof per person, then a binding.** World says uniqueness proofs are "one-time per action", and that recurring verification of the same action is an anti-pattern. So we do not prove at every seat. The first proof binds wallet to person. Later seats read the binding.

---

## 5. Implementation

### 5.1 Developer Portal setup (needs a human)

1. Create the app at [developer.world.org](https://developer.world.org) in **external** mode (IDKit). The mode is fixed at creation.
2. Save `app_...`, `rp_...` and the **signing key**. World returns the private key **once**. Store it in a password manager. Never commit it or put it in a `VITE_*` variable.
3. Create one action, `cringecourt-juror`, in **staging** for the simulator, and again in **production** for the demo.
4. Test staging proofs with the [simulator](https://simulator.worldcoin.org). The production World App only signs production proofs, and a staging action only verifies against the simulator. All three settings must match.

Environment:

```bash
# apps/server (secrets, never in the web bundle)
RP_SIGNING_KEY=...            # the signing key
HUMAN_ID_PEPPER=...           # at least 16 bytes: openssl rand -hex 32
WORLD_RP_ID=rp_...
WORLD_APP_ID=app_...
WORLD_ACTION=cringecourt-juror
WORLD_ENVIRONMENT=staging     # production for the demo

# apps/web (public)
VITE_IDENTITY=world-idkit
VITE_WORLD_APP_ID=app_...
VITE_WORLD_BACKEND_URL=http://localhost:8787/api/v1/world
VITE_WORLD_ENVIRONMENT=staging
```

Add new variables to the header comments in `platform/config.ts` and `apps/server/src/config.ts`. Keep `mock` as the default, so the demo and tests run without a World account.

### 5.2 Fix the adapter: `apps/web/src/platform/identity/idkitIdentity.ts`

Fixes B1, B3, B5. Ignore `request.action` for the World call; the purpose stays app-side.

```ts
const runtime = await this.#loadRuntime();
const req = await runtime.IDKit
  .request({
    app_id: this.#o.appId,
    action: this.#o.action,                 // one app-wide action
    rp_context: rpContext,
    allow_legacy_proofs: false,             // pin World ID 4.0: one nullifier per person
    environment: this.#o.environment,
  })
  .preset(runtime.proofOfHuman({ signal }), { signal: own.signal });
```

- `signal` comes from the server inside the `rp-context` response, as `wallet:<address>`. It is not built from `request.signal`.
- Replace `orbLegacy`/`deviceLegacy` in `IdkitRuntime` with `proofOfHuman`.
- Add `action` and `environment` to `IdkitIdentityOptions`, and pass them in `createIdentity.ts`.
- Keep the raw result unchanged. World fails mutated proofs.
- Extend `mapIdkitError`: `world_id_4_not_available` and `credential_unavailable` become `not-verified`. World says these are terminal, so do not offer a retry. `inclusion_proof_pending` means retry later.

**Check first (G3):** with `allow_legacy_proofs: false`, confirm a real Orb user gets a 4.0 proof. If the only credential on hand is legacy, the docs' samples use `true` for `proofOfHuman`. In that case keep `true`, and let the server reject a `protocol_version` other than `4.0`, so that only one nullifier type reaches the store.

### 5.3 Fix the verifier: `packages/world-id/src/idkit-verifier.ts`

Fixes B4, B5, B7.

```ts
export const DEFAULT_VERIFY_ENDPOINT = 'https://developer.world.org/api/v4/verify';
```

- Add an `environment` option and send `{ ...proof, environment }`. This is the only field to change; forward everything else as is.
- Add `expectedSignal`. Compare with `hashSignal` from `@worldcoin/idkit-core/hashing`: every response's `signal_hash` must equal `hashSignal(expectedSignal)`. Confirm the exact format on staging, since the docs show different defaults per protocol.
- Prefer the nullifier the Portal returns (`nullifier`, or `results[].nullifier`) over the client's copy. Fail if they differ.
- Read failures from `results[]` too. `all_verifications_failed` carries the real reason there.
- Add the codes `all_verifications_failed` and `app_not_migrated` to `CODE_MAP`.
- Extend the unit tests with the documented success and failure bodies.

### 5.4 Add the server routes: `apps/server`

Fixes B2, B6. Add `@cringe-court/world-id` and `@worldcoin/idkit-core` to `apps/server/package.json`. New file `apps/server/src/world/routes.ts`, called from `route()` after session auth, so a proof binds to a real session.

**`GET {API}/world/rp-context`**

```ts
import { signRequest } from '@worldcoin/idkit-core/signing';

const { sig, nonce, createdAt, expiresAt } = signRequest({
  signingKeyHex: config.world.signingKey,
  action: config.world.action,               // from config, never from the client
});
return json(res, 200, {
  rp_id: config.world.rpId,
  nonce,
  created_at: createdAt,
  expires_at: expiresAt,
  signature: sig,
  signal: `wallet:${session.wallet}`,        // the adapter reads this
});
```

The adapter passes the whole object as `rp_context`, so split `signal` out first. Rate-limit this route with the existing limiter.

**`POST {API}/world/verify`**

```ts
const result = await verifier.verify({ proof, action: config.world.action, wallet });
if (!result.ok) return json(res, 200, result);

const bound = await humans.bind({ humanId: result.humanId, wallet, level: result.level });
if (!bound.ok) return json(res, 200, { ok: false, reason: 'already_verified', message: bound.message, retryable: false });
return json(res, 200, result);
```

Return the `VerificationResult` shape, because the adapter already parses it. Never log or return the raw nullifier.

**The human store, `apps/server/src/world/humans.ts`.** Use the existing JSON-lines store.

| Rule | Behaviour |
|---|---|
| Key | `humanId` (HMAC of the nullifier). The raw nullifier is not stored. |
| Same human, same wallet | Success: they came back |
| Same human, other wallet | Refuse, and tell them which step to take. This is what stops seat farming. |
| New human | Store `{ humanId, wallet, level, verifiedAt }` |

**Seats check the binding, on the server:**

```ts
const human = humans.byWallet(wallet); // a stored VerificationResult, or { ok: false, ... } when unbound
const check = checkJurorEligibility(human, { partyHumanIds, seatedHumanIds });
```

`checkJurorEligibility` already fails closed: `not_verified`, `ineligible_level`, `is_party`, `already_seated`. Call it in the seat path of `apps/server/src/gj/hall.ts` and the Versus room.

**On-chain:** `toAttestation()` is ready for `HumanRegistry.attest`, but the relayer does not exist yet. The bounty accepts server verification, so leave this out of the submission and do not claim it.

### 5.5 Move the proof to the trust moment

Fixes B8, B9.

1. Remove the `verify` seal in `openGatesFor` (`play/profile.ts`), so the arrival run is walkable with no proof. The run becomes wardrobe, then trial gate, then courthouse.
2. Keep the shrine, now optional: "Verify now to skip the wait when a seat opens". It explains the rule before it applies.
3. Update the quest tracker and copy. Keep `play.verify.*` honest: no "everyone must verify".
4. Add a **Take a jury seat** path in the world. The clerk's desk or the jury box door is a natural spot.
5. On accepting a seat, run the proof if there is no binding. Use the existing `session.screen()` path in `modes-grand-jury/src/court.ts`.
6. Grand Jury is the best demo mode: 7 seats, and `DutyPage`/`panels.tsx` already have the screening step.
7. Change `demoCourt.ts` to use `identityFor(...)` for the human juror. NPC jurors stay mock and stay labelled.

### 5.6 Tests

| Layer | Test |
|---|---|
| `packages/world-id` | Host, `environment` forwarded, payload otherwise unchanged, signal mismatch, `results[]` failure, Portal nullifier mismatch |
| Adapter | One action whatever the purpose, `proofOfHuman`, error mapping for `world_id_4_not_available` |
| Server | `signRequest` key never in a response; replay; same human on two wallets; party refused; action taken from config |
| Bundle | `RP_SIGNING_KEY` and `HUMAN_ID_PEPPER` never appear in the `apps/web` build |
| Live | The staging gates in §7, then one production Orb run |

---

## 6. The paths to demonstrate

Demo the first two at minimum. The bounty needs one alternative path. The second is the strongest, since it shows the credential decision working.

| Path | Trigger | What the player sees | Code |
|---|---|---|---|
| **Success** | Orb-verified user accepts a seat | World App approval, seat granted | `result.ok` |
| **No Orb** | User lacks Proof of Human | "A paid seat needs Proof of Human. You can still watch and vote." No retry. | `credential_unavailable`, `world_id_4_not_available` |
| **Party on own jury** | Filer tries to take a seat on their case from a second wallet | "You cannot judge your own case." | `conflicted`, `PartyCannotServe` |
| **Same human, second wallet** | One person, new wallet | "This person already holds a juror wallet." | `humans.bind` |
| **Cancelled** | User declines in World App | Back to the seat offer. No bond taken. | `user_rejected` |

Nothing is charged before the proof passes.

---

## 7. Gates: prove these on staging before claiming them

The docs do not settle these. Test them, and write down the answer in §10.

| # | Question | How to test | If the answer is bad |
|---|---|---|---|
| G1 | Is the nullifier the same across credentials for one person? | Same simulator identity: `proofOfHuman`, then `selfieCheck`, same action | Parties use `proofOfHuman` (§2) |
| G2 | Can one person prove the same action twice? | Verify twice, from two wallets | If World refuses, that second wallet is already blocked, which is safe. Add a support path for lost wallets. If it allows it, `humans.bind` does the blocking. |
| G3 | Does `allow_legacy_proofs: false` work for our users? | Real Orb account | See §5.2 |
| G4 | What is the exact success body? | Log one response in staging | Adjust parsing. The docs give a schema but no example. |
| G5 | What format does `signal_hash` take? | Compare with `hashSignal` | Adjust §5.3 |
| G6 | Does `sandbox` matter? It appears in the schema, with no explanation. | Ask World if it comes up | Ignore it |

**Note for G2:** the package README asks for "unlimited verifications" in the Portal, but the docs reviewed here describe no such setting. Check the Portal, and update the README to match what is there.

---

## 8. Order of work

The event ends 2026-11-07, so this order gets a qualifying submission first.

| Order | Task | Fixes | Needs |
|---|---|---|---|
| 1 | Portal setup, simulator proof by hand | | **Human: app, RP ID, signing key** |
| 2 | Verifier and adapter changes, with tests | B1, B3, B4, B5, B7 | |
| 3 | Server routes and human store | B2, B6 | |
| 4 | First staging success; note the time for the debrief | | |
| 5 | Run gates G1 to G5 | | |
| 6 | Shrine optional; proof at the seat | B8, B9 | |
| 7 | Alternative paths in the UI | | |
| 8 | Production action, one real Orb run | | **Human: Orb-verified phone** |
| 9 | Record the demo; fill in the debrief | | |

**Cut first if time runs out:** the party-credential question (use `proofOfHuman`), Selfie Check tests, and on-chain attestation.

**Do not cut:** server verification, the replay store, and one real alternative path.

---

## 9. Demo script (about 90 seconds)

1. Open the game and walk in. No prompt: "Watching needs no proof."
2. Open a Grand Jury case and take a seat. "This seat pays and decides a verdict, so it needs a unique human."
3. Approve in World App. The seat is granted.
4. Show the server log: verified, stored `humanId`, no raw nullifier.
5. Switch to the filer's wallet and try to sit on their own case. Refused.
6. Show a no-Orb account. It is refused with a clear message, and can still watch.
7. Close on: "One credential, at the one moment that needs it."

Only show what ran live. Keep the mock labelled if any step falls back to it.

---

## 10. Integration debrief (fill in from real runs)

The bounty requires this. Do not write it ahead of time, and use measured numbers only.

```md
### IDKit integration debrief

**Time to first success:** ___ (Portal app created → first verified proof on staging)

**Trust event and credential:** Accepting a paid jury seat, Proof of Human, because ___

**Friction encountered:**
- ___

**Missing capability or documentation:**
- ___

**The one improvement with the greatest impact:** ___
```

Candidates seen while writing this plan. Keep only those you actually hit.

- `sybil_score` has no documented direction or maximum, so a threshold cannot be set from the docs.
- The docs do not say whether one person's nullifier differs across credentials.
- The verify reference gives a response schema with no success example.
- `invalid_proof`, `verification_failed` and `not_registered` appear in one doc but not in the verify reference.
- `allow_legacy_proofs` has no single recommendation for new apps.

---

## 11. Privacy and security rules

- The signing key and pepper stay on the server, and `action` always comes from server config.
- Never trust a frontend success. Only the Portal's verdict counts.
- Forward the IDKit result unchanged.
- Store `humanId`, never the raw nullifier, and never log either alongside a wallet.
- Never show a real identity. World ID proves a person is unique, not who they are.
- Copy must not promise impartiality or zero collusion.

---

## 12. Done checklist

- [ ] Portal app, RP and action created; keys stored safely
- [ ] B1 to B9 fixed
- [ ] Gates G1 to G5 answered and recorded
- [ ] Unit, adapter and server tests pass; secrets are absent from the web bundle
- [ ] Real production verification recorded
- [ ] At least one alternative path recorded
- [ ] Trust event and credential reasoning in the submission text (§2)
- [ ] Debrief filled in with measured numbers (§10)
- [ ] `docs/DECISIONS.md` updated if parties change credential
- [ ] Mock labelled wherever it remains

---

## Sources

- [IDKit integrate](https://docs.world.org/world-id/idkit/integrate)
- [IDKit credentials](https://docs.world.org/world-id/idkit/credentials)
- [Verify API reference](https://docs.world.org/api-reference/developer-portal/verify)
- [IDKit error codes](https://docs.world.org/world-id/idkit/error-codes)
- [World ID 4.0 migration](https://docs.world.org/world-id/4-0-migration)
- [Verification flows](https://docs.world.org/world-id/idkit/verification-flows)
- [World ID agent skill](https://docs.world.org/world-id/SKILL)

In this repo: `packages/world-id/README.md`, `docs/DECISIONS.md`, `idea/CringeCourt_V4_Product_Vision_Fairness_Fixes(1).md` §10.
