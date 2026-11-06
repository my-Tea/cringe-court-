import { useEffect, useRef, useState } from 'react';
import { NPC_PERSONAS, type ShareSummary } from '@cringe-court/modes-solo';
import { portrait } from '@/art/art';
import { Alert, Icon, PaperButton, Skeleton, buttonClassName, useToast } from '@/ds';
import { fontFamily } from '@/ds/tokens';
import { jurorArt } from '../lib/art';
import { SoloIcon } from '../lib/SoloIcon';
import { SHARE_SIZES, drawShareCard, type ShareAssets, type ShareFormat } from './drawShareCard';
import styles from './ShareCard.module.css';

export interface ShareCardProps {
  summary: ShareSummary;
  /** Called after each successful share action (records SHARED on the case). */
  onShared?: (channel: 'link' | 'image' | 'x' | 'native') => void;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadAssets(summary: ShareSummary): Promise<ShareAssets> {
  const speaker = summary.quote?.by === 'Miss Ratio' ? 'prosecutor' : summary.quote?.by === 'Counsel Chaos' ? 'defense' : 'judge';
  const [face, ...jurors] = await Promise.all([
    loadImage(portrait(speaker, 'smug').src),
    ...NPC_PERSONAS.map((p) => loadImage(jurorArt(p.id))),
  ]);
  const assets: ShareAssets = { jurors: jurors.filter((j): j is HTMLImageElement => j !== null) };
  if (face) assets.speaker = face;
  return assets;
}

async function fontsReady(): Promise<void> {
  try {
    const faces = [fontFamily.display, fontFamily.pixel, fontFamily.body, fontFamily.mono].map((f) => f.split(',')[0]!);
    await Promise.race([
      Promise.all(faces.flatMap((f) => [document.fonts.load(`700 40px ${f}`), document.fonts.load(`italic 600 22px ${f}`)])),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
  } catch {
    // Older browsers: draw with the fallback face.
  }
}

/**
 * The verdict share card: drawn on a canvas, exported as PNG. The preview is an
 * image with a full text description; every action also works by keyboard.
 */
export function ShareCard({ summary, onShared }: ShareCardProps) {
  const [format, setFormat] = useState<ShareFormat>('landscape');
  const [status, setStatus] = useState<'drawing' | 'ready' | 'unsupported'>('drawing');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const size = SHARE_SIZES[format];
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas?.getContext('2d') ?? null;
    } catch {
      ctx = null;
    }
    if (!canvas || !ctx) {
      setStatus('unsupported');
      return;
    }
    setStatus('drawing');
    void (async () => {
      await fontsReady();
      const assets = await loadAssets(summary);
      if (cancelled) return;
      drawShareCard(ctx, summary, format, assets);
      setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [summary, format]);

  const fileName = `cringecourt-${summary.caseLabel.replace(/\W+/g, '').toLowerCase()}-${format}.png`;

  const toBlob = () =>
    new Promise<Blob | null>((resolve) => {
      const c = canvasRef.current;
      if (!c) return resolve(null);
      c.toBlob((b) => resolve(b), 'image/png');
    });

  const download = async () => {
    const blob = await toBlob();
    if (!blob) {
      toast({ title: 'Could not export the image', description: 'Try another browser, or copy the caption instead.', tone: 'danger' });
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    onShared?.('image');
    toast({ title: 'Share card saved', description: fileName, tone: 'success' });
  };

  const nativeShare = async () => {
    const blob = await toBlob();
    const file = blob ? new File([blob], fileName, { type: 'image/png' }) : null;
    const data: ShareData = { title: `${summary.caseLabel} · CringeCourt`, text: summary.shareText };
    if (file && navigator.canShare?.({ files: [file] })) data.files = [file];
    try {
      await navigator.share(data);
      onShared?.('native');
    } catch {
      // The user closed the share sheet: nothing to do.
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(summary.shareText);
      onShared?.('link');
      toast({ title: 'Caption copied', tone: 'success' });
    } catch {
      toast({ title: 'Copy failed', description: 'Select the caption text and copy it by hand.', tone: 'warning' });
    }
  };

  const description = `Share card. ${summary.caseLabel}, ${summary.category}: “${summary.title}”. Verdict ${summary.verdictLabel}, ${summary.tally[0]} to ${summary.tally[1]}. ${summary.headline}${summary.quote ? ` Quote from ${summary.quote.by}: “${summary.quote.text}”` : ''}`;

  return (
    <section className={styles.share} aria-labelledby="share-title">
      <div className={styles.head}>
        <h2 id="share-title" className={styles.title}>
          Share the verdict
        </h2>
        <fieldset className={styles.formats}>
          <legend className="cc-visually-hidden">Card format</legend>
          {(Object.keys(SHARE_SIZES) as ShareFormat[]).map((f) => (
            <label key={f} className={styles.format} data-checked={f === format || undefined}>
              <input type="radio" name="share-format" value={f} checked={f === format} onChange={() => setFormat(f)} />
              {SHARE_SIZES[f].label}
            </label>
          ))}
        </fieldset>
      </div>

      <div className={styles.preview} data-format={format}>
        {status === 'unsupported' ? (
          <Alert tone="warning" title="This browser cannot draw the card">
            The caption below still works: copy it or post it.
          </Alert>
        ) : (
          <>
            {status === 'drawing' && <Skeleton className={styles.skeleton} />}
            <div role="img" aria-label={description} className={styles.canvasWrap}>
              <canvas
                ref={canvasRef}
                width={size.width}
                height={size.height}
                className={styles.canvas}
                data-ready={status === 'ready' || undefined}
                aria-hidden
              />
            </div>
          </>
        )}
      </div>

      <p className={styles.caption}>
        <span className="cc-visually-hidden">Caption: </span>
        {summary.shareText}
      </p>

      <div className={styles.actions}>
        <PaperButton onClick={download} disabled={status !== 'ready'} iconStart={<SoloIcon name="download" />}>
          Download PNG
        </PaperButton>
        {canNativeShare && (
          <PaperButton variant="maroon" onClick={nativeShare} disabled={status !== 'ready'} iconStart={<SoloIcon name="share" />}>
            Share…
          </PaperButton>
        )}
        <PaperButton variant="maroon" onClick={copyCaption} iconStart={<Icon name="copy" />}>
          Copy caption
        </PaperButton>
        <a
          href={`https://x.com/intent/post?text=${encodeURIComponent(summary.shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName({ variant: 'ghost' })}
          onClick={() => onShared?.('x')}
        >
          Post on X <Icon name="external" />
          <span className="cc-visually-hidden"> (opens in a new tab)</span>
        </a>
      </div>
      <p className={styles.note}>No names, handles or wallets: everything on the card already passed the redaction step.</p>
    </section>
  );
}
