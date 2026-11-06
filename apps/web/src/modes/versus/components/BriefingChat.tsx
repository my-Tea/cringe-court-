import type { AngleSuggestion, Category, SideId } from '@cringe-court/core';
import { BRIEFING_QUESTIONS, BRIEFING_STEPS, agentReply, composeStory, type BriefingDraft, type BriefingStep } from '@cringe-court/modes-versus';
import { useEffect, useId, useRef, useState } from 'react';
import { t } from '@/i18n';
import { Icon, PaperButton, Portrait, RadioCards, Spinner, TextArea, TextField } from '@/ds';
import { agentName as agentNameOf } from '../copy';
import { useVersus } from '../runtime/context';
import styles from './Briefing.module.css';

const FIELD: Record<Exclude<BriefingStep, 'angle'>, keyof BriefingDraft> = { happened: 'happened', why: 'why', private: 'privateNotes' };

export interface BriefingChatProps {
  side: SideId;
  category: Category;
  value: BriefingDraft;
  onChange: (draft: BriefingDraft) => void;
  onDone: () => void;
  /** Used to seed angle suggestions; any stable string works before the case exists. */
  trialId: string;
}

/**
 * The private intake with your own agent (GAME-MODES §3 step 2): four short
 * turns. Nothing here is sent anywhere until the side reviews and approves it.
 */
export function BriefingChat({ side, category, value, onChange, onDone, trialId }: BriefingChatProps) {
  const { desk } = useVersus();
  const agent = side === 'a' ? 'side-a' : 'side-b';
  const agentName = agentNameOf(side);
  const answered = BRIEFING_STEPS.findIndex((s) => (s === 'angle' ? !value.angle.trim() : s === 'private' ? false : !value[FIELD[s]].trim()));
  const [turn, setTurn] = useState(() => (answered < 0 ? BRIEFING_STEPS.length - 1 : Math.min(answered, BRIEFING_STEPS.length - 1)));
  const step = BRIEFING_STEPS[turn]!;
  const q = BRIEFING_QUESTIONS[step];
  const [error, setError] = useState<string | null>(null);
  const [angles, setAngles] = useState<readonly AngleSuggestion[] | null>(null);
  const [angleChoice, setAngleChoice] = useState<string>('');
  const logRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const moved = useRef(false);
  const composerId = useId();

  useEffect(() => {
    if (step !== 'angle' || angles) return;
    let live = true;
    desk
      .suggestAngles(trialId, composeStory(value), value.privateNotes, side, category)
      .then((list) => {
        if (!live) return;
        setAngles(list);
        const match = list.find((a) => a.text === value.angle);
        setAngleChoice(match ? match.id : value.angle ? 'own' : '');
      })
      .catch(() => live && setAngles([]));
    return () => {
      live = false;
    };
  }, [step, angles, desk, trialId, value, side, category]);

  // After each turn, bring the new question into view and put the cursor in the answer box (not on first render).
  useEffect(() => {
    if (!moved.current) {
      moved.current = true;
      return;
    }
    logRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    inputRef.current?.focus();
  }, [turn]);

  const answerOf = (s: BriefingStep) => (s === 'angle' ? value.angle : value[FIELD[s]]);

  const next = () => {
    const text = answerOf(step).trim();
    if (step !== 'angle' && !q.optional && text.length < q.minChars) {
      setError(t('versus.chat.error.short', { min: q.minChars, have: text.length }));
      return;
    }
    if (step === 'angle' && !text) {
      setError(t('versus.chat.error.angle'));
      return;
    }
    setError(null);
    if (turn === BRIEFING_STEPS.length - 1) onDone();
    else setTurn(turn + 1);
  };

  const set = (patch: Partial<BriefingDraft>) => {
    setError(null);
    onChange({ ...value, ...patch });
  };

  return (
    <section className={styles.chat} data-side={side} aria-labelledby={`${composerId}-title`}>
      <header className={styles.chatHead}>
        <Portrait character={agent} expression="smug" size="md" ring={side === 'a' ? 'side-a' : 'side-b'} alt="" />
        <div>
          <h2 id={`${composerId}-title`} className={styles.chatTitle}>
            {t('versus.chat.title', { name: agentName })}
          </h2>
          <p className={styles.chatSub}>
            <Icon name="lock" aria-hidden /> {t('versus.chat.sub', { step: turn + 1, total: BRIEFING_STEPS.length })}
          </p>
        </div>
      </header>

      <div className={styles.log} role="log" aria-live="polite" aria-label={t('versus.chat.logAria', { name: agentName })}>
        <ol className={styles.turns} ref={logRef}>
        {BRIEFING_STEPS.slice(0, turn + 1).map((s, i) => {
          const ask = BRIEFING_QUESTIONS[s];
          const answer = answerOf(s).trim();
          const done = i < turn;
          return (
            <li key={s} className={styles.turn}>
              <p className={styles.agentBubble}>
                <span className="cc-visually-hidden">{t('versus.chat.said', { name: agentName })}</span>
                {ask.ask}
                {ask.visibility === 'private' && s === 'private' && (
                  <span className={styles.privateTag}>
                    <Icon name="lock" aria-hidden /> {t('versus.chat.lawyerOnly')}
                  </span>
                )}
              </p>
              {done && (
                <>
                  <p className={styles.userBubble}>
                    <span className="cc-visually-hidden">{t('versus.chat.you')}</span>
                    {answer || <em>{t('versus.chat.skipped')}</em>}
                  </p>
                  <p className={styles.agentBubble} data-small>
                    <span className="cc-visually-hidden">{t('versus.chat.said', { name: agentName })}</span>
                    {agentReply(s, answer, side)}
                  </p>
                </>
              )}
            </li>
          );
        })}
        </ol>
      </div>

      <div className={styles.composer}>
        {step === 'angle' ? (
          angles === null ? (
            <p className={styles.thinking}>
              <Spinner size="sm" label={null} /> {t('versus.chat.thinking', { name: agentName })}
            </p>
          ) : (
            <>
              <RadioCards
                legend={t('versus.chat.angle.legend')}
                name={`${composerId}-angle`}
                value={angleChoice}
                onValueChange={(v) => {
                  setAngleChoice(v);
                  const found = angles.find((a) => a.id === v);
                  const custom = !angles.some((a) => a.text === value.angle);
                  set({ angle: found ? found.text : custom ? value.angle : '' });
                }}
                options={[...angles.map((a) => ({ value: a.id, label: a.text, tone: side === 'a' ? ('side-a' as const) : ('side-b' as const) })), { value: 'own', label: t('versus.chat.angle.own'), description: t('versus.chat.angle.ownHint') }]}
                error={error ?? undefined}
              />
              {angleChoice === 'own' && (
                <TextField label={t('versus.chat.angle.field')} value={value.angle} maxLength={140} placeholder={q.example} onChange={(e) => set({ angle: e.target.value })} />
              )}
            </>
          )
        ) : (
          <TextArea
            key={step}
            label={step === 'private' ? t('versus.chat.answer.private') : t('versus.chat.answer')}
            hint={step === 'private' ? t('versus.chat.hint.private') : t('versus.chat.hint.public')}
            placeholder={q.example}
            maxLength={q.maxChars}
            rows={step === 'happened' ? 5 : 3}
            value={answerOf(step)}
            onChange={(e) => set({ [FIELD[step]]: e.target.value } as Partial<BriefingDraft>)}
            error={error ?? undefined}
            optional={q.optional}
            ref={inputRef}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) next();
            }}
          />
        )}
        <div className={styles.composerActions}>
          {turn > 0 && (
            <PaperButton variant="ghost" iconStart={<Icon name="arrow-left" />} onClick={() => setTurn(turn - 1)}>
              {t('common.action.back')}
            </PaperButton>
          )}
          {step === 'private' && !value.privateNotes.trim() && (
            <PaperButton variant="maroon" onClick={next}>
              {t('common.action.skip')}
            </PaperButton>
          )}
          <PaperButton iconEnd={<Icon name="arrow-right" />} onClick={next} disabled={step === 'angle' && angles === null}>
            {turn === BRIEFING_STEPS.length - 1 ? t('versus.chat.review') : t('versus.chat.send')}
          </PaperButton>
        </div>
      </div>
    </section>
  );
}
