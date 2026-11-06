import { cancelLabel, categoryLabel, formatAmount } from '@/i18n/domain';
import { parseInviteCode, sideCharges, viewerOf } from '@cringe-court/modes-versus';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { t, tRich, type MessageKey } from '@/i18n';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import {
  Alert,
  Button,
  Countdown,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  EmptyState,
  Icon,
  LoadingState,
  PaperButton,
  PaperButtonLink,
  Portrait,
  Stamp,
  TextField,
} from '@/ds';
import { PageHead } from '../components/PageHead';
import { WorldIdDialog } from '../components/WorldIdDialog';
import { versusPaths } from '../mode';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { PaperSection } from '../components/PaperSection';

const STRONG = (chunk: ReactNode) => <strong>{chunk}</strong>;

function CodeForm({ initial = '', error }: { initial?: string; error?: string }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);
  const [problem, setProblem] = useState<string | undefined>(error);
  return (
    <form
      className={styles.codeForm}
      onSubmit={(e) => {
        e.preventDefault();
        const r = parseInviteCode(value);
        if (!r.ok) setProblem(r.message);
        else navigate(versusPaths.joinCode(r.code));
      }}
      noValidate
    >
      <TextField
        label={t('versus.invite.codeLabel')}
        hint={t('versus.join.codeHint')}
        value={value}
        onChange={(e) => {
          setValue(e.target.value.toUpperCase());
          setProblem(undefined);
        }}
        error={problem}
        autoComplete="off"
        spellCheck={false}
        className={styles.codeField}
      />
      <PaperButton type="submit" size="lg" iconEnd={<Icon name="arrow-right" />}>
        {t('versus.join.open')}
      </PaperButton>
    </form>
  );
}

/** Side B's door: enter a code (or follow a link), read the invite, accept with World ID or decline. */
export function JoinPage() {
  const { code: raw } = useParams();
  useDocumentTitle(t('versus.join.docTitle'));
  const { snapshot, persona, desk, run, now } = useVersus();
  const navigate = useNavigate();

  if (!raw) {
    return (
      <>
        <PageHead eyebrow={t('versus.join.eyebrow')} title={t('versus.join.title.enter')} lede={t('versus.join.lede')} />
        <div className={styles.page}>
          <PaperSection as="div" padding="lg" className={styles.narrow}>
            <CodeForm />
          </PaperSection>
        </div>
      </>
    );
  }

  const parsed = parseInviteCode(raw);
  const headFor = (title: MessageKey) => <PageHead eyebrow={t('versus.join.eyebrow')} title={t(title)} />;
  const head = headFor('versus.join.title.summoned');
  if (!parsed.ok) {
    return (
      <>
        {headFor('versus.join.title.enter')}
        <div className={styles.page}>
          <PaperSection as="div" padding="lg" className={styles.narrow}>
            <CodeForm initial={raw} error={parsed.message} />
          </PaperSection>
        </div>
      </>
    );
  }
  if (!snapshot) {
    return (
      <>
        {head}
        <div className={styles.page}>
          <LoadingState title={t('versus.join.loading')} />
        </div>
      </>
    );
  }

  const c = snapshot.cases.find((x) => x.code === parsed.code);
  if (!c) {
    return (
      <>
        {headFor('versus.join.title.missing')}
        <div className={styles.page}>
          <EmptyState
            title={t('versus.join.missing.title')}
            character="clerk"
            expression="shocked"
            actions={
              <PaperButtonLink to={versusPaths.join} variant="maroon">
                {t('versus.join.missing.action')}
              </PaperButtonLink>
            }
          >
            {t('versus.join.missing.body')}
          </EmptyState>
        </div>
      </>
    );
  }

  const viewer = viewerOf(c, persona.account);
  const s = c.state;
  const title = s.filing.title;

  if (viewer === 'a' || viewer === 'b') {
    return (
      <>
        {headFor(viewer === 'a' ? 'versus.join.title.own' : 'versus.join.title.joined')}
        <div className={styles.page}>
          <EmptyState
            title={viewer === 'a' ? t('versus.join.own.title') : t('versus.join.joined.title')}
            character={viewer === 'a' ? 'side-a' : 'side-b'}
            actions={<PaperButtonLink to={versusPaths.case(c.trialId)}>{t('versus.join.openCase')}</PaperButtonLink>}
          >
            {viewer === 'a' ? t('versus.join.own.body') : t('versus.join.joined.body', { title })}
          </EmptyState>
        </div>
      </>
    );
  }

  if (!(s.stage === 'filing' && s.step === 'awaiting-consent')) {
    const closed = s.stage === 'closed';
    return (
      <>
        {headFor(closed ? 'versus.join.title.closed' : 'versus.join.title.taken')}
        <div className={styles.page}>
          <EmptyState
            title={closed ? t('versus.join.closed.title') : t('versus.join.taken.title')}
            character="judge"
            expression="neutral"
            actions={
              <PaperButtonLink to={versusPaths.cases} variant="maroon">
                {t('versus.persona.myCases')}
              </PaperButtonLink>
            }
          >
            {closed ? t('versus.join.closed.body', { reason: cancelLabel(s.reason) }) : t('versus.join.taken.body')}
          </EmptyState>
        </div>
      </>
    );
  }

  const share = sideCharges(s.terms)[1];
  const consentEnds = s.consentEndsAt;
  return (
    <>
      {head}
      <div className={styles.page}>
        <PaperSection as="article" padding="lg" ribbon={t('versus.join.summons')} className={styles.summonsFrame} bodyClassName={styles.summons} aria-labelledby="summons-title">
          <div className={styles.summonsTop}>
            <Portrait character="side-a" expression="smug" size="lg" ring="side-a" alt={t('common.role.sideA')} />
            <div>
              <p className={styles.eyebrow}>{categoryLabel(s.filing.category)}</p>
              <h2 id="summons-title" className={styles.summonsTitle}>
                “{title}”
              </h2>
              <p className={styles.muted}>{t('versus.join.wants')}</p>
            </div>
            <Stamp tone="filed" size="sm" className={styles.summonsStamp}>
              {t('versus.join.charges')}
            </Stamp>
          </div>

          {consentEnds !== null && (
            <Countdown label={t('versus.join.answerBy')} startsAt={(consentEnds - (s.terms.deadlines.preTrial ?? 0)) * 1000} endsAt={consentEnds * 1000} now={now * 1000} />
          )}

          <ul className={styles.ruleList} role="list">
            <li>
              <Icon name="lock" aria-hidden />
              <span>{tRich('versus.join.rule.agent', { b: STRONG })}</span>
            </li>
            <li>
              <Icon name="eye" aria-hidden />
              <span>{tRich('versus.join.rule.story', { b: STRONG })}</span>
            </li>
            <li>
              <Icon name="scales" aria-hidden />
              <span>{tRich('versus.join.rule.pay', { b: STRONG }, { amount: formatAmount(share.total) })}</span>
            </li>
            <li>
              <Icon name="star" aria-hidden />
              <span>{tRich('versus.join.rule.bragging', { b: STRONG })}</span>
            </li>
          </ul>

          <Alert tone="info" title={t('versus.join.petty.title')}>
            {t('versus.join.petty.body', { app: t('common.app.name') })}
          </Alert>

          <div className={styles.summonsActions}>
            <Dialog>
              <DialogTrigger asChild>
                <PaperButton variant="ghost">{t('versus.join.decline')}</PaperButton>
              </DialogTrigger>
              <DialogContent
                title={t('versus.join.decline.title')}
                description={t('versus.join.decline.body')}
                size="sm"
                footer={
                  <>
                    <DialogClose asChild>
                      <PaperButton variant="ghost">{t('versus.join.keepOpen')}</PaperButton>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button variant="danger" onClick={() => void run(() => desk.declineInvite(c.trialId), { success: t('versus.join.declined') })}>
                        {t('versus.join.decline')}
                      </Button>
                    </DialogClose>
                  </>
                }
              />
            </Dialog>
            <WorldIdDialog
              title={t('versus.world.title')}
              purpose={t('versus.join.world.purpose')}
              confirmLabel={t('versus.join.world.confirm')}
              onVerified={async () => {
                const ok = await run(() => desk.acceptInvite(c.trialId), { success: t('versus.join.accepted') });
                if (ok) navigate(versusPaths.case(c.trialId));
              }}
              trigger={
                <PaperButton size="lg" iconStart={<Icon name="gavel" />}>
                  {t('versus.join.accept')}
                </PaperButton>
              }
            />
          </div>
          <p className={styles.fine}>{tRich('versus.join.notYou', { how: (chunk) => <Link to={versusPaths.landing}>{chunk}</Link> })}</p>
        </PaperSection>
      </div>
    </>
  );
}
