import type { Exhibit, SideId } from '@cringe-court/core';
import { EMPTY_BRIEFING, EXHIBITS_PER_SIDE, otherSide, prepareBriefing, sideLabel, sideStatus, versusMode, visibleBrief, type BriefingDraft, type VersusCase } from '@cringe-court/modes-versus';
import { useState } from 'react';
import { Alert, Badge, Button, Card, CardBody, CardHeader, CardTitle, Dialog, DialogClose, DialogContent, DialogTrigger, Icon, OrnateFrame, Portrait, Select, TextArea, TextField } from '@/ds';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { BriefReview } from './BriefReview';
import { BriefingChat } from './BriefingChat';

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
      <OrnateFrame as="section" padding="lg" aria-label="Brief your agent">
        <BriefingChat side={side} category={c.state.filing.category} trialId={c.trialId} value={draft} onChange={setDraft} onDone={() => setChatting(false)} />
      </OrnateFrame>
    );
  }

  const save = () => run(() => desk.saveBrief(c.trialId, side, prepareBriefing(draft).patch), { success: 'Brief saved. Approvals reset so both sides see the new version.' });

  return (
    <div className={styles.stack}>
      <OrnateFrame as="section" padding="lg" ribbon={`Your brief · ${sideLabel(side, c.state.filing.sides[side])}`} aria-label="Your brief">
        <BriefReview
          side={side}
          value={draft}
          onChange={setDraft}
          rules={versusMode.rules}
          actions={(ready) =>
            dirty || !me.briefed ? (
              <Button disabled={!ready} iconStart={<Icon name="check" />} onClick={() => void save()}>
                {me.briefed ? 'Save changes' : 'Save my brief'}
              </Button>
            ) : me.approvedBrief ? (
              <Badge tone="success" dot>
                You approved this brief
              </Badge>
            ) : (
              <Button
                size="lg"
                disabled={!ready || !themStatus.briefed}
                iconStart={<Icon name="gavel" />}
                onClick={() => void run(() => desk.approveBrief(c.trialId, side), { success: 'Approved. Your agent will argue exactly this.' })}
              >
                Approve my brief
              </Button>
            )
          }
        />
        {!dirty && me.briefed && !me.approvedBrief && !themStatus.briefed && (
          <p className={styles.fine}>You can approve once Side {them.toUpperCase()} has briefed their agent, so you read their public story first.</p>
        )}
      </OrnateFrame>

      <ExhibitsCard c={c} side={side} />

      <Card as="section" aria-labelledby="their-brief" tone="parchment">
        <CardHeader eyebrow={`Side ${them.toUpperCase()}’s public story`}>
          <CardTitle id="their-brief" as="h2">
            What Agent {them.toUpperCase()} will argue
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
                  {sideLabel(them, { nickname: theirs.nickname })} · {themStatus.approvedBrief ? 'approved by them' : 'not approved yet'}. Their private notes stay with their agent.
                </p>
              </div>
            </div>
          ) : (
            <p className={styles.muted}>Side {them.toUpperCase()} is still briefing their agent. Their public story appears here as soon as they save it.</p>
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
      <CardHeader eyebrow={`Optional · up to ${EXHIBITS_PER_SIDE} each`}>
        <CardTitle id="exhibits-title" as="h2">
          Exhibits
        </CardTitle>
      </CardHeader>
      <CardBody className={styles.stack}>
        <p className={styles.muted}>Receipts your agent can present: a quote, a text, a screenshot described in words. Exhibits are public and go through the redaction pass.</p>
        {exhibits.length > 0 && (
          <ul className={styles.exhibitList} role="list">
            {[...mine, ...theirs].map((x) => (
              <li key={x.id} data-side={x.submittedBy}>
                <div>
                  <p className={styles.exhibitTitle}>
                    {x.title} <Badge tone={x.submittedBy === 'a' ? 'side-a' : 'side-b'}>Side {String(x.submittedBy).toUpperCase()}</Badge>
                  </p>
                  <p className={styles.exhibitBody}>{x.body}</p>
                </div>
                {x.submittedBy === side && (
                  <Button size="sm" variant="ghost" onClick={() => void run(() => desk.removeExhibit(c.trialId, side, x.id))} aria-label={`Remove exhibit ${x.title}`}>
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {full ? (
          <Alert tone="info" title={`You have ${EXHIBITS_PER_SIDE} exhibits`}>
            Remove one to add another.
          </Alert>
        ) : (
          <form
            className={styles.exhibitForm}
            onSubmit={async (e) => {
              e.preventDefault();
              setTouched(true);
              if (!title.trim() || !body.trim()) return;
              const ok = await run(() => desk.addExhibit(c.trialId, side, { title, body, kind }), { success: 'Exhibit added' });
              if (ok) {
                setTitle('');
                setBody('');
                setTouched(false);
              }
            }}
            noValidate
          >
            <TextField label="Exhibit title" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The group chat, 9:41 pm" error={touched && !title.trim() ? 'Give it a title' : undefined} />
            <Select
              label="Kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as Exhibit['kind'])}
              options={[
                { value: 'quote', label: 'A quote' },
                { value: 'text', label: 'A message' },
                { value: 'screenshot', label: 'A screenshot (described)' },
                { value: 'link', label: 'A link (removed by redaction; describe it)' },
              ]}
            />
            <TextArea label="What it shows" rows={2} maxLength={280} value={body} onChange={(e) => setBody(e.target.value)} placeholder="me: splitting it 50/50 ok?  them: deal" error={touched && !body.trim() ? 'Describe the exhibit' : undefined} />
            <div className={styles.formActions}>
              <Button type="submit" variant="secondary" iconStart={<Icon name="plus" />}>
                Add exhibit
              </Button>
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
        <Button variant="ghost" size="sm">
          Withdraw consent
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Withdraw from this case?"
        description={
          paid
            ? 'The case closes. Your payment is refunded in full when the funding window closes; you claim it from this page.'
            : 'The case closes privately for both sides. Nothing has been charged.'
        }
        size="sm"
        tone="danger"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Stay in</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="danger" onClick={() => void run(() => desk.withdraw(c.trialId, side), { success: 'You withdrew. The case is closed.' })}>
                Withdraw
              </Button>
            </DialogClose>
          </>
        }
      />
    </Dialog>
  );
}
