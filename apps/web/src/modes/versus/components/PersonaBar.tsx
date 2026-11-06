import { usdc } from '@cringe-court/core';
import { Link } from 'react-router';
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
    <aside className={styles.personaBar} aria-label="Your demo persona">
      <div className={styles.personaInner}>
        <div className={styles.personaWho}>
          <Badge tone="info" dot>
            Demo court
          </Badge>
          <TestnetBadge />
          <span className={styles.personaName}>
            <Icon name="user" aria-hidden />
            <span>
              {persona.name} <span className={styles.mono}>{shortAccount(persona.account)}</span>
            </span>
          </span>
          <span className={styles.personaBalance}>
            <span className="cc-visually-hidden">Demo wallet balance:</span>
            <Amount value={balance} size="sm" />
          </span>
          <PaperButton size="sm" variant="ghost" iconStart={<Icon name="plus" />} onClick={() => void run(() => desk.faucet(usdc('5.00')), { success: 'Added 5.00 test USDC to this demo wallet' })}>
            Test USDC
          </PaperButton>
        </div>
        <div className={styles.personaActions}>
          <Link to={versusPaths.cases} className={styles.personaLink}>
            My cases{mine > 0 && <span className={styles.count}>{mine}</span>}
          </Link>
          <Switch
            label="Sound"
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
                Switch persona
              </PaperButton>
            </DialogTrigger>
            <DialogContent
              title="Who are you in this tab?"
              description="Each tab can be a different person: open the invite in a new tab to play Side B, or a third tab to sit on the jury. Personas are demo wallets with a mock World ID; none of them is real."
              footer={
                <>
                  <DialogClose asChild>
                    <PaperButton variant="ghost" onClick={newPersona}>
                      New persona
                    </PaperButton>
                  </DialogClose>
                  <DialogClose asChild>
                    <PaperButton variant="maroon">Done</PaperButton>
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
                        {p.id === persona.id && <Badge tone="accent">This tab</Badge>}
                      </button>
                    </DialogClose>
                  </li>
                ))}
              </ul>
              <details className={styles.resetBox}>
                <summary>Reset the demo court</summary>
                <p>Deletes every Versus case, ballot scroll and demo balance stored in this browser, for every tab. Personas stay.</p>
                <DialogClose asChild>
                  <Button variant="danger" size="sm" onClick={resetDemo}>
                    Reset demo court
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
