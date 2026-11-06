import { CATEGORIES, type Category } from '@cringe-court/core';
import { categoryLabel, formatAmount } from '@/i18n/domain';
import { EMPTY_BRIEFING, OPEN_INVITE_LIMIT, prepareBriefing, sideCharges, versusMode, type BriefingDraft } from '@cringe-court/modes-versus';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { t, tRich, type MessageKey } from '@/i18n';
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

const CATEGORY_HINTS: Readonly<Record<Category, MessageKey>> = {
  'dating-crimes': 'versus.new.hint.dating',
  'npc-behavior': 'versus.new.hint.npc',
  'internet-crimes': 'versus.new.hint.internet',
  'crypto-crimes': 'versus.new.hint.crypto',
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
  useDocumentTitle(t('versus.new.docTitle'));
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
  const titleError = touched && !draft.title.trim() ? t('versus.new.error.title') : undefined;
  const categoryError = touched && !draft.category ? t('versus.new.error.category') : undefined;
  const set = (patch: Partial<NewCaseDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const file = async () => {
    setFiling(true);
    const created = { trialId: '' };
    const ok = await run(
      async () => {
        const prepared = prepareBriefing(draft.brief);
        created.trialId = (await desk.fileCase({ title: draft.title, category: draft.category as Category, patch: prepared.patch, terms })).trialId;
      },
      { success: t('versus.new.filed') },
    );
    setFiling(false);
    if (ok && created.trialId) {
      window.sessionStorage.removeItem(DRAFT_KEY);
      navigate(versusPaths.case(created.trialId));
    }
  };

  return (
    <>
      <PageHead eyebrow={t('versus.new.eyebrow')} title={t('versus.new.title')} lede={t('versus.new.lede')} />
      <div className={styles.page}>
        <PhaseStepper
          steps={[t('versus.new.step.case'), t('versus.new.step.brief'), t('versus.new.step.review')]}
          current={draft.step}
          label={t('versus.new.steps')}
          className={styles.newStepper}
        />

        {atLimit && (
          <Alert tone="warning" title={t('versus.new.limit.title', { count: OPEN_INVITE_LIMIT })}>
            {t('versus.new.limit.body', { count: OPEN_INVITE_LIMIT })}
          </Alert>
        )}

        {draft.step === 0 && (
          <PaperSection as="section" padding="lg" ribbon={t('versus.new.step.case')} ribbonAs="h2" aria-label={t('versus.new.step.case')}>
            <form
              className={styles.form}
              onSubmit={(e) => {
                e.preventDefault();
                setTouched(true);
                if (draft.title.trim() && draft.category) set({ step: 1 });
              }}
              noValidate
            >
              <TextField
                label={t('versus.new.field.title')}
                hint={t('versus.new.field.titleHint')}
                placeholder={t('versus.new.field.titlePlaceholder')}
                maxLength={80}
                value={draft.title}
                onChange={(e) => set({ title: e.target.value })}
                error={titleError}
                required
              />
              <RadioCards
                legend={t('versus.new.field.category')}
                name="category"
                value={draft.category}
                onValueChange={(v) => set({ category: v as Category })}
                options={(Object.keys(CATEGORIES) as Category[]).map((c) => ({ value: c, label: categoryLabel(c), description: t(CATEGORY_HINTS[c]) }))}
                error={categoryError}
              />
              <div className={styles.priceStrip}>
                <Icon name="scales" aria-hidden />
                <p>{tRich('versus.new.price', { b: (chunk) => <strong>{chunk}</strong> }, { amount: formatAmount(share.total) })}</p>
              </div>
              <div className={styles.formActions}>
                <PaperButton type="submit" size="lg" iconEnd={<Icon name="arrow-right" />} disabled={atLimit}>
                  {t('versus.new.step.brief')}
                </PaperButton>
              </div>
            </form>
          </PaperSection>
        )}

        {draft.step === 1 && (
          <PaperSection as="section" padding="lg" aria-label={t('versus.new.briefing')}>
            <BriefingChat
              side="a"
              category={(draft.category || 'npc-behavior') as Category}
              trialId={`draft-${persona.id}`}
              value={draft.brief}
              onChange={(brief) => set({ brief })}
              onDone={() => set({ step: 2 })}
            />
            <div className={styles.backRow}>
              <PaperButton variant="ghost" size="sm" iconStart={<Icon name="arrow-left" />} onClick={() => set({ step: 0 })}>
                {t('versus.new.changeDetails')}
              </PaperButton>
            </div>
          </PaperSection>
        )}

        {draft.step === 2 && (
          <PaperSection as="section" padding="lg" ribbon={t('versus.new.step.review')} ribbonAs="h2" aria-label={t('versus.new.reviewAria')}>
            <p className={styles.caseLine}>
              <span className={styles.caseLineTitle}>“{draft.title}”</span> · {draft.category ? categoryLabel(draft.category) : ''}
            </p>
            <BriefReview
              side="a"
              value={draft.brief}
              onChange={(brief) => set({ brief })}
              rules={versusMode.rules}
              actions={(ready) => (
                <>
                  <PaperButton variant="maroon" onClick={() => set({ step: 1 })}>
                    {t('versus.new.backToBriefing')}
                  </PaperButton>
                  <WorldIdDialog
                    title={t('versus.world.title')}
                    purpose={t('versus.new.world.purpose')}
                    confirmLabel={t('versus.new.world.confirm')}
                    onVerified={file}
                    trigger={
                      <PaperButton size="lg" iconStart={<Icon name="gavel" />} disabled={!ready || atLimit} loading={filing}>
                        {t('versus.new.file')}
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
