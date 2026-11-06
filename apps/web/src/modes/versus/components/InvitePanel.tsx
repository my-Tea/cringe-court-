import { invitePath, type VersusCase } from '@cringe-court/modes-versus';
import { useState } from 'react';
import { Alert, Button, Dialog, DialogClose, DialogContent, DialogTrigger, Icon, PaperButton, useToast } from '@/ds';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { PaperSection } from './PaperSection';

/** Side A, waiting for Side B: the code, the link, ways to send them, and a way out. */
export function InvitePanel({ c }: { c: VersusCase }) {
  const { desk, run } = useVersus();
  const { toast } = useToast();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const url = `${window.location.origin}${invitePath(c.code)}`;
  const text = `I’m taking you to Versus Court over “${c.state.filing.title}”. Bring your own AI lawyer: ${url} (code ${c.code})`;

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? c.code : url);
      setCopied(what);
      toast({ title: what === 'code' ? 'Code copied' : 'Invite link copied', tone: 'success' });
    } catch {
      toast({ title: 'Copy did not work here', description: 'Select the text and copy it by hand.', tone: 'warning' });
    }
  };

  return (
    <PaperSection as="section" padding="lg" ribbon="Invite Side B" aria-labelledby="invite-title" className={styles.invite}>
      <h2 id="invite-title" className={styles.panelTitle}>
        Send this to the other side
      </h2>
      <p className={styles.muted}>Nothing is public and nothing is charged until they accept and you both approve the trial.</p>

      <div className={styles.codeCard}>
        <p className={styles.codeLabel}>Invite code</p>
        <p className={styles.code} aria-label={`Invite code ${c.code.split('').join(' ')}`}>
          {c.code}
        </p>
        <div className={styles.codeActions}>
          <PaperButton variant="maroon" size="sm" iconStart={<Icon name={copied === 'code' ? 'check' : 'copy'} />} onClick={() => void copy('code')}>
            Copy code
          </PaperButton>
          <PaperButton size="sm" iconStart={<Icon name={copied === 'link' ? 'check' : 'copy'} />} onClick={() => void copy('link')}>
            Copy invite link
          </PaperButton>
          {typeof navigator.share === 'function' && (
            <PaperButton size="sm" variant="ghost" iconStart={<Icon name="external" />} onClick={() => void navigator.share({ title: 'Versus Court', text, url }).catch(() => undefined)}>
              Share…
            </PaperButton>
          )}
        </div>
        <p className={styles.linkText}>
          <span className="cc-visually-hidden">Invite link: </span>
          {url}
        </p>
      </div>

      <Alert tone="info" title="Playing both sides yourself?">
        Open the invite link in a new tab. Each tab is its own demo persona with its own wallet and World ID, so the second tab can accept as Side B.
      </Alert>

      <div className={styles.panelFooter}>
        <Dialog>
          <DialogTrigger asChild>
            <PaperButton variant="ghost" size="sm">
              Withdraw this invite
            </PaperButton>
          </DialogTrigger>
          <DialogContent
            title="Withdraw the invite?"
            description="The case closes privately and the code stops working. Nothing was charged."
            size="sm"
            tone="danger"
            footer={
              <>
                <DialogClose asChild>
                  <PaperButton variant="ghost">Keep waiting</PaperButton>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="danger" onClick={() => void run(() => desk.withdraw(c.trialId, 'a'), { success: 'Invite withdrawn' })}>
                    Withdraw
                  </Button>
                </DialogClose>
              </>
            }
          />
        </Dialog>
      </div>
    </PaperSection>
  );
}
