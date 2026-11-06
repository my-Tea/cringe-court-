/** Numbers MUST match the on-chain HumanRegistry uint8 levels. */
export const IdentityLevel = { NONE: 0, DEVICE: 1, DOCUMENT: 2, ORB: 3 } as const;
export type IdentityLevel = (typeof IdentityLevel)[keyof typeof IdentityLevel];

export interface VerificationRequest {
  /** IDKit `completion.result` exactly as received from the client (untrusted). */
  proof: unknown;
  /** App-wide action/context the proof must belong to. */
  action: string;
  signal?: string;
  wallet: `0x${string}`;
}

export type FailureReason =
  | 'invalid_proof'
  | 'ineligible_level'
  | 'already_verified'
  | 'cancelled'
  | 'expired'
  | 'wrong_action'
  | 'network'
  | 'malformed';

export type VerificationResult =
  | {
      ok: true;
      /** bytes32: keyed hash of the nullifier. Never the raw nullifier. */
      humanId: `0x${string}`;
      level: IdentityLevel;
      action: string;
      /** unix seconds */
      verifiedAt: number;
    }
  | { ok: false; reason: FailureReason; message: string; retryable: boolean };

export interface IdentityVerifier {
  readonly kind: 'idkit' | 'mock';
  verify(req: VerificationRequest): Promise<VerificationResult>;
}
