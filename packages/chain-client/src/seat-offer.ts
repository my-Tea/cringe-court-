import type { Address, Hex } from "./types.js";

/** EIP-712 domain and types used by CringeCourt.acceptSeat. */
export function seatOfferDomain(chainId: bigint | number, court: Address) {
  return { name: "CringeCourt", version: "1", chainId: BigInt(chainId), verifyingContract: court } as const;
}

export const SEAT_OFFER_TYPES = {
  SeatOffer: [
    { name: "caseId", type: "uint256" },
    { name: "juror", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

/** Anything that can sign typed data: a viem LocalAccount or WalletClient-bound signer. */
export interface TypedDataSigner {
  address: Address;
  signTypedData(args: {
    domain: ReturnType<typeof seatOfferDomain>;
    types: typeof SEAT_OFFER_TYPES;
    primaryType: "SeatOffer";
    message: { caseId: bigint; juror: Address; expiresAt: bigint };
  }): Promise<Hex>;
}

/** Backend assigner: signs a random seat offer for one juror (V4 §6 step 3). */
export async function signSeatOffer(
  assigner: TypedDataSigner,
  p: { chainId: bigint | number; court: Address; caseId: bigint; juror: Address; expiresAt: bigint },
) {
  const signature = await assigner.signTypedData({
    domain: seatOfferDomain(p.chainId, p.court),
    types: SEAT_OFFER_TYPES,
    primaryType: "SeatOffer",
    message: { caseId: p.caseId, juror: p.juror, expiresAt: p.expiresAt },
  });
  return { caseId: p.caseId, juror: p.juror, expiresAt: p.expiresAt, signature };
}
