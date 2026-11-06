import { shareCardModel, shareCardSvg, shareText, type ShareTheme, type VersusCase } from '@cringe-court/modes-versus';
import { useMemo } from 'react';
import { Card, CardBody, CardHeader, CardTitle, Icon, PaperButton, Stamp, useToast } from '@/ds';
import { palette } from '@/ds/tokens';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';

/** The downloadable card uses the style-guide palette straight from the design tokens. */
const THEME: ShareTheme = {
  paper: palette.neutral[100],
  paperDeep: palette.gold[100],
  ink: palette.neutral[900],
  inkMuted: palette.neutral[700],
  frame: palette.gold[500],
  frameDark: palette.gold[900],
  accent: palette.royal[900],
  sideA: palette.teal[700],
  sideB: palette.royal[500],
  mistrial: palette.neutral[700],
  onStamp: palette.neutral[100],
};

async function svgToPng(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('The card image could not be drawn'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available');
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Bragging rights, collectible-looking, never an NFT (V4 §5). No names, wallets or amounts. */
export function ShareCard({ c }: { c: VersusCase }) {
  const { desk, run } = useVersus();
  const { toast } = useToast();
  const model = useMemo(() => shareCardModel(c), [c]);
  if (!model) return null;
  const url = `${window.location.origin}/versus/case/${c.trialId}`;
  const text = shareText(model, url);
  const record = (channel: 'link' | 'image' | 'x' | 'native') => void run(() => desk.share(c.trialId, channel), { quiet: true });
  const file = `${model.caseLabel.replace(/[^0-9A-Z]+/gi, '-').toLowerCase()}-versus.png`;

  return (
    <Card as="section" aria-labelledby="share-title" padding="lg">
      <CardHeader eyebrow="Share card">
        <CardTitle id="share-title" as="h2">
          Tell the group chat
        </CardTitle>
      </CardHeader>
      <CardBody className={styles.stack}>
        <figure className={styles.shareCard} data-outcome={model.outcome}>
          <div className={styles.shareInner}>
            <p className={styles.shareEyebrow}>
              Versus Court · {model.caseLabel} · {model.category}
            </p>
            <p className={styles.shareTitle}>“{model.title}”</p>
            <Stamp tone={model.outcome === 'a' ? 'side-a' : model.outcome === 'b' ? 'side-b' : 'no-verdict'} size="lg" className={styles.shareStamp}>
              {model.headline}
            </Stamp>
            <p className={styles.shareSub}>{model.outcome === 'mistrial' ? 'No verdict · both sides refunded' : `${model.winner} beat ${model.loser}`}</p>
            <p className={styles.shareMeta}>
              Jury {model.tally[0]}–{model.tally[1]} · {model.completed} of {model.appointed} jurors finished duty
            </p>
            {model.quote && (
              <blockquote className={styles.shareQuote}>
                “{model.quote.text}” <cite>— {model.quote.speaker}</cite>
              </blockquote>
            )}
            <p className={styles.shareFoot}>
              <span>Bragging rights only · testnet · transcript {model.fingerprint}…</span>
              <span className={styles.shareBrand}>CringeCourt</span>
            </p>
          </div>
          <figcaption className="cc-visually-hidden">Share card preview</figcaption>
        </figure>
        <div className={styles.inlineActions}>
          <PaperButton
            iconStart={<Icon name="copy" />}
            onClick={() =>
              void navigator.clipboard.writeText(text).then(
                () => {
                  toast({ title: 'Copied the post and link', tone: 'success' });
                  record('link');
                },
                () => toast({ title: 'Copy did not work here', tone: 'warning' }),
              )
            }
          >
            Copy post
          </PaperButton>
          <PaperButton
      variant="maroon"
      iconStart={<Icon name="document" />}
      onClick={() =>
       void svgToPng(shareCardSvg(model, THEME))
        .then((png) => {
         download(png, file);
         record('image');
        })
        .catch(() => {
         download(new Blob([shareCardSvg(model, THEME)], { type: 'image/svg+xml' }), file.replace('.png', '.svg'));
         record('image');
        })
      }
     >
            Download image
          </PaperButton>
          <a className={styles.xLink} href={`https://x.com/intent/post?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" onClick={() => record('x')}>
            <Icon name="external" aria-hidden /> Post on X<span className="cc-visually-hidden"> (opens in a new tab)</span>
          </a>
          {typeof navigator.share === 'function' && (
            <PaperButton variant="ghost" iconStart={<Icon name="external" />} onClick={() => void navigator.share({ title: model.caseLabel, text, url }).then(() => record('native'), () => undefined)}>
              Share…
            </PaperButton>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
