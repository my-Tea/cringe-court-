import type { ConnectHandler } from './idkitIdentity';

export interface ConnectRequest {
  uri: string;
  cancel: () => void;
}
type Listener = (req: ConnectRequest | null) => void;

const listeners = new Set<Listener>();
let current: ConnectRequest | null = null;

/** Subscribe to connect requests (used by the host component and the hook). */
export function subscribeWorldIdConnect(fn: Listener): () => void {
  listeners.add(fn);
  fn(current);
  return () => {
    listeners.delete(fn);
  };
}

/** Default `onConnect`: shows the link in the app-wide dialog; the returned cleanup closes it. */
export const presentWorldIdConnect: ConnectHandler = (uri, cancel) => {
  const req: ConnectRequest = { uri, cancel };
  current = req;
  listeners.forEach((l) => l(req));
  return () => {
    if (current === req) {
      current = null;
      listeners.forEach((l) => l(null));
    }
  };
};
