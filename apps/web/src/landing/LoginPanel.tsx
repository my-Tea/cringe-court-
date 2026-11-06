import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Icon, Logo, PaperButton, PaperField, PaperPanel, PaperRibbon, PaperTile, useToast } from '@/ds';
import { t } from '@/i18n';
import { paths } from '@/app/routes';
import styles from './LandingPage.module.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Provider names are brand names, shown as written. */
const SOCIAL = [
  { icon: 'discord', name: 'Discord', tone: 'blue' },
  { icon: 'google', name: 'Google', tone: 'cream' },
  { icon: 'apple', name: 'Apple', tone: 'maroon' },
] as const;

/**
 * The maroon sign-in panel of the landing (STYLE-GUIDE §9.10).
 *
 * A UI stub on purpose: accounts are not live, so nothing typed here is sent,
 * stored or logged. A well-formed demo sign-in just enters the court for this
 * visit; the password is wiped from the field the moment the form is submitted.
 */
export function LoginPanel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const password = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const hasPassword = String(form.get('password') ?? '').length > 0;
    const next = {
      email: !email ? t('shell.login.error.emailEmpty') : EMAIL.test(email) ? undefined : t('shell.login.error.emailInvalid'),
      password: hasPassword ? undefined : t('shell.login.error.passwordEmpty'),
    };
    if (password.current) password.current.value = '';
    setErrors(next);
    if (next.email || next.password) {
      const first = event.currentTarget.querySelector<HTMLInputElement>(next.email ? 'input[name="email"]' : 'input[name="password"]');
      first?.focus();
      return;
    }
    toast({ tone: 'success', title: t('shell.login.ribbon'), description: t('shell.login.toast.session') });
    navigate(paths.court);
  }

  function guest() {
    toast({ tone: 'info', title: t('shell.login.guest.title'), description: t('shell.login.guest.body') });
    navigate(paths.court);
  }

  return (
    <PaperPanel as="section" tone="maroon" edge="cut" elevation={4} backing="gold" padding="lg" className={styles.panel} aria-labelledby="landing-title">
      <h1 id="landing-title" className={styles.logo}>
        <Logo layout="stacked" title={t('common.app.name')} />
      </h1>
      <PaperRibbon as="h2" sparks className={styles.ribbon}>
        {t('shell.login.ribbon')}
      </PaperRibbon>
      <PaperRibbon as="p" size="sm" tails={false} className={styles.tagline}>
        {t('shell.login.tagline')}
      </PaperRibbon>

      <form className={styles.form} onSubmit={enter} noValidate aria-label={t('shell.login.formLabel')}>
        <PaperField
          label={t('shell.login.email')}
          icon="mail"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder={t('shell.login.email.placeholder')}
          error={errors.email}
          onChange={() => errors.email && setErrors((e) => ({ ...e, email: undefined }))}
        />
        <PaperField
          ref={password}
          label={t('shell.login.password')}
          icon="lock"
          name="password"
          type="password"
          autoComplete="off"
          placeholder={t('shell.login.password.placeholder')}
          revealable
          error={errors.password}
          onChange={() => errors.password && setErrors((e) => ({ ...e, password: undefined }))}
        />
        <PaperButton type="submit" size="xl" fullWidth iconStart={<Icon name="gavel" />} className={styles.enter}>
          {t('shell.login.enter')}
        </PaperButton>
        <PaperButton variant="maroon" size="lg" fullWidth iconStart={<Icon name="gamepad" />} onClick={guest}>
          {t('shell.login.guest')}
        </PaperButton>
      </form>

      <div className={styles.social}>
        <p className={styles.divider}>
          <span>{t('shell.login.or')}</span>
        </p>
        <ul role="list" className={styles.tiles}>
          {SOCIAL.map((s) => (
            <li key={s.name}>
              <PaperTile
                icon={s.icon}
                label={t('shell.login.social.label', { name: s.name })}
                tone={s.tone}
                onClick={() => toast({ tone: 'info', title: t('shell.login.social.soon.title', { name: s.name }), description: t('shell.login.social.soon.body') })}
              />
            </li>
          ))}
        </ul>
      </div>

      <p className={styles.demoNote}>
        <Icon name="shield" />
        <span>{t('shell.login.demoNote')}</span>
      </p>
    </PaperPanel>
  );
}
