import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CATEGORY_COPY, PRIVATE_NOTES_MAX, STORY_MAX, TITLE_MAX, redact, validateDraft, type DraftErrors, type SoloDraft } from '@cringe-court/modes-solo';
import { Alert, Button, Icon, PaperButton, PaperField, PaperRibbon, TextArea, cx } from '@/ds';
import { t } from '@/i18n';
import styles from './FilePage.module.css';
import { soloCategoryExample } from '@/i18n/domain';

export interface ConfessStepProps {
  draft: SoloDraft;
  onChange: (draft: SoloDraft) => void;
  onSubmit: (draft: SoloDraft) => void;
  serverError: string | null;
}

/** Step 1: what did you do? Category, title, the confession and private notes for your lawyer. */
export function ConfessStep({ draft, onChange, onSubmit, serverError }: ConfessStepProps) {
  const [errors, setErrors] = useState<DraftErrors>({});
  const [namesText, setNamesText] = useState(draft.hiddenNames.join(', '));
  const summaryRef = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<SoloDraft>) => onChange({ ...draft, ...patch });
  const autoHits = redact(`${draft.title}\n${draft.story}`, draft.hiddenNames).redactions.length;

  useEffect(() => {
    if (Object.keys(errors).length) summaryRef.current?.focus();
  }, [errors]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(draft);
  };

  const example = draft.category ? soloCategoryExample(draft.category) : null;
  const errorList = Object.entries(errors);

  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-labelledby="confess-title">
      <header className={styles.stepHead}>
        <p className={styles.eyebrow}>{t('solo.file.stepOf', { n: 1, total: 5 })}</p>
        <PaperRibbon as="h2" id="confess-title" className={styles.stepTitle}>
          {t('solo.confess.title')}
        </PaperRibbon>
        <p className={styles.lede}>{t('solo.confess.lede')}</p>
      </header>

      {errorList.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} className={styles.errorSummary}>
          <Alert tone="danger" title={t('solo.confess.errors.title')}>
            <ul>
              {errorList.map(([field, message]) => (
                <li key={field}>
                  <a href={`#solo-${field}`}>{message}</a>
                </li>
              ))}
            </ul>
          </Alert>
        </div>
      )}
      {serverError && (
        <Alert tone="danger" title={t('solo.confess.serverError.title')} live="assertive">
          {serverError}
        </Alert>
      )}

      <fieldset className={styles.categories} aria-describedby={errors.category ? 'solo-category-error' : undefined}>
        <legend className={styles.legend}>{t('solo.confess.category.legend')}</legend>
        <div className={styles.categoryGrid}>
          {CATEGORY_COPY.map((cc, i) => {
            const c = { id: cc.id, ...soloCategoryExample(cc.id) };
            return (
              <label key={c.id} className={cx(styles.category, draft.category === c.id && styles.categoryOn)}>
                <input
                  id={i === 0 ? 'solo-category' : undefined}
                  type="radio"
                  name="category"
                  value={c.id}
                  checked={draft.category === c.id}
                  onChange={() => set({ category: c.id })}
                />
                <span className={styles.categoryName}>{c.name}</span>
                <span className={styles.categoryBlurb}>{c.blurb}</span>
              </label>
            );
          })}
        </div>
        {errors.category && (
          <p id="solo-category-error" className={styles.fieldError}>
            {errors.category}
          </p>
        )}
      </fieldset>

      <PaperField
        id="solo-title"
        label={t('solo.confess.caseTitle.label')}
        hint={t('solo.confess.caseTitle.hint')}
        value={draft.title}
        maxLength={TITLE_MAX}
        placeholder={example?.exampleTitle ?? t('solo.confess.caseTitle.placeholder')}
        error={errors.title}
        onChange={(e) => set({ title: e.target.value })}
        autoComplete="off"
      />

      <TextArea
        id="solo-story"
        label={t('solo.confess.story.label')}
        hint={t('solo.confess.story.hint')}
        value={draft.story}
        maxLength={STORY_MAX}
        rows={6}
        placeholder={example?.example ?? t('solo.confess.story.placeholder')}
        error={errors.story}
        onChange={(e) => set({ story: e.target.value })}
      />
      {example && !draft.story && (
        <div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            iconStart={<Icon name="sparkle" />}
            onClick={() => set({ story: example.example, title: draft.title || example.exampleTitle })}
          >
            {t('solo.confess.example')}
          </Button>
        </div>
      )}

      <TextArea
        id="solo-privateNotes"
        label={t('solo.confess.notes.label')}
        optional
        hint={t('solo.confess.notes.hint')}
        value={draft.privateNotes}
        maxLength={PRIVATE_NOTES_MAX}
        rows={3}
        placeholder={t('solo.confess.notes.placeholder')}
        error={errors.privateNotes}
        onChange={(e) => set({ privateNotes: e.target.value })}
      />

      <PaperField
        id="solo-names"
        label={t('solo.confess.names.label')}
        optional
        hint={autoHits ? t('solo.confess.names.hintFound', { count: autoHits }) : t('solo.confess.names.hint')}
        value={namesText}
        onChange={(e) => {
          setNamesText(e.target.value);
          set({
            hiddenNames: e.target.value
              .split(',')
              .map((n) => n.trim())
              .filter(Boolean),
          });
        }}
        autoComplete="off"
      />

      <div className={styles.formActions}>
        <PaperButton type="submit" size="lg" iconEnd={<Icon name="arrow-right" />}>
          {t('solo.confess.submit')}
        </PaperButton>
        <p className={styles.small}>{t('solo.confess.footnote')}</p>
      </div>
    </form>
  );
}
