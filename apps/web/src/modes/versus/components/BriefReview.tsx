import type { SideId, TrialRules } from '@cringe-court/core';
import { BRIEFING_QUESTIONS, ROUTE_OUT_COPY, briefingIssues, describeHits, prepareBriefing, type BriefingDraft } from '@cringe-court/modes-versus';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Badge, Icon, PaperButton, TextArea, TextField } from '@/ds';
import styles from './Briefing.module.css';

export interface BriefReviewProps {
  side: SideId;
  value: BriefingDraft;
  onChange: (draft: BriefingDraft) => void;
  rules: Pick<TrialRules, 'storyMaxChars' | 'angleMaxChars' | 'nicknameMaxChars'>;
  /** Primary actions (file, save, approve). Receives whether the brief is ready. */
  actions: (ready: boolean) => ReactNode;
  /** Show the briefing as already saved (read view first, edit on demand). */
  startInEdit?: boolean;
}

/**
 * What goes public (after the redaction pass) and what only your own agent sees,
 * side by side, so a side approves exactly the text the jury will read.
 */
export function BriefReview({ side, value, onChange, rules, actions, startInEdit = false }: BriefReviewProps) {
  const [editing, setEditing] = useState(startInEdit);
  const prepared = useMemo(() => prepareBriefing(value), [value]);
  const issues = useMemo(() => briefingIssues(value, rules), [value, rules]);
  const issue = (field: keyof BriefingDraft) => issues.find((i) => i.field === field)?.message;
  const ready = issues.length === 0 && prepared.screen.ok;
  const agent = `Agent ${side.toUpperCase()}`;
  const publicHits = [...prepared.redactions.story, ...prepared.redactions.nickname];
  const privateHits = [...prepared.redactions.privateNotes, ...prepared.redactions.angle];

  return (
    <div className={styles.review} data-side={side}>
      {!prepared.screen.ok && (
        <Alert tone="danger" title={ROUTE_OUT_COPY[prepared.screen.topics[0]!].title} live="polite">
          {ROUTE_OUT_COPY[prepared.screen.topics[0]!].body} Edit your brief if this was a misunderstanding.
        </Alert>
      )}

      <div className={styles.reviewGrid}>
        <section className={styles.reviewCard} data-visibility="public" aria-labelledby={`review-public-${side}`}>
          <header className={styles.reviewHead}>
            <h3 id={`review-public-${side}`}>What the jury will read</h3>
            <Badge tone="info">
              <Icon name="eye" aria-hidden /> Public once approved
            </Badge>
          </header>
          {editing ? (
            <div className={styles.reviewFields}>
              <TextArea label="What happened" rows={5} maxLength={BRIEFING_QUESTIONS.happened.maxChars} value={value.happened} onChange={(e) => onChange({ ...value, happened: e.target.value })} error={issue('happened')} />
              <TextArea label="Why you are right" rows={3} maxLength={BRIEFING_QUESTIONS.why.maxChars} value={value.why} onChange={(e) => onChange({ ...value, why: e.target.value })} error={issue('why')} />
            </div>
          ) : (
            <div className={styles.storyPreview}>
              {prepared.patch.story ? prepared.patch.story.split('\n\n').map((p, i) => <p key={i}>{p}</p>) : <p className={styles.muted}>Nothing yet.</p>}
            </div>
          )}
          <TextField
            label="Nickname on the verdict"
            optional
            hint={`Shown as SIDE ${side.toUpperCase()} “${prepared.patch.nickname ?? 'your nickname'}”. No real names (D5).`}
            maxLength={rules.nicknameMaxChars}
            value={value.nickname}
            onChange={(e) => onChange({ ...value, nickname: e.target.value })}
            error={issue('nickname')}
          />
          <p className={styles.redactionNote} data-hit={publicHits.length > 0 || undefined}>
            <Icon name={publicHits.length ? 'sparkle' : 'check'} aria-hidden />
            Redaction pass: {describeHits(publicHits)}
          </p>
        </section>

        <section className={styles.reviewCard} data-visibility="private" aria-labelledby={`review-private-${side}`}>
          <header className={styles.reviewHead}>
            <h3 id={`review-private-${side}`}>Only {agent} sees</h3>
            <Badge tone="accent">
              <Icon name="lock" aria-hidden /> Private
            </Badge>
          </header>
          {editing ? (
            <div className={styles.reviewFields}>
              <TextArea label="Lawyer-only notes" optional rows={3} maxLength={BRIEFING_QUESTIONS.private.maxChars} value={value.privateNotes} onChange={(e) => onChange({ ...value, privateNotes: e.target.value })} error={issue('privateNotes')} />
              <TextField label="Your one angle" maxLength={rules.angleMaxChars} value={value.angle} onChange={(e) => onChange({ ...value, angle: e.target.value })} error={issue('angle')} />
            </div>
          ) : (
            <dl className={styles.privateList}>
              <div>
                <dt>Notes</dt>
                <dd>{prepared.patch.privateNotes || <span className={styles.muted}>None. Arguing clean.</span>}</dd>
              </div>
              <div>
                <dt>Angle</dt>
                <dd>{prepared.patch.angle ? `“${prepared.patch.angle}”` : <span className={styles.muted}>Not set</span>}</dd>
              </div>
            </dl>
          )}
          <p className={styles.redactionNote} data-hit={privateHits.length > 0 || undefined}>
            <Icon name={privateHits.length ? 'sparkle' : 'check'} aria-hidden />
            {privateHits.length ? describeHits(privateHits) : 'Never shown to Side ' + (side === 'a' ? 'B' : 'A') + ', the jury or the public.'}
          </p>
        </section>
      </div>

      {!editing && issues.length > 0 && (
        <Alert tone="warning" title="A few things to fix first">
          <ul className={styles.issueList}>
            {issues.map((i) => (
              <li key={i.field + i.message}>{i.message}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className={styles.reviewActions}>
        <PaperButton variant="ghost" iconStart={<Icon name={editing ? 'check' : 'document'} />} onClick={() => setEditing(!editing)}>
          {editing ? 'Preview' : 'Edit brief'}
        </PaperButton>
        {actions(ready)}
      </div>
    </div>
  );
}
