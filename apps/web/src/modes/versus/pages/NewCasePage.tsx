import { CATEGORIES, formatUsdc, type Category } from '@cringe-court/core';
import { EMPTY_BRIEFING, OPEN_INVITE_LIMIT, prepareBriefing, sideCharges, versusMode, type BriefingDraft } from '@cringe-court/modes-versus';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Alert, Icon, PaperButton, PhaseStepper, RadioCards, TextField } from '@/ds';
import { BriefReview } from '../components/BriefReview';
import { BriefingChat } from '../components/BriefingChat';
import { PageHead } from '../components/PageHead';
import { WorldIdDialog } from '../components/WorldIdDialog';
import { versusPaths } from '../mode';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { PaperSection } from '../components/PaperSection';

const DRAFT_KEY = 'cc:versus:new-case';

interface NewCaseDraft {
  step: 0 | 1 | 2;
  title: string;
  category: Category | '';
  brief: BriefingDraft;
}

const CATEGORY_HINTS: Readonly<Record<Category, string>> = {
  'dating-crimes': 'Left on read, ghosting, the playlist incident',
  'npc-behavior': 'Reclining seats, reply-all, the last dumpling',
  'internet-crimes': 'Spoilers, group-chat crimes, the pineapple question',
  'crypto-crimes': 'Who told who to buy the top',
};

function loadDraft(): NewCaseDraft {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (raw) return { ...{ step: 0, title: '', category: '', brief: EMPTY_BRIEFING }, ...(JSON.parse(raw) as NewCaseDraft) };
  } catch {
    // A damaged draft just starts over.
  }
  return { step: 0, title: '', category: '', brief: EMPTY_BRIEFING };
}

/** Side A opens a case: details → private briefing with Agent A → review → World ID → invite. */
export function NewCasePage() {
  useDocumentTitle('New Versus case');
  const { desk, run, snapshot, persona } = useVersus();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<NewCaseDraft>(loadDraft);
  const [touched, setTouched] = useState(false);
  const [filing, setFiling] = useState(false);
  const terms = useMemo(() => desk.terms(), [desk]);
  const share = sideCharges(terms)[0];

  useEffect(() => {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  const openInvites = snapshot?.cases.filter((c) => c.parties.a?.account === persona.account.toLowerCase() && c.state.stage === 'filing').length ?? 0;
  const atLimit = openInvites >= OPEN_INVITE_LIMIT;
  const titleError = touched && !draft.title.trim() ? 'Give the case a title' : undefined;
  const categoryError = touched && !draft.category ? 'Pick a category' : undefined;
  const set = (patch: Partial<NewCaseDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const file = async () => {
    setFiling(true);
    const created = { trialId: '' };
    const ok = await run(
      async () => {
        const prepared = prepareBriefing(draft.brief);
        created.trialId = (await desk.fileCase({ title: draft.title, category: draft.category as Category, patch: prepared.patch, terms })).trialId;
      },
      { success: 'Case filed. Send the invite to Side B.' },
    );
    setFiling(false);
    if (ok && created.trialId) {
      window.sessionStorage.removeItem(DRAFT_KEY);
      navigate(versusPaths.case(created.trialId));
    }
  };

  return (
    <>
      <PageHead eyebrow="Versus Court · new case" title="Settle it in court" lede="You brief your own AI agent in private. The other side gets theirs. Three random verified humans decide who argued it better." />
      <div className={styles.page}>
        <PhaseStepper steps={['The case', 'Brief Agent A', 'Review & invite']} current={draft.step} label="New case steps" className={styles.newStepper} />

        {atLimit && (
          <Alert tone="warning" title={`You have ${OPEN_INVITE_LIMIT} invites waiting`}>
            To keep invites from being spammed, each person can have {OPEN_INVITE_LIMIT} open invites at a time (D6). Wait for an answer, or withdraw one from My cases.
          </Alert>
        )}

        {draft.step === 0 && (
          <PaperSection as="section" padding="lg" ribbon="The case" ribbonAs="h2" aria-label="The case">
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                setTouched(true);
                if (draft.title.trim() && draft.category) set({ step: 1 });
              }}
              noValidate
            >
              <TextField label="Case title" hint="What the jury sees first. Keep it petty, keep it anonymous." placeholder="The Last Dumpling" maxLength={80} value={draft.title} onChange={(e) => set({ title: e.target.value })} error={titleError} required />
              <RadioCards
                legend="Category"
                name="category"
                value={draft.category}
                onValueChange={(v) => set({ category: v as Category })}
                options={(Object.keys(CATEGORIES) as Category[]).map((c) => ({ value: c, label: CATEGORIES[c], description: CATEGORY_HINTS[c] }))}
                error={categoryError}
              />
              <div className={styles.priceStrip}>
                <Icon name="scales" aria-hidden />
                <p>
                  Each side pays <strong>{formatUsdc(share.total)}</strong> test USDC, and only once you have both approved the trial. If Side B never answers, nobody is
                  charged.
                </p>
              </div>
              <div className={styles.formActions}>
                <PaperButton type="submit" size="lg" iconEnd={<Icon name="arrow-right" />} disabled={atLimit}>
                  Brief Agent A
                </PaperButton>
              </div>
            </form>
          </PaperSection>
        )}

        {draft.step === 1 && (
          <PaperSection as="section" padding="lg" aria-label="Briefing">
            <BriefingChat side="a" category={(draft.category || 'npc-behavior') as Category} trialId={`draft-${persona.id}`} value={draft.brief} onChange={(brief) => set({ brief })} onDone={() => set({ step: 2 })} />
            <div className={styles.backRow}>
              <PaperButton variant="ghost" size="sm" iconStart={<Icon name="arrow-left" />} onClick={() => set({ step: 0 })}>
                Change the case details
              </PaperButton>
            </div>
          </PaperSection>
        )}

        {draft.step === 2 && (
          <PaperSection as="section" padding="lg" ribbon="Review & invite" ribbonAs="h2" aria-label="Review and invite">
            <p className={styles.caseLine}>
              <span className={styles.caseLineTitle}>“{draft.title}”</span> · {draft.category ? CATEGORIES[draft.category] : ''}
            </p>
            <BriefReview
              side="a"
              value={draft.brief}
              onChange={(brief) => set({ brief })}
              rules={versusMode.rules}
              actions={(ready) => (
                <>
                  <PaperButton variant="maroon" onClick={() => set({ step: 1 })}>
                    Back to the briefing
                  </PaperButton>
                  <WorldIdDialog
                    title="Prove you are a unique human"
                    purpose="One human, one side. The same proof keeps you off this case’s jury, even with another wallet."
                    confirmLabel="Verify & file"
                    onVerified={file}
                    trigger={
                      <PaperButton size="lg" iconStart={<Icon name="gavel" />} disabled={!ready || atLimit} loading={filing}>
                        File & get invite
                      </PaperButton>
                    }
                  />
                </>
              )}
            />
          </PaperSection>
        )}
      </div>
    </>
  );
}
