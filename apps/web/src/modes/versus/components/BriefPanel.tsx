import type { Exhibit, SideId } from '@cringe-court/core';
import { EMPTY_BRIEFING, EXHIBITS_PER_SIDE, otherSide, prepareBriefing, sideLabel, sideStatus, versusMode, visibleBrief, type BriefingDraft, type VersusCase } from '@cringe-court/modes-versus';
import { useState } from 'react';
import { t } from '@/i18n';
import { Alert, Badge, Button, Card, CardBody, CardHeader, CardTitle, Dialog, DialogClose, DialogContent, DialogTrigger, Icon, PaperButton, Portrait, Select, TextArea, TextField } from '@/ds';
import { letter } from '../copy';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { BriefReview } from './BriefReview';
import { BriefingChat } from './BriefingChat';
import { PaperSection } from './PaperSection';

function draftFromFiling(c: VersusCase, side: SideId): BriefingDraft {
  const f = c.state.filing.sides[side];
  if (!f || !f.story.trim()) return EMPTY_BRIEFING;
  const [happened, ...rest] = f.story.split('\n\n');
  return { happened: happened ?? '', why: rest.join('\n\n'), privateNotes: f.privateNotes, angle: f.angle ?? '', nickname: f.nickname ?? '' };
}


/** Evidence stage for a side: brief your agent, add exhibits, read the other side's public story, approve. */
export function BriefPanel({ c, side }: { c: VersusCase; side: SideId }) {
  const { desk, run } = useVersus();
  const saved = draftFromFiling(c, side);
  const [draft, setDraft] = useState<BriefingDraft>(saved);
  const [chatting, setChatting] = useState(!saved.happened);
  const me = sideStatus(c, side);
  const them = otherSide(side);
  const theirs = visibleBrief(c, side, them);
  const themStatus = sideStatus(c, them);
  // Compare what would be written (after redaction) with what is on file.
  const filed = c.state.filing.sides[side];
  const patch = prepareBriefing(draft).patch;
  const dirty = !filed || patch.story !== filed.story || patch.privateNotes !== filed.privateNotes || patch.angle !== filed.angle || patch.nickname !== filed.nickname;

  if (chatting) {
    return (
      <PaperSection as="section" padding="lg" aria-label={t('versus.brief.aria.chat')}>
        <BriefingChat side={side} category={c.state.filing.category} trialId={c.trialId} value={draft} onChange={setDraft} onDone={() => setChatting(false)} />
      </PaperSection>
    );
  }

  const save = () => run(() => desk.saveBrief(c.trialId, side, prepareBriefing(draft).patch), { success: t('versus.brief.save.success') });

  return (
    <div className={styles.stack}>
      <PaperSection as="section" padding="lg" ribbon={t('versus.brief.ribbon', { label: sideLabel(side, c.state.filing.sides[side]) })} ribbonAs="h2" aria-label={t('versus.brief.aria.yours')}>
        <BriefReview
          side={side}
          value={draft}
          onChange={setDraft}
          rules={versusMode.rules}
          actions={(ready) =>
            dirty || !me.briefed ? (
              <PaperButton disabled={!ready} iconStart={<Icon name="check" />} onClick={() => void save()}>
                {me.briefed ? t('versus.brief.save.changes') : t('versus.brief.save.mine')}
              </PaperButton>
            ) : me.approvedBrief ? (
              <Badge tone="success" dot>
                {t('versus.brief.approved')}
              </Badge>
            ) : (
              <PaperButton
                size="lg"
                disabled={!ready || !themStatus.briefed}
                iconStart={<Icon name="gavel" />}
                onClick={() => void run(() => desk.approveBrief(c.trialId, side), { success: t('versus.brief.approve.success') })}
              >
                {t('versus.brief.approve')}
              </PaperButton>
            )
          }
        />
        {!dirty && me.briefed && !me.approvedBrief && !themStatus.briefed && (
          <p className={styles.fine}>{t('versus.brief.approve.wait', { side: letter(them) })}</p>
        )}
      </PaperSection>

      <ExhibitsCard c={c} side={side} />

      <Card as="section" aria-labelledby="their-brief" tone="parchment">
        <CardHeader eyebrow={t('versus.brief.their.eyebrow', { side: letter(them) })}>
          <CardTitle id="their-brief" as="h2">
            {t('versus.brief.their.title', { side: letter(them) })}
          </CardTitle>
        </CardHeader>
        <CardBody>
          {theirs ? (
            <div className={styles.theirStory} data-side={them}>
              <Portrait character={them === 'a' ? 'side-a' : 'side-b'} size="md" ring={them === 'a' ? 'side-a' : 'side-b'} alt="" />
              <div>
                {theirs.story.split('\n\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <p className={styles.fine}>
                  {t('versus.brief.their.note', { label: sideLabel(them, { nickname: theirs.nickname }), approved: themStatus.approvedBrief ? 'yes' : 'no' })}
                </p>
              </div>
            </div>
          ) : (
            <p className={styles.muted}>{t('versus.brief.their.pending', { side: letter(them) })}</p>
          )}
        </CardBody>
      </Card>

      <div className={styles.panelFooter}>
        <WithdrawButton c={c} side={side} />
      </div>
    </div>
  );
}

function ExhibitsCard({ c, side }: { c: VersusCase; side: SideId }) {
  const { desk, run } = useVersus();
  const exhibits: readonly Exhibit[] = 'exhibits' in c.state ? c.state.exhibits : [];
  const mine = exhibits.filter((x) => x.submittedBy === side);
  const theirs = exhibits.filter((x) => x.submittedBy !== side);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<Exhibit['kind']>('quote');
  const [touched, setTouched] = useState(false);
  const full = mine.length >= EXHIBITS_PER_SIDE;

  return (
    <Card as="section" aria-labelledby="exhibits-title">
      <CardHeader eyebrow={t('versus.exhibits.eyebrow', { max: EXHIBITS_PER_SIDE })}>
        <CardTitle id="exhibits-title" as="h2">
          {t('versus.exhibits.title')}
        </CardTitle>
      </CardHeader>
      <CardBody className={styles.stack}>
        <p className={styles.muted}>{t('versus.exhibits.intro')}</p>
        {exhibits.length > 0 && (
          <ul className={styles.exhibitList} role="list">
            {[...mine, ...theirs].map((x) => (
              <li key={x.id} data-side={x.submittedBy}>
                <div>
                  <p className={styles.exhibitTitle}>
                    {x.title} <Badge tone={x.submittedBy === 'a' ? 'side-a' : 'side-b'}>{t('versus.exhibits.sideBadge', { side: String(x.submittedBy).toUpperCase() })}</Badge>
                  </p>
                  <p className={styles.exhibitBody}>{x.body}</p>
                </div>
                {x.submittedBy === side && (
                  <PaperButton size="sm" variant="ghost" onClick={() => void run(() => desk.removeExhibit(c.trialId, side, x.id))} aria-label={t('versus.exhibits.removeAria', { title: x.title })}>
                    {t('versus.exhibits.remove')}
                  </PaperButton>
                )}
              </li>
            ))}
          </ul>
        )}
        {full ? (
          <Alert tone="info" title={t('versus.exhibits.full.title', { count: EXHIBITS_PER_SIDE })}>
            {t('versus.exhibits.full.body')}
          </Alert>
        ) : (
          <form
            className={styles.exhibitForm}
            onSubmit={async (e) => {
              e.preventDefault();
              setTouched(true);
              if (!title.trim() || !body.trim()) return;
              const ok = await run(() => desk.addExhibit(c.trialId, side, { title, body, kind }), { success: t('versus.exhibits.added') });
              if (ok) {
                setTitle('');
                setBody('');
                setTouched(false);
              }
            }}
            noValidate
          >
            <TextField label={t('versus.exhibits.field.title')} maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('versus.exhibits.field.titlePlaceholder')} error={touched && !title.trim() ? t('versus.exhibits.field.titleError') : undefined} />
            <Select
              label={t('versus.exhibits.field.kind')}
              value={kind}
              onChange={(e) => setKind(e.target.value as Exhibit['kind'])}
              options={[
                { value: 'quote', label: t('versus.exhibits.kind.quote') },
                { value: 'text', label: t('versus.exhibits.kind.text') },
                { value: 'screenshot', label: t('versus.exhibits.kind.screenshot') },
                { value: 'link', label: t('versus.exhibits.kind.link') },
              ]}
            />
            <TextArea label={t('versus.exhibits.field.body')} rows={2} maxLength={280} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('versus.exhibits.field.bodyPlaceholder')} error={touched && !body.trim() ? t('versus.exhibits.field.bodyError') : undefined} />
            <div className={styles.formActions}>
              <PaperButton type="submit" variant="maroon" iconStart={<Icon name="plus" />}>
                {t('versus.exhibits.add')}
              </PaperButton>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

export function WithdrawButton({ c, side, paid = false }: { c: VersusCase; side: SideId; paid?: boolean }) {
  const { desk, run } = useVersus();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <PaperButton variant="ghost" size="sm">
          {t('versus.withdraw.trigger')}
        </PaperButton>
      </DialogTrigger>
      <DialogContent
        title={t('versus.withdraw.title')}
        description={
          paid
            ? t('versus.withdraw.description.paid')
            : t('versus.withdraw.description.unpaid')
        }
        size="sm"
        tone="danger"
        footer={
          <>
            <DialogClose asChild>
              <PaperButton variant="ghost">{t('versus.withdraw.stay')}</PaperButton>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="danger" onClick={() => void run(() => desk.withdraw(c.trialId, side), { success: t('versus.withdraw.success') })}>
                {t('versus.withdraw.confirm')}
              </Button>
            </DialogClose>
          </>
        }
      />
    </Dialog>
  );
}
