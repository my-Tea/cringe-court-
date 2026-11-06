import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { subscribeWorldIdConnect, type ConnectRequest } from './connectBridge';
import type { ConnectHandler } from './idkitIdentity';
import { WorldIdConnectDialog } from './WorldIdConnectDialog';

/** App-wide host for the default connect flow; mount once near the root. */
export function WorldIdConnectHost(): ReactNode {
  const [req, setReq] = useState<ConnectRequest | null>(null);
  useEffect(() => subscribeWorldIdConnect(setReq), []);
  return <WorldIdConnectDialog uri={req?.uri ?? null} onCancel={() => req?.cancel()} />;
}

/** Local alternative to the host: `onConnect` for an IdkitIdentityPort plus the dialog element to render. */
export function useWorldIdConnect(): { onConnect: ConnectHandler; dialog: ReactNode } {
  const [req, setReq] = useState<ConnectRequest | null>(null);
  const onConnect = useCallback<ConnectHandler>((uri, cancel) => {
    const mine = { uri, cancel };
    setReq(mine);
    return () => setReq((r) => (r === mine ? null : r));
  }, []);
  return { onConnect, dialog: <WorldIdConnectDialog uri={req?.uri ?? null} onCancel={() => req?.cancel()} /> };
}
