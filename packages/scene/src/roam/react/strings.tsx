// i18n-ignore: this table is the package's English default copy; hosts translate via RoamStrings.
import { createContext, useContext, type ReactNode } from 'react';
import type { ExhibitCard } from '../dialogue';
import type { QualityLevel } from '../quality';
import type { BeatId, ZoneId } from '../types';

/** Wraps a key cap label (`W`, `Esc`, ...) in the HUD's key styling. Handed to the row builders below. */
export type KeyCap = (label: string) => ReactNode;
/** A line of the controls legend, built around key caps so translators control the word order. */
export type LegendRow = (key: KeyCap) => ReactNode;

/** Every piece of copy the roam HUD draws. Hosts translate it by passing `strings` to <RoamCourtroom>. */
export interface RoamStrings {
  beatLabels: Readonly<Record<BeatId, string>>;
  zoneLabels: Readonly<Record<ZoneId, string>>;
  /** Zone label while the player is outside every zone. */
  zoneFallback: string;

  /** Default accessible name for the 3D view and its role description. */
  roomLabel: string;
  roomRoleDescription: string;

  controlsTitle: string;
  controlsShow: string;
  controlsHide: string;
  legendTouchRows: readonly LegendRow[];
  legendKeyboardRows: readonly LegendRow[];

  pause: string;
  skipToMenuView: string;
  /** The interact key cap shown in the focus prompt on desktop. */
  keyInteract: string;
  continueTouch: string;
  continueKey: string;
  beatChip: (label: string, cinematic: boolean) => string;
  skipBeat: string;

  exhibitStamp: string;
  exhibitPutBack: string;
  /** Localises an exhibit card; return the card unchanged to keep its own text. */
  exhibitCard: (card: ExhibitCard) => Pick<ExhibitCard, 'title' | 'subtitle' | 'body'>;

  pauseTitle: string;
  pauseResume: string;
  pauseBackToLobby: string;
  pauseGraphicsQuality: string;
  qualityLevel: (level: QualityLevel) => string;
  /** Note shown after auto quality steps down. */
  autoQualityNote: (level: QualityLevel) => string;
  pauseChunkyPixels: string;
  pauseReduceMotion: string;

  captureTitle: string;
  captureMouse: string;
  captureKeyboard: LegendRow;
  captureClick: string;
  captureKeyboardOnly: string;

  touchPause: string;
  touchHop: string;
  touchInteract: string;
  /** Accessible name of the interact button while something is in focus. */
  touchInteractWith: (prompt: string) => string;
  touchDragHint: string;
}

const capitalise = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** The English copy. The only place English lives in this package's HUD. */
export const DEFAULT_ROAM_STRINGS: RoamStrings = {
  beatLabels: {
    'all-rise': 'All rise',
    opening: 'Opening statements',
    'counsel-arguing': 'Counsel arguing',
    'jury-deliberating': 'Jury deliberating',
    verdict: 'The verdict',
  },
  zoneLabels: {
    lobby: 'Lobby',
    doorway: 'Courtroom doors',
    gallery: 'Public gallery',
    aisle: 'Centre aisle',
    well: 'Well of the court',
    dais: 'Before the bench',
    'defendant-table': "Defendant's table",
    'prosecution-table': 'Prosecution table',
    'witness-stand': 'Witness stand',
    'jury-box': 'Jury box',
  },
  zoneFallback: 'Courthouse',

  roomLabel: 'First-person courtroom. Walk with W A S D or the arrow keys, interact with E.',
  roomRoleDescription: 'first-person courtroom',

  controlsTitle: 'Controls',
  controlsShow: 'Controls',
  controlsHide: 'Hide controls',
  legendTouchRows: [
    () => 'Left thumb: drag to walk (push past the ring to run)',
    () => 'Right side: drag to look around',
    (k) => (
      <>
        {k('✋')} interact · {k('⤒')} hop · {k('II')} pause
      </>
    ),
  ],
  legendKeyboardRows: [
    (k) => (
      <>
        {k('W')}
        {k('A')}
        {k('S')}
        {k('D')} walk · {k('↑')}
        {k('↓')} walk
      </>
    ),
    (k) => (
      <>
        Mouse look (click the room) · {k('←')}
        {k('→')} turn
      </>
    ),
    (k) => (
      <>
        {k('R')}
        {k('F')} or {k('PgUp')}
        {k('PgDn')} look up / down
      </>
    ),
    (k) => (
      <>
        {k('Shift')} run · {k('Space')} hop
      </>
    ),
    (k) => (
      <>
        {k('E')} or {k('Enter')} interact / continue
      </>
    ),
    (k) => (
      <>
        {k('X')} skip a line · {k('Tab')} leave the room · {k('Esc')} pause
      </>
    ),
  ],

  pause: 'Pause',
  skipToMenuView: 'Skip to menu view',
  keyInteract: 'E',
  continueTouch: '▶ tap ✋ to continue',
  continueKey: '▶ E to continue',
  beatChip: (label, cinematic) => `● ${label}${cinematic ? ' · cinematic' : ''}`,
  skipBeat: 'Skip beat',

  exhibitStamp: 'ENTERED INTO EVIDENCE',
  exhibitPutBack: 'Put it back',
  exhibitCard: (card) => card,

  pauseTitle: 'Court in recess',
  pauseResume: 'Resume',
  pauseBackToLobby: 'Back to the lobby',
  pauseGraphicsQuality: 'Graphics quality',
  qualityLevel: capitalise,
  autoQualityNote: (level) => `Quality lowered to ${level} to keep the frame rate up.`,
  pauseChunkyPixels: 'Chunky pixels (low-res render)',
  pauseReduceMotion: 'Reduce motion (no head-bob or shake)',

  captureTitle: 'Step into the courtroom',
  captureMouse: 'Click to look around with the mouse. Esc gives the mouse back and pauses.',
  captureKeyboard: (k) => <>Keyboard only? Press any movement key: arrows walk and turn, {k('E')} interacts.</>,
  captureClick: 'Click to look around',
  captureKeyboardOnly: 'Use keyboard only',

  touchPause: 'Pause',
  touchHop: 'Hop',
  touchInteract: 'Interact',
  touchInteractWith: (prompt) => `Interact: ${prompt}`,
  touchDragHint: 'drag to walk',
};

const RoamStringsContext = createContext<RoamStrings>(DEFAULT_ROAM_STRINGS);

/** Fills any strings the host did not supply with the English defaults. */
export function resolveRoamStrings(strings?: Partial<RoamStrings>): RoamStrings {
  return strings ? { ...DEFAULT_ROAM_STRINGS, ...strings } : DEFAULT_ROAM_STRINGS;
}

export function RoamStringsProvider({ strings, children }: { strings: RoamStrings; children: ReactNode }) {
  return <RoamStringsContext.Provider value={strings}>{children}</RoamStringsContext.Provider>;
}

export function useRoamStrings(): RoamStrings {
  return useContext(RoamStringsContext);
}
