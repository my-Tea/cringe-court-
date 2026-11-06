# @cringe-court/world-id

Server-side World ID verification for CringeCourt (testnet only, D14). Turns an IDKit proof into a private, app-wide
`humanId` plus an identity level, and prepares the arguments for `HumanRegistry.attest`. Backend, Node >= 20 only
(`node:crypto`).

## Flow

```
Client (IDKit)                Backend                               Chain
--------------                -------                               -----
signRequest (server) -> rp_context
IDKit.request(...).preset(orbLegacy/...) 
pollUntilCompletion() -> completion.result
        |  POST proof + wallet
        v
                 IdkitVerifier.verify()
                   -> POST developer.worldcoin.org/api/v4/verify/{WORLD_RP_ID}
                   -> humanId = HMAC-SHA256(pepper, nullifier)
                 checkJurorEligibility()  (level, party, seated)
                 toAttestation()  ------------------------>  HumanRegistry.attest(wallet, humanId, level, expiresAt)
```

A frontend "success" is never trusted; only the Developer Portal verdict is. One app-wide action means the same person
gets the same `humanId` across wallets, so filers and Versus parties can be excluded from their own jury.

## API

- `IdentityLevel` `{NONE:0, DEVICE:1, DOCUMENT:2, ORB:3}` (matches on-chain uint8).
- `deriveHumanId(nullifier, pepper)`: HMAC-SHA256 over the 32-byte big-endian nullifier. Accepts decimal, `0x` hex, `nil_`+64 hex, bigint; equal numbers give equal ids. Pepper >= 16 bytes.
- `IdkitVerifier({rpId, appId?, action, pepper, minLevel?, fetch?, endpoint?, timeoutMs?, now?})` -> `verify({proof, action, wallet})` returns `VerificationResult`. Failure reasons: `invalid_proof | ineligible_level | already_verified | cancelled | expired | wrong_action | network | malformed`; only `network` is retryable. The nullifier is never logged or returned.
- `MockVerifier` / `mockProof(persona, opts)` / `MockVerifier.personas`: deterministic, for tests and demo. Same persona on two wallets gives the same humanId; `oncePerAction` option; `minLevel` gives the ineligible path.
- `JUROR_MIN_LEVEL` (ORB), `PARTY_MIN_LEVEL` (DEVICE), `checkJurorEligibility`, `toAttestation` (`now` in ms, `expiresAt` bigint seconds), `JUROR_SCREENING_COPY`.

## Backend env var names

`WORLD_RP_ID`, `WORLD_APP_ID`, `WORLD_ACTION`, `HUMAN_ID_PEPPER` (plus the RP signing key used with `signRequest`, kept out of this package).

## IDKit types relied on

From `@worldcoin/idkit-core@4.6.0`, `node_modules/@worldcoin/idkit-core/dist/index.d.ts` (and `@worldcoin/idkit-server/dist/nullifier.d.ts`):

- `IDKitResult = IDKitResultV3 | IDKitResultV4 | IDKitResultSession`; the verifier reads `result.action` (optional) and `result.responses[]`.
- `responses[i].identifier: string` (`"proof_of_human"`, `"passport"`, `"mnc"`, `"selfie"` per `CredentialType`) and `responses[i].nullifier: string`. V4: decimal, RP-scoped. V3 legacy: hex.
- The highest-level response wins; its nullifier feeds `deriveHumanId`.
- Error codes (`IDKitErrorCodes`, e.g. `user_rejected`, `max_verifications_reached`, `nullifier_replayed`, timestamp/expiry codes) inform the code-to-reason mapping, used when the Portal returns a `code`/`error` string or the client forwards `{error}`.
- Level mapping: proof_of_human/orb -> ORB; passport/mnc/eid/document/secure_document -> DOCUMENT; selfie/device -> DEVICE; anything else -> NONE. Selfie maps to DEVICE because Self Check does not guarantee uniqueness (V4 section 10).

## Verified vs not

Verified: 26 unit tests (vitest, injected fake fetch, no network) for humanId, IdkitVerifier paths (success, device rejected, wrong action, already-verified, 400, 500, timeout, malformed, request URL/body), MockVerifier, eligibility and attestation shape; `typecheck` and `build` pass.

Not verified / uncertain:
- No live call to the Developer Portal; no staging app/rp ids configured.
- The exact v4 verify response body is NOT confirmed. The code reads only `success` (boolean) and, defensively, string `code`, `error`, `attribute`, and an echoed `action`. Code strings in the already-verified mapping (`max_verifications_reached`, `nullifier_replayed`, `already_verified`) come from IDKit's error enum, not from a captured Portal response. Unknown failures fall back to `invalid_proof`.
- The Portal verdict is trusted for proof validity and signal binding; this package does not itself check `signal_hash` against `req.signal`.
- V3 (legacy) and V4 nullifiers for the same person differ, so the same human gets different humanIds under each protocol. Pin the request to one protocol (or run the app-wide action consistently) before claiming full cross-wallet exclusion. Test real nullifier semantics on staging.
- Legacy-proof credential identifiers (e.g. `orb`, `device`) are mapped by name guess.
- `@worldcoin/idkit-core` is installed for its types and client/signing helpers; this package does not import it at runtime.

## Gates to close on staging before claiming party exclusion

1. **Same human, same id across credentials.** Filers and Versus sides need DEVICE, jurors need ORB. If World ID derives a
   different nullifier per credential (selfie vs proof of human), a filer's selfie-based `humanId` will not match their
   own orb-verified juror wallet, and `PartyCannotServe` will not fire. Check this on staging. If nullifiers differ,
   require the same credential (proof of human) for parties too. That only changes `minPartyLevel` in
   `contracts/config/terms.json` and the IDKit preset.
2. **Re-verification must be allowed.** Set the app-wide action to unlimited verifications in the Developer Portal, so
   attestation renewals and wallet changes re-derive the same `humanId`. `already_verified` is then a configuration
   error, not a user state.
3. **One protocol.** Pin V4 proofs (`allow_legacy_proofs: false`), since V3 and V4 nullifiers differ (see above).
