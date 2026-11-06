"""Interim scene art cropped from the style-guide sheet (docs/assets/style-guide.png)
until dedicated renders exist. See docs/STYLE-GUIDE.md, "Interim scene art".

  npm run guide-art -w @cringe-court/web              regenerate src/art/guide/*.webp
  npm run guide-art -w @cringe-court/web -- --check   exit 1 if a committed crop is stale or missing

Needs Pillow (python3 -m pip install pillow). Output is WebP (lossy, q=86, alpha kept):
the sheet is painterly art, so PNG would be ~1.2 MB for the courthouse alone.
"""
import io
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
SHEET = HERE / '../../../docs/assets/style-guide.png'
OUT = HERE / '../src/art/guide'

# Crop boxes in sheet pixels (x, y, w, h); feather fades edges (l, r, t, b) to transparent
# so the art sits on any parchment surface.
CROPS = [
    ('courthouse', (428, 24, 662, 770), (120, 110, 140, 150)),
    ('colonnade', (1112, 92, 360, 334), None),
]


def smooth(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def crop(sheet: Image.Image, box, feather) -> bytes:
    x, y, w, h = box
    img = sheet.crop((x, y, x + w, y + h)).convert('RGBA')
    if feather:
        fl, fr, ft, fb = feather
        alpha = Image.new('L', (w, h))
        px = alpha.load()
        for j in range(h):
            for i in range(w):
                px[i, j] = round(255 * smooth(min(i / fl, (w - 1 - i) / fr, j / ft, (h - 1 - j) / fb)))
        img.putalpha(alpha)
    buf = io.BytesIO()
    img.save(buf, 'WEBP', quality=86, method=6, exact=False)
    return buf.getvalue()


def main() -> int:
    check = '--check' in sys.argv
    sheet = Image.open(SHEET)
    OUT.mkdir(parents=True, exist_ok=True)
    stale = 0
    for name, box, feather in CROPS:
        data = crop(sheet, box, feather)
        path = OUT / f'{name}.webp'
        if check:
            if not path.exists() or path.read_bytes() != data:
                print(f'src/art/guide/{name}.webp is out of date. Run `npm run guide-art`.', file=sys.stderr)
                stale += 1
        else:
            path.write_bytes(data)
    if stale:
        return 1
    print(f'{len(CROPS)} guide crops are up to date.' if check else f'Wrote {len(CROPS)} guide crops to {OUT.resolve()}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
