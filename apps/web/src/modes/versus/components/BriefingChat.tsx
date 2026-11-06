import type { AngleSuggestion, Category, SideId } from '@cringe-court/core';
import { BRIEFING_QUESTIONS, BRIEFING_STEPS, agentReply, composeStory, type BriefingDraft, type BriefingStep } from '@cringe-court/modes-versus';
import { useEffect, useId, useRef, useState } from 'react';
import { Button, Icon, Portrait, RadioCards, Spinner, TextArea, TextField } from '@/ds';
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
  const agentName = `Agent ${side.toUpperCase()}`;
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
      setError(`A little more, please: at least ${q.minChars} characters (${text.length} so far).`);
      return;
    }
    if (step === 'angle' && !text) {
      setError('Pick one of the angles or write your own.');
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
            Private briefing with {agentName}
          </h2>
          <p className={styles.chatSub}>
            <Icon name="lock" aria-hidden /> Only you and your own agent see this conversation. Step {turn + 1} of {BRIEFING_STEPS.length}.
          </p>
        </div>
      </header>

      <ol className={styles.log} ref={logRef} role="log" aria-live="polite" aria-label={`Conversation with ${agentName}`}>
        {BRIEFING_STEPS.slice(0, turn + 1).map((s, i) => {
          const ask = BRIEFING_QUESTIONS[s];
          const answer = answerOf(s).trim();
          const done = i < turn;
          return (
            <li key={s} className={styles.turn}>
              <p className={styles.agentBubble}>
                <span className="cc-visually-hidden">{agentName}: </span>
                {ask.ask}
                {ask.visibility === 'private' && s === 'private' && (
                  <span className={styles.privateTag}>
                    <Icon name="lock" aria-hidden /> Lawyer only
                  </span>
                )}
              </p>
              {done && (
                <>
                  <p className={styles.userBubble}>
                    <span className="cc-visually-hidden">You: </span>
                    {answer || <em>(skipped)</em>}
                  </p>
                  <p className={styles.agentBubble} data-small>
                    <span className="cc-visually-hidden">{agentName}: </span>
                    {agentReply(s, answer, side)}
                  </p>
                </>
              )}
            </li>
          );
        })}
      </ol>

      <div className={styles.composer}>
        {step === 'angle' ? (
          angles === null ? (
            <p className={styles.thinking}>
              <Spinner size="sm" label={null} /> {agentName} is thinking of angles…
            </p>
          ) : (
            <>
              <RadioCards
                legend="Your one angle (D2)"
                name={`${composerId}-angle`}
                value={angleChoice}
                onValueChange={(v) => {
                  setAngleChoice(v);
                  const found = angles.find((a) => a.id === v);
                  const custom = !angles.some((a) => a.text === value.angle);
                  set({ angle: found ? found.text : custom ? value.angle : '' });
                }}
                options={[...angles.map((a) => ({ value: a.id, label: a.text, tone: side === 'a' ? ('side-a' as const) : ('side-b' as const) })), { value: 'own', label: 'Write my own', description: 'One line, 140 characters at most' }]}
                error={error ?? undefined}
              />
              {angleChoice === 'own' && (
                <TextField label="Your angle" value={value.angle} maxLength={140} placeholder={q.example} onChange={(e) => set({ angle: e.target.value })} />
              )}
            </>
          )
        ) : (
          <TextArea
            key={step}
            label={step === 'private' ? 'Your answer (private)' : 'Your answer'}
            hint={step === 'private' ? 'Optional. It shapes how your agent argues, but is never quoted or shown to anyone else.' : 'Names, handles, numbers and links are removed automatically.'}
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
            <Button variant="ghost" iconStart={<Icon name="arrow-left" />} onClick={() => setTurn(turn - 1)}>
              Back
            </Button>
          )}
          {step === 'private' && !value.privateNotes.trim() && (
            <Button variant="secondary" onClick={next}>
              Skip
            </Button>
          )}
          <Button iconEnd={<Icon name="arrow-right" />} onClick={next} disabled={step === 'angle' && angles === null}>
            {turn === BRIEFING_STEPS.length - 1 ? 'Review my brief' : 'Send'}
          </Button>
        </div>
      </div>
    </section>
  );
}
