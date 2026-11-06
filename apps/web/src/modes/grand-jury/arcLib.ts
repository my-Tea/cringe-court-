import { GRAND_JURY_QUESTIONS } from '@cringe-court/net';
import { keccak256, stringToBytes } from 'viem';

export const CIRCLE_FAUCET = 'https://faucet.circle.com';
export const METAMASK_DOWNLOAD = 'https://metamask.io/download/';

const TITLES = new Map<string, string>(GRAND_JURY_QUESTIONS.map((q) => [keccak256(stringToBytes(q)), q]));

/** The chain stores a hash. A case the court did not publish has no title to show. */
export const questionOf = (contentHash: string | null): string | null => (contentHash ? (TITLES.get(contentHash.toLowerCase()) ?? null) : null);
