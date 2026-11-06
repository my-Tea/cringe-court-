/**
 * Browser-safe entry (`@cringe-court/world-id/client`).
 * Re-exports only modules with no `node:` imports. The server pieces
 * (human-id, idkit-verifier, mock-verifier) stay in the root entry.
 */
export * from './types.js';
export * from './eligibility.js';
export * from './level.js';
