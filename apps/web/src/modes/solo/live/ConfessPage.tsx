import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Icon, PaperButton } from '@/ds';
import { t, type MessageKey } from '@/i18n';
import { soloPaths } from '../lib/paths';
import { readDraft, screenConfession, titleFrom, writeDraft } from './liveCase';
import styles from './live.module.css';

const MAX = 600;
const MIN = 15;
const IDEAS: readonly MessageKey[] = ['solo.live.confess.idea.0', 'solo.live.confess.idea.1', 'solo.live.confess.idea.2', 'solo.live.confess.idea.3'];

/** Page one: a single question. No forms, no fields, no wallet. */
export function ConfessPage() {
  const navigate = useNavigate();
  const [story, setStory] = useState(() => readDraft()?.story ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => box.current?.focus(), []);

  const text = story.trim();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const confession = { title: titleFrom(text), story: text };
    setBusy(true);
    setError(null);
    try {
      const screened = await screenConfession(confession);
      if (!screened.ok) {
        setError(screened.message);
        return;
      }
      writeDraft(confession);
      navigate(soloPaths.stake);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.page} onSubmit={(e) => void submit(e)}>
      <span className={styles.bigGavel} aria-hidden>
        <Icon name="gavel" />
      </span>
      <h1 className={styles.heading}>{t('solo.live.confess.title')}</h1>
      <p className={styles.lede}>{t('solo.live.confess.lede')}</p>
      <label className="cc-visually-hidden" htmlFor="live-confession">
        {t('solo.live.confess.label')}
      </label>
      <textarea
        id="live-confession"
        ref={box}
        className={styles.confession}
        rows={4}
        maxLength={MAX}
        value={story}
        placeholder={t('solo.live.confess.placeholder')}
        onChange={(e) => setStory(e.target.value)}
      />
      <div className={styles.row}>
        <button type="button" className={styles.textButton} onClick={() => setStory(t(IDEAS[Math.floor(Math.random() * IDEAS.length)]!))}>
          {t('solo.live.confess.dice')}
        </button>
        <span className={styles.count}>{t('solo.live.confess.count', { left: MAX - story.length })}</span>
      </div>
      {error ? (
        <Alert tone="warning" title={error} live="polite">
          {null}
        </Alert>
      ) : null}
      <PaperButton type="submit" size="lg" className={styles.primary} loading={busy} disabled={text.length < MIN} iconEnd={<Icon name="arrow-right" />}>
        {busy ? t('solo.live.confess.checking') : t('solo.live.confess.next')}
      </PaperButton>
    </form>
  );
}
