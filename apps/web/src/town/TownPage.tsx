/**
 * `/town` — the explorable isometric town.
 *
 * Its own lazy chunk, like `/court/walk`: three.js never weighs on the rest of
 * the app. The page owns loading, the error state and the map shortcuts; all the
 * behaviour lives in `@cringe-court/scene/iso`.
 */
import { useCallback, useEffect, useState } from 'react';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { paths } from '@/app/routes';
import { Link } from 'react-router';
import { ROAM_URLS, parseCast, type CastFile } from '@cringe-court/scene/roam';
import { IsoTown } from '@cringe-court/scene/iso/react';
import type { IsoRenderer } from '@cringe-court/scene/iso/three';
import { MAP_ORDER, loadTownData, type IsoController, type MapId, type TownData } from '@cringe-court/scene/iso';
import { fetchJson } from '@cringe-court/scene';
import { t } from '@/i18n';

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; data: TownData; cast: CastFile }
  | { kind: 'error'; message: string };

const SHORTCUTS: ReadonlyArray<{ id: MapId; label: string; spawn: string }> = MAP_ORDER.map((id) => ({
  id,
  label: id,
  spawn: id === 'square' ? 'from-square' : id === 'courthouse' ? 'entrance' : 'from-square',
}));

export function TownPage() {
  useDocumentTitle(t('trial.town.title'));
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = typeof window === 'undefined' ? '' : window.location.search;
    const reduced = reducedMotion || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    let cancelled = false;
    (async () => {
      try {
        const cast = parseCast(await fetchJson(ROAM_URLS.cast));
        const data = await loadTownData(cast, { reducedMotion: reduced });
        if (!cancelled) setStatus({ kind: 'ready', data, cast });
        // `?debug` exposes the controller for scripted screenshots, matching
        // the convention the roam sandbox already uses.
        if (query.includes('debug')) {
          (window as unknown as { __town?: unknown }).__town = { controller: data.controller };
        }
      } catch (err) {
        if (!cancelled) setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reducedMotion]);

  const onExit = useCallback(() => {
    window.location.assign(paths.court);
  }, []);

  const controller: IsoController | null = status.kind === 'ready' ? status.data.controller : null;

  return (
    <main style={page} aria-label={t('trial.town.title')}>
      <header style={header}>
        <Link to={paths.court} style={link}>
          {t('trial.town.back')}
        </Link>
        <h1 style={title}>{t('trial.town.title')}</h1>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} />
          {t('trial.town.reducedMotion')}
        </label>
      </header>

      {status.kind === 'loading' ? <p style={{ padding: 24 }}>{t('trial.town.loading')}</p> : null}
      {status.kind === 'error' ? (
        <div role="alert" style={{ padding: 24 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{t('trial.town.error')}</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{status.message}</pre>
        </div>
      ) : null}

      {controller && status.kind === 'ready' ? (
        <div style={shell}>
          <IsoTown
            controller={controller}
            cast={status.cast}
            onExit={onExit}
            onRenderer={(r: IsoRenderer) => {
              if (typeof window !== 'undefined' && window.location.search.includes('debug')) {
                (window as unknown as { __town?: { renderer?: IsoRenderer } }).__town = {
                  ...((window as unknown as { __town?: object }).__town ?? {}),
                  renderer: r,
                };
              }
            }}
          >
            <div style={shortcuts}>
              {SHORTCUTS.map((s) => (
                <button key={s.id} style={chip} onClick={() => controller.teleport(s.id, s.spawn)}>
                  {s.label}
                </button>
              ))}
            </div>
          </IsoTown>
        </div>
      ) : null}
    </main>
  );
}

const page: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 84px)', minHeight: 420, overflow: 'hidden' };
const header: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '10px 16px',
  borderBottom: '3px solid #4A3A32',
  background: 'var(--cc-color-surface, #FFF9ED)',
  flex: '0 0 auto',
};
const title: React.CSSProperties = { margin: 0, fontSize: 18, flex: 1 };
const link: React.CSSProperties = { color: 'inherit', fontSize: 14 };
const shell: React.CSSProperties = { flex: '1 1 auto', minHeight: 0, position: 'relative', overflow: 'hidden' };
const shortcuts: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  justifyContent: 'center',
  pointerEvents: 'auto',
  maxWidth: 'min(90%, 620px)',
};
const chip: React.CSSProperties = {
  font: 'inherit',
  fontSize: 12,
  padding: '4px 8px',
  cursor: 'pointer',
  border: '2px solid #4A3A32',
  background: 'var(--cc-color-surface, #FFF9ED)',
  textTransform: 'capitalize',
};
