import { encodeAbiParameters, keccak256, toHex } from "viem";
import type { Address, Choice, Hex } from "./types.js";

export interface CommitmentInput {
  chainId: bigint | number;
  court: Address;
  caseId: bigint;
  juror: Address;
  choice: Choice;
  salt: Hex;
}

/** Same bytes as CringeCourt.commitmentOf: keccak256(abi.encode(chainid, court, caseId, juror, choice, salt)). */
export function commitmentOf(i: CommitmentInput): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint8" },
        { type: "bytes32" },
      ],
      [BigInt(i.chainId), i.court, i.caseId, i.juror, i.choice, i.salt],
    ),
  );
}

/** 32 random bytes from the platform CSPRNG. */
export function randomSalt(): Hex {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/**
 * The "Secret Verdict Scroll": everything a juror needs to reveal, in one
 * copyable string, so a lost tab never costs a bond (V4 §7 UX safeguard).
 * It contains the choice, so it must stay private until the reveal.
 */
export type Scroll = CommitmentInput;

const SCROLL_PREFIX = "ccscroll1:";

export function encodeScroll(s: Scroll): string {
  const body = [String(s.chainId), s.court, s.caseId.toString(), s.juror, String(s.choice), s.salt].join(":");
  return SCROLL_PREFIX + body;
}

export function decodeScroll(text: string): Scroll {
  const t = text.trim();
  if (!t.startsWith(SCROLL_PREFIX)) throw new Error("not a CringeCourt scroll");
  const parts = t.slice(SCROLL_PREFIX.length).split(":");
  if (parts.length !== 6) throw new Error("damaged scroll");
  const [chainId, court, caseId, juror, choice, salt] = parts;
  if (choice !== "0" && choice !== "1") throw new Error("damaged scroll");
  if (!/^0x[0-9a-fA-F]{40}$/.test(court) || !/^0x[0-9a-fA-F]{40}$/.test(juror) || !/^0x[0-9a-fA-F]{64}$/.test(salt)) {
    throw new Error("damaged scroll");
  }
  return {
    chainId: BigInt(chainId),
    court: court as Address,
    caseId: BigInt(caseId),
    juror: juror as Address,
    choice: Number(choice) as Choice,
    salt: salt as Hex,
  };
}

/** Seals a ballot: returns the commitment to send and the scroll to keep. */
export function sealBallot(i: Omit<CommitmentInput, "salt"> & { salt?: Hex }) {
  const input = { ...i, salt: i.salt ?? randomSalt() };
  return { commitment: commitmentOf(input), scroll: encodeScroll(input), salt: input.salt };
}
