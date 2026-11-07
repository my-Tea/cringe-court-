import { useCallback, useMemo, useState } from 'react';
import type { Viewer } from '@cringe-court/modes-versus';
import type { PlayerRole, SpawnId } from '@cringe-court/scene/roam';
import { Icon, PaperButton } from '@/ds';
import { t } from '@/i18n';
import { sideLabel } from '@/i18n/domain';
import hearingStyles from '@/trial/Hearing.module.css';
import { __isJuryGatherSkippedForTests, JuryGather } from '@/trial/JuryGather';
import { TrialViewFrame } from '@/trial/TrialViewFrame';
import { VoteReveal, type VoteScroll } from '@/trial/VoteReveal';
import { versusBeats } from '../roam/beats';
import { useVersus } from '../runtime/context';
import { TrialView, type TrialViewProps } from './TrialView';

type Phase = 'gather' | 'trial' | 'voting' | 'done';

/** Where each kind of viewer sits: Side A at the prosecution table, Side B at the defence table, jurors in the box, everyone else in the aisle. */
function roamSeating(viewer: Viewer): { role: PlayerRole; spawn: SpawnId } {
  if (viewer === 'a') return { role: 'side-a', spawn: 'prosecution' };
  if (viewer === 'b') return { role: 'side-b', spawn: 'defendant' };
  if (viewer === 'juror') return { role: 'juror', spawn: 'jury-box' };
  return { role: 'spectator', spawn: 'aisle' };
}

/** Build the vote reel from this case's seats (revealed choices only — no Solo NPC demo cast). */
function scrollsFromSeats(seats: TrialViewProps['seats'], jurySize: number, ballot: readonly [string, string]): VoteScroll[] | null {
  const list = seats ?? [];
  const opened = list.filter((s) => s.revealed && s.choice !== undefined);
  if (opened.length === 0) return null;
  return Array.from({ length: Math.max(jurySize, list.length) }, (_, i) => {
    const s = list[i];
    const choice = s?.revealed && s.choice !== undefined ? s.choice : null;
    return {
      seat: s?.seat ?? i + 1,
      name: t('trial.vote.juror', { n: i + 1 }),
      choice,
      line: choice === null ? undefined : t('versus.trial.scrollLine', { choice: ballot[choice] }),
    };
  });
}

export interface VersusTrialFrameProps extends TrialViewProps {
  viewer: Viewer;
  /**
   * Seat-fill ceremony before the hearing (Mode 1 parity). Off for draft
   * preview, where the jury has not been summoned yet.
   */
  gather?: boolean;
  /**
   * After gather → trial → (optional vote reel), call so the parent can show
   * the ballot / deliberation card again.
   */
  onCeremonyDone?: () => void;
  /** When false, skip the post-trial vote reel (draft preview / replay). */
  voteReel?: boolean;
}

/**
 * A Versus hearing with Solo parity: jury gather → full-bleed roam trial →
 * vote reel from this case's seats → hand back to the case room.
 */
export function VersusTrialFrame({
  viewer,
  gather = true,
  onCeremonyDone,
  voteReel = true,
  ...classic
}: VersusTrialFrameProps) {
  const { persona } = useVersus();
  const { lines, verdict, filing, jurySize, seats } = classic;
  const seatsN = Math.max(1, jurySize ?? 3);
  const ballot = useMemo(
    () => [sideLabel('a', filing.sides.a, { quotes: true }), sideLabel('b', filing.sides.b, { quotes: true })] as const,
    [filing.sides.a, filing.sides.b],
  );
  const beats = useMemo(() => versusBeats(lines, verdict ?? undefined), [lines, verdict]);
  const { role, spawn } = roamSeating(viewer);
  const [phase, setPhase] = useState<Phase>(() => (gather && !__isJuryGatherSkippedForTests() ? 'gather' : 'trial'));
  const scrolls = useMemo(() => scrollsFromSeats(seats, seatsN, ballot), [seats, seatsN, ballot]);

  const finishCeremony = useCallback(() => {
    setPhase('done');
    onCeremonyDone?.();
  }, [onCeremonyDone]);

  const afterTrial = useCallback(() => {
    if (voteReel && scrolls && scrolls.some((s) => s.choice !== null)) setPhase('voting');
    else finishCeremony();
  }, [voteReel, scrolls, finishCeremony]);

  const onSeated = useCallback(() => setPhase('trial'), []);

  if (phase === 'gather') {
    return <JuryGather jurors={seatsN} onSeated={onSeated} />;
  }

  if (phase === 'voting' && scrolls) {
    return (
      <VoteReveal
        votes={scrolls}
        ballot={ballot}
        onDone={finishCeremony}
        outcomeLabel={verdict === 'a' ? ballot[0] : verdict === 'b' ? ballot[1] : verdict === 'none' ? t('versus.roam.noVerdict') : null}
      />
    );
  }

  if (phase === 'done') {
    // Ballot / deliberation stay in the parent TrialPanel under this status.
    return (
      <p role="status" className={hearingStyles.lede}>
        {t('trial.vote.done')}
      </p>
    );
  }

  return (
    <div className={hearingStyles.court}>
      <h1 className="cc-visually-hidden">{filing.title}</h1>
      <TrialViewFrame
        classic={<TrialView {...classic} />}
        roam={{
          beats,
          label: t('versus.court.label', { title: filing.title }),
          role,
          spawn,
          jurors: seatsN,
          avatar: { model: 'defendant', name: persona.name },
          onDone: afterTrial,
        }}
        toolbar={
          <PaperButton size="sm" variant="maroon" onClick={afterTrial} iconEnd={<Icon name="arrow-right" />}>
            {t('trial.vote.skip')}
          </PaperButton>
        }
      />
    </div>
  );
}
