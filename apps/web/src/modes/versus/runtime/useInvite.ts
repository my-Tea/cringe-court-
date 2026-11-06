/**
 * Invites on a shared court: a device must ask the court server for an invite
 * (by code, or the signed token in the link) before the case reaches it. On
 * this device's demo court both hooks are no-ops.
 */
import { invitePath, type InviteCode, type VersusCase } from '@cringe-court/modes-versus';
import { BackendError } from '@cringe-court/net';
import { useCallback, useEffect, useState } from 'react';
import { describeBackendError } from '@/platform/backend/messages';
import { useVersus } from './context';

export type InviteAccess = { state: 'ready' } | { state: 'pending' } | { state: 'error'; message: string; retry: () => void };

/** Open the invite with this code on the court server (no-op locally). */
export function useInviteAccess(code: InviteCode | null): InviteAccess {
  const { openInvite } = useVersus();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; access: InviteAccess } | null>(null);
  const key = `${code ?? ''}:${attempt}`;
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    if (!openInvite || !code) return;
    let live = true;
    const token = new URLSearchParams(window.location.search).get('t') ?? undefined;
    openInvite(code, token).then(
      () => live && setState({ key, access: { state: 'ready' } }),
      (err: unknown) => live && setState({ key, access: { state: 'error', message: err instanceof BackendError ? describeBackendError(err) : String(err), retry } }),
    );
    return () => {
      live = false;
    };
  }, [openInvite, code, key, retry]);

  if (!openInvite || !code) return { state: 'ready' };
  return state?.key === key ? state.access : { state: 'pending' };
}

/** The link Side A sends: on a shared court it carries the server's signed token. */
export function useInviteUrl(c: VersusCase): string {
  const { inviteUrl } = useVersus();
  const plain = `${window.location.origin}${invitePath(c.code)}`;
  const [signed, setSigned] = useState<{ trialId: string; url: string } | null>(null);
  useEffect(() => {
    if (!inviteUrl) return;
    let live = true;
    inviteUrl(c.trialId).then(
      (url) => live && setSigned({ trialId: c.trialId, url }),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [inviteUrl, c.trialId]);
  return signed?.trialId === c.trialId ? signed.url : plain;
}
