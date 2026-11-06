import { IdentityLevel } from './types.js';

/** Map an IDKit response `identifier` to a level. Unknown identifiers -> NONE. Pure: safe in the browser. */
export function levelFromCredential(identifier: string): IdentityLevel {
  const id = identifier.toLowerCase().replace(/[\s-]+/g, '_');
  if (id === 'proof_of_human' || id === 'orb') return IdentityLevel.ORB;
  if (['passport', 'mnc', 'eid', 'document', 'secure_document'].includes(id)) return IdentityLevel.DOCUMENT;
  if (id === 'selfie' || id === 'device') return IdentityLevel.DEVICE;
  return IdentityLevel.NONE;
}
