import { usdc } from '@cringe-court/core';
import { Link } from 'react-router';
import { t } from '@/i18n';
import { Amount, Badge, Button, Dialog, DialogClose, DialogContent, DialogTrigger, Icon, PaperButton, Switch, TestnetBadge } from '@/ds';
import { versusPaths } from '../mode';
import { shortAccount } from '../runtime/personas';
import { useAudioSnapshot, useVersus } from '../runtime/context';
import styles from '../versus.module.css';

/** Who you are in this tab, your demo wallet, sound, and the demo-court controls. */
export function PersonaBar() {
  const { persona, personas, switchPersona, newPersona, balance, desk, run, audio, resetDemo, snapshot } = useVersus();
  const sound = useAudioSnapshot(audio);
  const mine = snapshot?.cases.filter((c) => Object.values(c.parties).some((p) => p?.account === persona.account.toLowerCase())).length ?? 0;

  return (
    <aside className={styles.personaBar} aria-label={t('versus.persona.aria')}>
      <div className={styles.personaInner}>
        <div className={styles.personaWho}>
          <Badge tone="info" dot>
            {t('versus.persona.demoCourt')}
          </Badge>
          <TestnetBadge />
          <span className={styles.personaName}>
            <Icon name="user" aria-hidden />
            <span>
              {persona.name} <span className={styles.mono}>{shortAccount(persona.account)}</span>
            </span>
          </span>
          <span className={styles.personaBalance}>
            <span className="cc-visually-hidden">{t('versus.persona.balance')}</span>
            <Amount value={balance} size="sm" />
          </span>
          <PaperButton size="sm" variant="ghost" iconStart={<Icon name="plus" />} onClick={() => void run(() => desk.faucet(usdc('5.00')), { success: t('versus.persona.faucetSuccess') })}>
            {t('versus.persona.faucet')}
          </PaperButton>
        </div>
        <div className={styles.personaActions}>
          <Link to={versusPaths.cases} className={styles.personaLink}>
            {t('versus.persona.myCases')}
            {mine > 0 && <span className={styles.count}>{mine}</span>}
          </Link>
          <Switch
            label={t('versus.persona.sound')}
            checked={!sound.settings.muted}
            onCheckedChange={(on) => {
              if (on) void audio.unlock();
              audio.setMuted(!on);
            }}
            className={styles.soundSwitch}
          />
          <Dialog>
            <DialogTrigger asChild>
              <PaperButton size="sm" variant="maroon" iconStart={<Icon name="refresh" />}>
                {t('versus.persona.switch')}
              </PaperButton>
            </DialogTrigger>
            <DialogContent
              title={t('versus.persona.title')}
              description={t('versus.persona.description')}
              footer={
                <>
                  <DialogClose asChild>
                    <PaperButton variant="ghost" onClick={newPersona}>
                      {t('versus.persona.new')}
                    </PaperButton>
                  </DialogClose>
                  <DialogClose asChild>
                    <PaperButton variant="maroon">{t('versus.persona.done')}</PaperButton>
                  </DialogClose>
                </>
              }
            >
              <ul className={styles.personaList} role="list">
                {personas.map((p) => (
                  <li key={p.id}>
                    <DialogClose asChild>
                      <button type="button" className={styles.personaOption} aria-current={p.id === persona.id ? 'true' : undefined} onClick={() => switchPersona(p.id)}>
                        <span>{p.name}</span>
                        <span className={styles.mono}>{shortAccount(p.account)}</span>
                        {p.id === persona.id && <Badge tone="accent">{t('versus.persona.thisTab')}</Badge>}
                      </button>
                    </DialogClose>
                  </li>
                ))}
              </ul>
              <details className={styles.resetBox}>
                <summary>{t('versus.persona.reset.summary')}</summary>
                <p>{t('versus.persona.reset.body')}</p>
                <DialogClose asChild>
                  <Button variant="danger" size="sm" onClick={resetDemo}>
                    {t('versus.persona.reset.confirm')}
                  </Button>
                </DialogClose>
              </details>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </aside>
  );
}
