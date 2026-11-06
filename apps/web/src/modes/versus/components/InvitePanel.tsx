import { invitePath, type VersusCase } from '@cringe-court/modes-versus';
import { useState } from 'react';
import { t } from '@/i18n';
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
  const text = t('versus.invite.shareText', { title: c.state.filing.title, url, code: c.code });

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? c.code : url);
      setCopied(what);
      toast({ title: what === 'code' ? t('versus.invite.codeCopied') : t('versus.invite.linkCopied'), tone: 'success' });
    } catch {
      toast({ title: t('versus.invite.copyFailed'), description: t('versus.invite.copyFailedHint'), tone: 'warning' });
    }
  };

  return (
    <PaperSection as="section" padding="lg" ribbon={t('versus.invite.ribbon')} aria-labelledby="invite-title" bodyClassName={styles.invite}>
      <h2 id="invite-title" className={styles.panelTitle}>
        {t('versus.invite.title')}
      </h2>
      <p className={styles.muted}>{t('versus.invite.note')}</p>

      <div className={styles.codeCard}>
        <p className={styles.codeLabel}>{t('versus.invite.codeLabel')}</p>
        <p className={styles.code} aria-label={t('versus.invite.codeAria', { code: c.code.split('').join(' ') })}>
          {c.code}
        </p>
        <div className={styles.codeActions}>
          <PaperButton variant="maroon" size="sm" iconStart={<Icon name={copied === 'code' ? 'check' : 'copy'} />} onClick={() => void copy('code')}>
            {t('versus.invite.copyCode')}
          </PaperButton>
          <PaperButton size="sm" iconStart={<Icon name={copied === 'link' ? 'check' : 'copy'} />} onClick={() => void copy('link')}>
            {t('versus.invite.copyLink')}
          </PaperButton>
          {typeof navigator.share === 'function' && (
            <PaperButton size="sm" variant="ghost" iconStart={<Icon name="external" />} onClick={() => void navigator.share({ title: t('common.mode.versus'), text, url }).catch(() => undefined)}>
              {t('versus.invite.share')}
            </PaperButton>
          )}
        </div>
        <p className={styles.fine} data-testid="invite-same-browser">
          {t('versus.invite.sameBrowser')}
        </p>
        <p className={styles.linkText}>
          <span className="cc-visually-hidden">{t('versus.invite.linkLabel')}</span>
          {url}
        </p>
      </div>

      <Alert tone="info" title={t('versus.invite.both.title')}>
        {t('versus.invite.both.body')}
      </Alert>

      <div className={styles.panelFooter}>
        <Dialog>
          <DialogTrigger asChild>
            <PaperButton variant="ghost" size="sm">
              {t('versus.invite.withdraw')}
            </PaperButton>
          </DialogTrigger>
          <DialogContent
            title={t('versus.invite.withdrawTitle')}
            description={t('versus.invite.withdrawBody')}
            size="sm"
            tone="danger"
            footer={
              <>
                <DialogClose asChild>
                  <PaperButton variant="ghost">{t('versus.invite.keepWaiting')}</PaperButton>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="danger" onClick={() => void run(() => desk.withdraw(c.trialId, 'a'), { success: t('versus.invite.withdrawn') })}>
                    {t('versus.withdraw.confirm')}
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
