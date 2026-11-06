import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CATEGORY_COPY, PRIVATE_NOTES_MAX, STORY_MAX, TITLE_MAX, categoryCopy, redact, validateDraft, type DraftErrors, type SoloDraft } from '@cringe-court/modes-solo';
import { Alert, Button, Icon, PaperButton, PaperField, PaperRibbon, TextArea, cx } from '@/ds';
import styles from './FilePage.module.css';

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

  const example = draft.category ? categoryCopy(draft.category) : null;
  const errorList = Object.entries(errors);

  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-labelledby="confess-title">
      <header className={styles.stepHead}>
        <p className={styles.eyebrow}>Step 1 of 5</p>
        <PaperRibbon as="h2" id="confess-title" className={styles.stepTitle}>
          Confess your crime against common sense
        </PaperRibbon>
        <p className={styles.lede}>Counsel Chaos will defend you. Miss Ratio will try to cook you. Three jurors decide.</p>
      </header>

      {errorList.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} className={styles.errorSummary}>
          <Alert tone="danger" title="A few things before the court can hear this">
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
        <Alert tone="danger" title="The clerk rejected the filing" live="assertive">
          {serverError}
        </Alert>
      )}

      <fieldset className={styles.categories} aria-describedby={errors.category ? 'solo-category-error' : undefined}>
        <legend className={styles.legend}>What kind of crime?</legend>
        <div className={styles.categoryGrid}>
          {CATEGORY_COPY.map((c, i) => (
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
          ))}
        </div>
        {errors.category && (
          <p id="solo-category-error" className={styles.fieldError}>
            {errors.category}
          </p>
        )}
      </fieldset>

      <PaperField
        id="solo-title"
        label="Case title"
        hint="Short and public. The jury reads it first."
        value={draft.title}
        maxLength={TITLE_MAX}
        placeholder={example?.exampleTitle ?? 'Reply-all to the whole company'}
        error={errors.title}
        onChange={(e) => set({ title: e.target.value })}
        autoComplete="off"
      />

      <TextArea
        id="solo-story"
        label="Your confession"
        hint="What happened, in your words. This becomes public after the redaction step: no real names needed."
        value={draft.story}
        maxLength={STORY_MAX}
        rows={6}
        placeholder={example?.example ?? 'Tell the court what you did.'}
        error={errors.story}
        onChange={(e) => set({ story: e.target.value })}
      />
      {example && !draft.story && (
        <div>
          <Button type="button" size="sm" variant="ghost" iconStart={<Icon name="sparkle" />} onClick={() => set({ story: example.example, title: draft.title || example.exampleTitle })}>
            Use the example confession
          </Button>
        </div>
      )}

      <TextArea
        id="solo-privateNotes"
        label="Private notes for Counsel Chaos"
        optional
        hint="Only your lawyer reads these. Miss Ratio, the jury and the public never see them (D1)."
        value={draft.privateNotes}
        maxLength={PRIVATE_NOTES_MAX}
        rows={3}
        placeholder="The context that makes you look better. Your lawyer will use it carefully."
        error={errors.privateNotes}
        onChange={(e) => set({ privateNotes: e.target.value })}
      />

      <PaperField
        id="solo-names"
        label="Names or handles to hide"
        optional
        hint={`Comma-separated. Emails, links, phone numbers, @handles and wallets are hidden automatically${autoHits ? ` (${autoHits} found so far)` : ''}.`}
        value={namesText}
        onChange={(e) => {
          setNamesText(e.target.value);
          set({ hiddenNames: e.target.value.split(',').map((n) => n.trim()).filter(Boolean) });
        }}
        autoComplete="off"
      />

      <div className={styles.formActions}>
        <PaperButton type="submit" size="lg" iconEnd={<Icon name="arrow-right" />}>
          File the confession
        </PaperButton>
        <p className={styles.small}>Free until you take it to a jury. Your draft is saved in this browser.</p>
      </div>
    </form>
  );
}
