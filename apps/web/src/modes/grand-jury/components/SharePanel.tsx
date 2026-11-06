import { buildShareCard, renderShareSvg, shareText, type DocketEntry } from '@cringe-court/modes-grand-jury';
import { useMemo, useState } from 'react';
import { Button, Icon, PaperButton, useToast } from '@/ds';
import { t } from '@/i18n';
import { paths, sharePalette } from '../lib';
import styles from '../GrandJury.module.css';
import { CourtPanel } from './parts';

function download(href: string, name: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

/** Rasterise the SVG card to a 1200×630 PNG (what chat apps preview). */
async function toPng(svg: string): Promise<string> {
  const img = new Image();
  img.decoding = 'async';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * The share card: a 1200×630 picture of the case right now ("4 of 7 strangers
 * agreed"), drawn in the live design tokens, plus native share, copy and
 * download. Works for live cases too ("the jury is out").
 */
export function SharePanel({ entry }: { entry: DocketEntry }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const url = typeof window === 'undefined' ? paths.case(entry.caseNumber) : new URL(paths.case(entry.caseNumber), window.location.origin).href;
  const card = useMemo(() => buildShareCard(entry, url), [entry, url]);
  const svg = useMemo(() => renderShareSvg(card, sharePalette()), [card]);
  const text = shareText(card);
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const file = `cringe-court-${entry.caseNumber}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: 'success', title: t('common.action.copied'), description: t('grandJury.share.copied.body') });
    } catch {
      toast({ tone: 'warning', title: t('grandJury.share.copyFailed.title'), description: t('grandJury.share.copyFailed.body') });
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: t('grandJury.share.native.title', { label: card.caseLabel, question: card.question }), text, url });
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') await copy();
    }
  };
  const png = async () => {
    setBusy(true);
    try {
      download(await toPng(svg), `${file}.png`);
    } catch {
      download(src, `${file}.svg`);
      toast({ tone: 'info', title: t('grandJury.share.svg.title'), description: t('grandJury.share.svg.body') });
    } finally {
      setBusy(false);
    }
  };
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <CourtPanel id="share-title" tone="kraft" elevation={1} className={styles.shareCard} eyebrow={card.tone === 'live' ? t('grandJury.share.eyebrow.live') : t('grandJury.share.eyebrow.done')} title={t('grandJury.share.title')}>
        <img className={styles.sharePreview} src={src} width={1200} height={630} alt={t('grandJury.share.alt', { label: card.caseLabel, question: card.question, headline: card.headline, subline: card.subline })} />
        <div className={styles.buttonRow}>
          {canShare && (
            <PaperButton onClick={share} iconStart={<Icon name="external" />}>
              {t('common.action.share')}
            </PaperButton>
          )}
          <Button variant={canShare ? 'secondary' : 'gold'} onClick={copy} iconStart={<Icon name="copy" />}>
            {t('grandJury.share.copyText')}
          </Button>
          <Button variant="ghost" onClick={png} loading={busy} iconStart={<Icon name="arrow-right" />}>
            {t('grandJury.share.downloadImage')}
          </Button>
        </div>
    </CourtPanel>
  );
}
