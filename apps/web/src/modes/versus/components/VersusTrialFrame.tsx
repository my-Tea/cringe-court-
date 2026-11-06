import { useMemo } from 'react';
import type { Viewer } from '@cringe-court/modes-versus';
import type { PlayerRole, SpawnId } from '@cringe-court/scene/roam';
import { t } from '@/i18n';
import { TrialViewFrame } from '@/trial/TrialViewFrame';
import { versusBeats } from '../roam/beats';
import { useVersus } from '../runtime/context';
import { TrialView, type TrialViewProps } from './TrialView';

/** Where each kind of viewer sits: Side A at the prosecution table, Side B at the defence table, jurors in the box, everyone else in the aisle. */
function roamSeating(viewer: Viewer): { role: PlayerRole; spawn: SpawnId } {
  if (viewer === 'a') return { role: 'side-a', spawn: 'prosecution' };
  if (viewer === 'b') return { role: 'side-b', spawn: 'defendant' };
  if (viewer === 'juror') return { role: 'juror', spawn: 'jury-box' };
  return { role: 'spectator', spawn: 'aisle' };
}

/** A Versus hearing: the roaming courtroom first, the 2D stage as the fallback. */
export function VersusTrialFrame({ viewer, ...classic }: TrialViewProps & { viewer: Viewer }) {
  const { persona } = useVersus();
  const { lines, verdict, filing } = classic;
  const beats = useMemo(() => versusBeats(lines, verdict ?? undefined), [lines, verdict]);
  const { role, spawn } = roamSeating(viewer);
  return (
    <TrialViewFrame
      classic={<TrialView {...classic} />}
      roam={{ beats, label: t('versus.court.label', { title: filing.title }), role, spawn, avatar: { model: 'creator', name: persona.name } }}
    />
  );
}
