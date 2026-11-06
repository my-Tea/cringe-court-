import { Chibi } from './chibi';
import { ring, type Swatch } from './geometry';
import { Block, Cut, Layer, Line, Poly, Scales, Sparks } from './paper';
import styles from './CourtroomScene.module.css';

/**
 * The papercraft courtroom (STYLE-GUIDE §9.9): an original, hand-built SVG in
 * the reference's language. Nine paper layers, back to front, each a parallax
 * plane (`--d`) with its own entrance slot (`--cc-stagger`).
 */

const W = 1000;
/** Drawn to 780; the board runs 20 above and 40 below so wide and tall crops never show an edge. */
const TOP = -20;
const BOTTOM = 820;

function Wall() {
  const planks = Array.from({ length: 17 }, (_, i) => i * 60);
  return (
    <Layer depth={0.08} order={0} className={styles.layer}>
      <Poly t="neutral-900" p={[[0, TOP], [W, TOP], [W, BOTTOM], [0, BOTTOM]]} />
      {planks.map((x, i) => (
        <g key={x}>
          <Poly t={i % 2 ? 'gold-900' : 'neutral-700'} o={0.55} p={[[x, 40], [x + 58, 40], [x + 58, BOTTOM], [x, BOTTOM]]} />
          <Poly t="neutral-900" o={0.35} p={[[x + 40, 40], [x + 58, 40], [x + 58, BOTTOM], [x + 46, BOTTOM]]} />
        </g>
      ))}
      {/* maroon frieze under the ceiling */}
      <Poly t="royal-900" p={[[0, TOP], [W, TOP], [W, 52], [0, 58]]} />
      <Poly t="gold-700" p={[[0, 56], [W, 50], [W, 58], [0, 64]]} />
    </Layer>
  );
}

function ArchWindow() {
  const outer = 'M112 316 V150 Q112 58 230 22 Q348 58 348 150 V316 Z';
  const inner = 'M134 300 V156 Q134 78 230 46 Q326 78 326 156 V300 Z';
  return (
    <g>
      <Cut t="gold-700" d={outer} />
      <Cut t="gold-500" d="M112 316 V150 Q112 58 230 22 L230 316 Z" />
      <clipPath id="cc-hero-glass">
        <path d={inner} />
      </clipPath>
      <g clipPath="url(#cc-hero-glass)">
        <Poly t="blue-300" p={[[120, 30], [340, 30], [340, 310], [120, 310]]} />
        <Poly t="blue-500" o={0.45} p={[[120, 30], [340, 30], [340, 120], [120, 170]]} />
        {/* paper clouds */}
        <Poly t="neutral-100" p={[[150, 200], [170, 178], [196, 184], [212, 168], [238, 178], [246, 200]]} />
        <Poly t="blue-100" p={[[196, 184], [212, 168], [238, 178], [246, 200], [214, 200]]} />
        <Poly t="neutral-100" p={[[256, 150], [272, 134], [294, 140], [312, 128], [330, 152]]} />
        {/* folded hills */}
        <Poly t="green-500" p={[[120, 310], [120, 250], [168, 222], [214, 262], [262, 226], [340, 270], [340, 310]]} />
        <Poly t="green-700" p={[[168, 222], [214, 262], [190, 310], [150, 310]]} />
        <Poly t="green-700" p={[[262, 226], [340, 270], [340, 310], [290, 310]]} />
        {/* leading */}
        <Line t="gold-700" w={5} d="M230 30 V310 M120 132 H340 M120 222 H340" />
        <Line t="gold-900" w={2} o={0.6} d="M180 40 V310 M280 40 V310" />
      </g>
      {/* sill */}
      <Poly t="gold-300" p={[[100, 310], [360, 310], [352, 328], [108, 328]]} />
      <Poly t="gold-500" p={[[230, 310], [360, 310], [352, 328], [230, 328]]} />
    </g>
  );
}

function Column({ x, w = 56, top = 64, bottom = 420 }: { x: number; w?: number; top?: number; bottom?: number }) {
  return (
    <g>
      <Poly t="neutral-100" p={[[x, top + 30], [x + w, top + 30], [x + w, bottom], [x, bottom]]} />
      <Poly t="neutral-300" p={[[x + w * 0.62, top + 30], [x + w, top + 30], [x + w, bottom], [x + w * 0.62, bottom]]} />
      <Line t="neutral-300" w={2} d={`M${x + w * 0.22} ${top + 36} V${bottom} M${x + w * 0.42} ${top + 36} V${bottom}`} />
      <Line t="neutral-500" w={2} o={0.6} d={`M${x + w * 0.8} ${top + 36} V${bottom}`} />
      {/* capital */}
      <Poly t="gold-100" p={[[x - 12, top], [x + w + 12, top], [x + w + 6, top + 16], [x - 6, top + 16]]} />
      <Poly t="neutral-300" p={[[x - 4, top + 16], [x + w + 4, top + 16], [x + w, top + 30], [x, top + 30]]} />
      <Poly t="neutral-300" o={0.8} p={[[x + w * 0.6, top], [x + w + 12, top], [x + w + 6, top + 16], [x + w * 0.6, top + 16]]} />
    </g>
  );
}

function Curtain({ x, w, h, flip = false }: { x: number; w: number; h: number; flip?: boolean }) {
  const s = flip ? -1 : 1;
  return (
    <g transform={`translate(${x} 0) scale(${s} 1)`}>
      <Poly t="royal-700" p={[[0, 40], [w, 40], [w * 0.55, h * 0.55], [w * 0.62, h], [0, h]]} />
      <Poly t="royal-900" p={[[w * 0.18, 40], [w * 0.36, 40], [w * 0.2, h], [w * 0.06, h]]} />
      <Poly t="royal-900" o={0.7} p={[[w * 0.6, 40], [w * 0.78, 40], [w * 0.42, h * 0.62], [w * 0.38, h]]} />
      <Poly t="royal-500" o={0.5} p={[[w * 0.36, 40], [w * 0.6, 40], [w * 0.3, h * 0.8]]} />
      {/* gold tie-back */}
      <Poly t="gold-300" p={[[w * 0.02, h * 0.56], [w * 0.5, h * 0.53], [w * 0.5, h * 0.6], [w * 0.02, h * 0.63]]} />
    </g>
  );
}

function Banner({ x, y, w = 74, h = 150 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={styles.sway}>
        <Poly t="gold-500" p={[[-w / 2 - 6, 0], [w / 2 + 6, 0], [w / 2 + 6, h], [0, h + 26], [-w / 2 - 6, h]]} />
        <Poly t="royal-700" p={[[-w / 2, 6], [w / 2, 6], [w / 2, h - 4], [0, h + 18], [-w / 2, h - 4]]} />
        <Poly t="royal-900" o={0.75} p={[[0, 6], [w / 2, 6], [w / 2, h - 4], [0, h + 18]]} />
        <Scales x={0} y={h * 0.5} s={1.05} />
      </g>
      {/* rod */}
      <Poly t="gold-300" p={[[-w / 2 - 14, -6], [w / 2 + 14, -6], [w / 2 + 14, 2], [-w / 2 - 14, 2]]} />
      <Poly t="gold-700" p={[[-w / 2 - 14, -1], [w / 2 + 14, -1], [w / 2 + 14, 2], [-w / 2 - 14, 2]]} />
    </g>
  );
}

/** Swagged maroon valance under the ceiling, with a gold fringe. */
function Valance() {
  const swags = [0, 1, 2, 3, 4];
  return (
    <g>
      {swags.map((i) => {
        const x0 = i * 200;
        const x1 = x0 + 200;
        const mid = x0 + 100;
        return (
          <g key={i}>
            <Cut t="royal-700" d={`M${x0 - 4} ${TOP} H${x1 + 4} V36 Q${mid} 92 ${x0 - 4} 36 Z`} />
            <Cut t="royal-900" o={0.55} d={`M${mid} ${TOP} H${x1 + 4} V36 Q${mid + 50} 78 ${mid} 64 Z`} />
            <Cut t="royal-500" o={0.35} d={`M${x0 + 18} 10 Q${mid} 52 ${x1 - 18} 10 Q${mid} 40 ${x0 + 18} 10 Z`} />
            <Line t="gold-300" w={5} d={`M${x0} 38 Q${mid} 94 ${x1} 38`} />
            <Line t="gold-700" w={2} o={0.8} d={`M${x0} 44 Q${mid} 100 ${x1} 44`} />
          </g>
        );
      })}
      {[0, 200, 400, 600, 800, 1000].map((x) => (
        <g key={x}>
          <Poly t="gold-300" p={[[x - 9, 26], [x + 9, 26], [x + 5, 52], [x - 5, 52]]} />
          <Poly t="gold-500" p={[[x, 26], [x + 9, 26], [x + 5, 52], [x, 52]]} />
        </g>
      ))}
    </g>
  );
}

function Backdrop() {
  return (
    <Layer depth={0.18} order={1} className={styles.layer}>
      <g className={styles.drop2}>
        <ArchWindow />
        <Column x={404} />
        <Column x={600} top={70} bottom={340} />
        <Column x={930} top={70} />
        <Curtain x={0} w={110} h={360} />
        <Curtain x={420} w={66} h={250} flip />
        <Valance />
      </g>
    </Layer>
  );
}

function Throne() {
  return (
    <Layer depth={0.28} order={2} className={styles.layer}>
      <g className={styles.drop2}>
        <Banner x={520} y={92} />
        <Banner x={900} y={100} w={66} h={136} />
        {/* the judge's high-backed chair */}
        <Cut t="gold-500" d="M640 330 V176 Q640 112 735 92 Q830 112 830 176 V330 Z" />
        <Cut t="royal-700" d="M654 330 V182 Q654 128 735 110 Q816 128 816 182 V330 Z" />
        <Cut t="royal-900" o={0.7} d="M735 110 Q816 128 816 182 V330 H735 Z" />
        <Poly t="gold-300" p={[[722, 84], [735, 64], [748, 84], [735, 96]]} />
      </g>
    </Layer>
  );
}

function Gavel() {
  // sleeve, fur cuff, hand and the big gold gavel; the whole arm pivots at the shoulder
  return (
    <g className={styles.gavel}>
      <Poly t="royal-700" p={[[688, 304], [716, 290], [664, 200], [638, 214]]} />
      <Poly t="royal-900" o={0.6} p={[[702, 297], [716, 290], [664, 200], [654, 205]]} />
      <Poly t="neutral-100" p={[[634, 212], [664, 196], [672, 210], [642, 226]]} />
      <g transform="translate(648 196) rotate(-28)">
        <Poly t="gold-700" p={[[-5, -96], [5, -96], [6, 8], [-6, 8]]} />
        <Poly t="gold-900" o={0.5} p={[[0, -96], [5, -96], [6, 8], [0, 8]]} />
        <Poly t="gold-300" p={[[-44, -128], [44, -128], [46, -84], [-46, -84]]} />
        <Poly t="gold-500" p={[[0, -128], [44, -128], [46, -84], [0, -84]]} />
        <Poly t="gold-700" p={[[-52, -132], [-40, -132], [-40, -80], [-52, -80]]} />
        <Poly t="gold-700" p={[[40, -132], [52, -132], [52, -80], [40, -80]]} />
        <Poly t="gold-100" o={0.75} p={[[-34, -122], [-6, -122], [-8, -114], [-34, -114]]} />
      </g>
      <Poly t="royal-100" p={ring(648, 198, 15, 14, 8)} />
      <Poly t="royal-300" o={0.5} p={[[648, 184], [663, 196], [656, 210], [648, 204]]} />
    </g>
  );
}

function Bench() {
  return (
    <Layer depth={0.42} order={3} className={styles.layer}>
      <g className={styles.drop3}>
        <Chibi
          x={738}
          y={226}
          r={56}
          tilt={-4}
          skin="royal-100"
          hair={{ t: 'neutral-100', shade: 'neutral-300', style: 'spiky', n: 9 }}
          beard="neutral-100"
          eyes="shades"
          mouth="laugh"
          body={{ t: 'royal-700', shade: 'royal-900', w: 2.8, h: 1.6, collar: 'fur' }}
        />
        <Gavel />
        <Sparks x={640} y={106} s={1.1} flip />
        <Sparks x={812} y={150} s={0.9} />
        {/* the bench: a wide wooden box with a gold lip */}
        <Block x={560} y={336} w={340} h={210} lit="gold-700" shade="gold-900" lip="gold-500" lipH={14} />
        <Poly t="gold-300" o={0.6} p={[[554, 322], [906, 322], [904, 327], [556, 327]]} />
        {[590, 830].map((x) => (
          <g key={x}>
            <Poly t="gold-900" o={0.55} p={[[x, 360], [x + 50, 360], [x + 50, 520], [x, 520]]} />
            <Poly t="gold-500" o={0.4} p={[[x + 4, 364], [x + 46, 364], [x + 46, 370], [x + 4, 370]]} />
          </g>
        ))}
        {/* books and a paper block on the bench */}
        <Block x={584} y={306} w={58} h={16} lit="royal-700" shade="royal-900" />
        <Block x={590} y={292} w={48} h={14} lit="teal-700" shade="teal-900" />
        <Poly t="neutral-100" p={[[790, 312], [850, 308], [854, 322], [792, 324]]} />
        <Poly t="neutral-300" p={[[820, 310], [850, 308], [854, 322], [822, 323]]} />
        {/* court banner hanging off the bench */}
        <Poly t="gold-500" p={[[676, 340], [800, 340], [800, 462], [738, 494], [676, 462]]} />
        <Poly t="royal-700" p={[[684, 346], [792, 346], [792, 456], [738, 484], [684, 456]]} />
        <Poly t="royal-900" o={0.7} p={[[738, 346], [792, 346], [792, 456], [738, 484]]} />
        <Scales x={738} y={410} s={1.3} />
      </g>
      {/* the bailiff: a police officer, arms folded, unimpressed */}
      <g className={styles.drop3}>
        <Chibi
          x={944}
          y={300}
          r={38}
          skin="royal-100"
          hat="cop"
          eyes="shades"
          mouth="flat"
          body={{ t: 'blue-900', shade: 'neutral-900', w: 2.8, h: 2.6, collar: 'shirt', tie: 'blue-900' }}
          front={
            <g>
              <Poly t="blue-700" p={[[-48, 72], [44, 66], [46, 86], [-46, 92]]} />
              <Poly t="blue-900" o={0.6} p={[[0, 69], [44, 66], [46, 86], [0, 89]]} />
              <Poly t="gold-300" p={[[-22, 44], [-12, 40], [-8, 52], [-18, 56]]} />
            </g>
          }
        />
      </g>
    </Layer>
  );
}

const JURY: ReadonlyArray<Parameters<typeof Chibi>[0]> = [
  { x: 64, y: 316, r: 32, hood: 'chicken', body: { t: 'gold-300', shade: 'gold-500', collar: 'none' } },
  { x: 148, y: 320, r: 32, tilt: 4, hood: 'frog', body: { t: 'green-500', shade: 'green-700', collar: 'none' } },
  { x: 232, y: 318, r: 32, tilt: -5, hood: 'cat', body: { t: 'blue-700', shade: 'blue-900', collar: 'none' } },
  { x: 316, y: 320, r: 32, hair: { t: 'neutral-900', shade: 'neutral-700', style: 'spiky', n: 6 }, eyes: 'shades', mouth: 'grin', body: { t: 'royal-500', shade: 'royal-700' } },
];

const JURY_FRONT: ReadonlyArray<Parameters<typeof Chibi>[0]> = [
  { x: 70, y: 424, r: 34, tilt: -6, hair: { t: 'neutral-100', shade: 'neutral-300', style: 'spiky', n: 7 }, body: { t: 'royal-700', shade: 'royal-900' } },
  { x: 158, y: 428, r: 34, eyes: 'stars', hair: { t: 'gold-700', shade: 'gold-900', style: 'messy', n: 7 }, body: { t: 'teal-700', shade: 'teal-900' } },
  { x: 246, y: 426, r: 34, tilt: 4, eyes: 'swirl', mouth: 'grin', hair: { t: 'blue-900', shade: 'neutral-900', style: 'bob', n: 6 }, body: { t: 'gold-500', shade: 'gold-700' } },
  { x: 334, y: 430, r: 34, hat: 'pizza', hair: { t: 'neutral-900', shade: 'neutral-700', style: 'spiky', n: 5 }, body: { t: 'royal-500', shade: 'royal-700' } },
];

function Railing({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const posts = Array.from({ length: Math.floor(w / 34) }, (_, i) => x + 18 + i * 34);
  return (
    <g>
      <Block x={x} y={y} w={w} h={h} lit="gold-700" shade="gold-900" lip="gold-500" lipH={10} />
      {posts.map((px) => (
        <Poly key={px} t="gold-900" o={0.55} p={[[px, y + 10], [px + 12, y + 10], [px + 12, y + h - 8], [px, y + h - 8]]} />
      ))}
      <Poly t="gold-500" o={0.35} p={[[x, y + h - 10], [x + w, y + h - 10], [x + w, y + h - 4], [x, y + h - 4]]} />
    </g>
  );
}

function JuryBox() {
  return (
    <Layer depth={0.5} order={4} className={styles.layer}>
      <g className={styles.drop3}>
        {JURY.map((j) => (
          <Chibi key={j.x} {...j} />
        ))}
        <Sparks x={360} y={262} s={0.8} />
        <Railing x={14} y={364} w={372} h={60} />
        {JURY_FRONT.map((j) => (
          <Chibi key={j.x} {...j} />
        ))}
        <Sparks x={18} y={372} s={0.7} flip />
        <Railing x={4} y={476} w={420} h={96} />
      </g>
    </Layer>
  );
}

function Stairs() {
  const steps = [0, 1, 2, 3, 4];
  return (
    <Layer depth={0.56} order={5} className={styles.layer}>
      <g className={styles.drop2}>
        {steps.map((i) => {
          const y = 548 + i * 24;
          const inset = 30 - i * 6;
          return (
            <g key={i}>
              <Poly t="gold-500" p={[[440 + inset, y], [690 - inset, y], [690 - inset, y + 24], [440 + inset, y + 24]]} />
              <Poly t="gold-700" p={[[440 + inset, y + 14], [690 - inset, y + 14], [690 - inset, y + 24], [440 + inset, y + 24]]} />
              <Poly t="royal-700" p={[[520, y], [610, y], [612, y + 24], [518, y + 24]]} />
              <Poly t="royal-900" o={0.7} p={[[518, y + 14], [612, y + 14], [612, y + 24], [518, y + 24]]} />
            </g>
          );
        })}
        {/* brass lamp on its post */}
        <Poly t="gold-900" p={[[668, 480], [676, 480], [678, 560], [666, 560]]} />
        <Poly t="gold-300" p={[[656, 452], [688, 452], [684, 482], [660, 482]]} />
        <Poly t="gold-100" p={[[662, 458], [682, 458], [680, 476], [664, 476]]} />
        <Poly t="gold-700" p={[[652, 444], [692, 444], [672, 430]]} />
      </g>
    </Layer>
  );
}

function Desk({ x, w, y = 650 }: { x: number; w: number; y?: number }) {
  return (
    <g>
      <Block x={x} y={y} w={w} h={BOTTOM - y} lit="gold-700" shade="gold-900" lip="gold-500" lipH={14} />
      <Poly t="gold-500" p={[[x + w / 2 - 40, y + 4], [x + w / 2 + 40, y + 4], [x + w / 2 + 40, y + 96], [x + w / 2, y + 116], [x + w / 2 - 40, y + 96]]} />
      <Poly t="royal-700" p={[[x + w / 2 - 34, y + 8], [x + w / 2 + 34, y + 8], [x + w / 2 + 34, y + 92], [x + w / 2, y + 108], [x + w / 2 - 34, y + 92]]} />
      <Poly t="royal-900" o={0.7} p={[[x + w / 2, y + 8], [x + w / 2 + 34, y + 8], [x + w / 2 + 34, y + 92], [x + w / 2, y + 108]]} />
      <Scales x={x + w / 2} y={y + 56} s={0.95} />
    </g>
  );
}

function Lawyers() {
  return (
    <Layer depth={0.74} order={6} className={styles.layer}>
      {/* prosecution, left: pointing straight at the defence */}
      <g className={styles.drop3}>
        <Chibi
          x={226}
          y={560}
          r={48}
          tilt={-6}
          hair={{ t: 'royal-500', shade: 'royal-700', style: 'bob', n: 8 }}
          eyes="happy"
          mouth="laugh"
          body={{ t: 'royal-700', shade: 'royal-900', w: 2.6, h: 1.6 }}
          front={
            <g>
              <Poly t="royal-700" p={[[40, 52], [58, 74], [132, 28], [122, 12]]} />
              <Poly t="royal-900" o={0.6} p={[[50, 64], [58, 74], [132, 28], [128, 20]]} />
              <Poly t="royal-100" p={[[120, 8], [148, 4], [168, 0], [170, 8], [150, 12], [140, 28], [124, 30]]} />
              <Scales x={-22} y={78} s={0.38} />
            </g>
          }
        />
        {/* sunglasses pushed up into the hair */}
        <g transform="translate(226 560) rotate(-6)">
          <Poly t="neutral-900" p={[[-36, -58], [36, -58], [32, -44], [4, -46], [0, -52], [-4, -46], [-32, -44]]} />
        </g>
        <Sparks x={170} y={470} s={0.9} flip />
        <Desk x={96} w={300} />
        {/* desk props: a paper stack, a little gavel, a mug */}
        <Poly t="neutral-100" p={[[150, 626], [212, 620], [216, 636], [152, 640]]} />
        <Poly t="teal-700" p={[[300, 618], [354, 616], [354, 634], [300, 636]]} />
        <Poly t="neutral-100" p={[[110, 612], [132, 612], [130, 640], [112, 640]]} />
        <Poly t="neutral-300" p={[[122, 612], [132, 612], [130, 640], [122, 640]]} />
      </g>
      {/* defence, right: shrugging, delighted, guilty */}
      <g className={styles.drop3}>
        <Chibi
          x={812}
          y={572}
          r={46}
          tilt={5}
          hair={{ t: 'gold-900', shade: 'neutral-900', style: 'messy', n: 9 }}
          eyes="happy"
          mouth="laugh"
          body={{ t: 'blue-900', shade: 'neutral-900', w: 2.6, h: 1.6 }}
          front={
            <g>
              <Poly t="blue-900" p={[[-52, 52], [-40, 70], [-104, 40], [-96, 26]]} />
              <Poly t="royal-100" p={ring(-108, 30, 14, 10, 7)} />
              <Poly t="blue-900" p={[[52, 52], [40, 70], [104, 40], [96, 26]]} />
              <Poly t="royal-100" p={ring(108, 30, 14, 10, 7)} />
            </g>
          }
        />
        {/* a sticking plaster on the cheek */}
        <g transform="translate(812 572) rotate(5)">
          <Poly t="neutral-100" p={[[22, 6], [40, 0], [44, 10], [26, 16]]} />
        </g>
        <Sparks x={860} y={480} s={0.8} />
        <Desk x={680} w={270} y={660} />
        <Poly t="neutral-100" p={[[720, 640], [776, 636], [780, 652], [722, 654]]} />
        <Poly t="neutral-300" p={[[750, 638], [776, 636], [780, 652], [752, 653]]} />
      </g>
    </Layer>
  );
}

function Folder({ x, y, rot, t, shade, letter }: { x: number; y: number; rot: number; t: Swatch; shade: Swatch; letter: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <Poly t={shade} p={[[-46, -58], [46, -58], [46, 58], [-46, 58]]} />
      <Poly t={t} p={[[-42, -62], [50, -62], [50, 54], [-42, 54]]} />
      <Poly t={shade} o={0.5} p={[[14, -62], [50, -62], [50, 54], [6, 54]]} />
      <Poly t="neutral-100" p={[[-30, -48], [38, -50], [38, -6], [-30, -4]]} />
      <Poly t="neutral-300" o={0.6} p={[[18, -50], [38, -50], [38, -6], [16, -5]]} />
      <text x={4} y={-31} className={styles.exhibitWord}>
        EXHIBIT
      </text>
      <text x={4} y={-9} className={styles.exhibitLetter}>
        {letter}
      </text>
      <Poly t="gold-300" p={[[18, 26], [32, 26], [32, 40], [18, 40]]} />
    </g>
  );
}

function Shiba() {
  // the star witness, sealed in a glass display cube
  return (
    <g>
      <Block x={500} y={596} w={80} h={110} lit="gold-500" shade="gold-700" lip="gold-300" lipH={8} />
      <g transform="translate(0 -60)">
      <g transform="translate(540 612)">
        <Poly t="royal-300" p={[[-30, 36], [30, 36], [24, 4], [-24, 4]]} />
        <Poly t="neutral-100" p={[[-12, 36], [12, 36], [8, 12], [-8, 12]]} />
        <Poly t="royal-300" p={ring(0, -6, 30, 25, 10)} />
        <Poly t="gold-500" o={0.7} p={[[6, -30], [28, -16], [30, 4], [10, 6]]} />
        <Poly t="royal-300" p={[[-28, -14], [-24, -40], [-8, -26]]} />
        <Poly t="royal-300" p={[[28, -14], [24, -40], [8, -26]]} />
        <Poly t="neutral-100" p={[[-22, -18], [-21, -32], [-12, -24]]} />
        <Poly t="neutral-100" p={[[22, -18], [21, -32], [12, -24]]} />
        <Poly t="neutral-100" p={[[-16, 2], [0, -6], [16, 2], [10, 14], [-10, 14]]} />
        <Poly t="neutral-900" p={[[-4, 0], [4, 0], [0, 5]]} />
        <Line t="neutral-900" w={2.4} d="M-16 -10 L-6 -8 M6 -8 L16 -10" />
        <Line t="neutral-900" w={1.8} d="M-6 8 Q0 12 6 8" />
      </g>
      {/* glass: translucent faces with paper-white edges */}
      <Poly t="blue-100" o={0.4} p={[[488, 560], [592, 560], [592, 652], [488, 652]]} />
      <Poly t="blue-300" o={0.35} p={[[488, 560], [508, 540], [612, 540], [592, 560]]} />
      <Poly t="blue-300" o={0.3} p={[[592, 560], [612, 540], [612, 632], [592, 652]]} />
      <Line t="neutral-100" w={2.5} o={0.9} d="M488 560 H592 V652 H488 Z M488 560 L508 540 H612 L592 560 M612 540 V632 L592 652" />
      <Poly t="neutral-100" o={0.55} p={[[498, 572], [512, 572], [500, 620], [494, 620]]} />
      </g>
    </g>
  );
}

function Exhibits() {
  return (
    <Layer depth={0.86} order={7} className={styles.layer}>
      <g className={styles.drop3}>
        <Shiba />
        <Sparks x={604} y={520} s={0.7} />
        {/* evidence table */}
        <Block x={392} y={688} w={296} h={BOTTOM - 688} lit="gold-700" shade="gold-900" lip="gold-500" lipH={14} />
        <Folder x={448} y={668} rot={-9} t="royal-700" shade="royal-900" letter="A" />
        <Folder x={542} y={672} rot={-1} t="gold-300" shade="gold-500" letter="B" />
        <Folder x={634} y={668} rot={8} t="blue-700" shade="blue-900" letter="C" />
      </g>
    </Layer>
  );
}

function Foreground() {
  return (
    <Layer depth={1} order={8} className={styles.layer}>
      <g className={styles.drop4}>
        {/* origami plant in a faceted pot */}
        <g transform="translate(46 712)">
          <Poly t="green-700" p={[[0, 0], [-46, -60], [-6, -34]]} />
          <Poly t="green-500" p={[[0, 0], [-6, -34], [-46, -60], [-20, -12]]} />
          <Poly t="green-500" p={[[4, -4], [20, -92], [30, -20]]} />
          <Poly t="green-700" p={[[20, -92], [30, -20], [12, -30]]} />
          <Poly t="green-500" p={[[10, 0], [72, -64], [46, -6]]} />
          <Poly t="green-700" p={[[72, -64], [46, -6], [40, -24]]} />
          <Poly t="green-300" p={[[0, -8], [-30, -98], [10, -40]]} />
          <Poly t="neutral-100" p={[[-24, 0], [52, 0], [42, 70], [-14, 70]]} />
          <Poly t="neutral-300" p={[[14, 0], [52, 0], [42, 70], [20, 70]]} />
          <Poly t="neutral-500" o={0.5} p={[[-24, 0], [52, 0], [50, 8], [-22, 8]]} />
        </g>
        {/* globe on a brass stand */}
        <g transform="translate(940 722)">
          <Poly t="gold-700" p={[[-30, 66], [30, 66], [22, 54], [-22, 54]]} />
          <Poly t="gold-500" p={[[-4, 54], [4, 54], [4, 30], [-4, 30]]} />
          <Line t="gold-500" w={5} d="M-36 -10 A38 38 0 0 0 30 26" />
          <Poly t="blue-500" p={ring(0, -6, 32, 32, 10)} />
          <Poly t="blue-700" o={0.6} p={[[4, -38], [30, -18], [32, 6], [14, 24], [8, -6]]} />
          <Poly t="green-500" p={[[-22, -20], [-6, -28], [2, -14], [-10, 0], [-24, -4]]} />
          <Poly t="green-500" p={[[8, 4], [20, -2], [24, 12], [12, 20]]} />
          <Poly t="gold-300" p={[[-14, -36], [-6, -40], [-4, -30]]} />
        </g>
        {/* red carpet with a gold border */}
        <Poly t="gold-300" p={[[290, BOTTOM], [372, 752], [708, 752], [790, BOTTOM]]} />
        <Poly t="royal-700" p={[[314, BOTTOM], [384, 758], [696, 758], [766, BOTTOM]]} />
        <Poly t="royal-900" o={0.5} p={[[540, 758], [696, 758], [766, BOTTOM], [540, BOTTOM]]} />
      </g>
    </Layer>
  );
}

/** The scene SVG. Purely decorative: the landing names it for screen readers once. */
export function CourtroomScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 ${TOP} ${W} ${BOTTOM - TOP}`}
      className={className}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="A papercraft courtroom in full uproar: a bearded judge in sunglasses raises a gold gavel, a jury in chicken, frog, cat and pizza costumes laughs from the box, two lawyers trade blows at their desks, a bailiff folds his arms, and a Shiba sits sealed in a glass cube beside Exhibits A, B and C."
      focusable="false"
    >
      <Wall />
      <Backdrop />
      <Throne />
      <Bench />
      <JuryBox />
      <Stairs />
      <Lawyers />
      <Exhibits />
      <Foreground />
    </svg>
  );
}
