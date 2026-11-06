import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Icon, Logo, PaperButton, PaperField, PaperPanel, PaperRibbon, PaperTile, useToast } from '@/ds';
import { paths } from '@/app/routes';
import styles from './LandingPage.module.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      email: !email ? 'Enter an email to sign in, or play as a guest.' : EMAIL.test(email) ? undefined : 'That email is missing an @ or a domain.',
      password: hasPassword ? undefined : 'Enter a password, or play as a guest.',
    };
    if (password.current) password.current.value = '';
    setErrors(next);
    if (next.email || next.password) {
      const first = event.currentTarget.querySelector<HTMLInputElement>(next.email ? 'input[name="email"]' : 'input[name="password"]');
      first?.focus();
      return;
    }
    toast({ tone: 'success', title: 'The court is now in session', description: 'Demo entry: accounts are not live yet, so nothing was sent or saved.' });
    navigate(paths.court);
  }

  function guest() {
    toast({ tone: 'info', title: 'Playing as a guest', description: 'Pick a court. Guests can watch and file practice cases.' });
    navigate(paths.court);
  }

  return (
    <PaperPanel as="section" tone="maroon" edge="cut" elevation={4} backing="gold" padding="lg" className={styles.panel} aria-labelledby="landing-title">
      <h1 id="landing-title" className={styles.logo}>
        <Logo layout="stacked" title="CringeCourt" />
      </h1>
      <PaperRibbon as="h2" sparks className={styles.ribbon}>
        The court is now in session
      </PaperRibbon>
      <PaperRibbon as="p" size="sm" tails={false} className={styles.tagline}>
        Make your case. Lose your dignity.
      </PaperRibbon>

      <form className={styles.form} onSubmit={enter} noValidate aria-label="Sign in">
        <PaperField
          label="Email"
          icon="mail"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="Enter your email"
          error={errors.email}
          onChange={() => errors.email && setErrors((e) => ({ ...e, email: undefined }))}
        />
        <PaperField
          ref={password}
          label="Password"
          icon="lock"
          name="password"
          type="password"
          autoComplete="off"
          placeholder="Enter your password"
          revealable
          error={errors.password}
          onChange={() => errors.password && setErrors((e) => ({ ...e, password: undefined }))}
        />
        <PaperButton type="submit" size="xl" fullWidth iconStart={<Icon name="gavel" />} className={styles.enter}>
          Enter the court
        </PaperButton>
        <PaperButton variant="maroon" size="lg" fullWidth iconStart={<Icon name="gamepad" />} onClick={guest}>
          Play as guest
        </PaperButton>
      </form>

      <div className={styles.social}>
        <p className={styles.divider}>
          <span>Or continue with</span>
        </p>
        <ul role="list" className={styles.tiles}>
          {SOCIAL.map((s) => (
            <li key={s.name}>
              <PaperTile
                icon={s.icon}
                label={`Continue with ${s.name}`}
                tone={s.tone}
                onClick={() => toast({ tone: 'info', title: `${s.name} sign-in is coming soon`, description: 'Play as a guest for now: every court is open to guests on testnet.' })}
              />
            </li>
          ))}
        </ul>
      </div>

      <p className={styles.demoNote}>
        <Icon name="shield" />
        <span>Demo sign-in. Accounts are not live yet: nothing you type here leaves this page.</span>
      </p>
    </PaperPanel>
  );
}
