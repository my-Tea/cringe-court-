import type { ShareCardModel, ShareTheme } from '../share';

export const theme: ShareTheme = {
  paper: '#fff8e7',
  paperDeep: '#f0e2c0',
  ink: '#1b1b1b',
  inkMuted: '#555555',
  frame: '#c9a24b',
  frameDark: '#6b4e16',
  accent: '#b3261e',
  sideA: '#1d4ed8',
  sideB: '#15803d',
  mistrial: '#7e22ce',
  onStamp: '#ffffff',
};

export const ShareCardModelFixture: ShareCardModel = {
  caseLabel: 'CASE #0007',
  title: 'Pizza & <Pineapple>',
  category: 'Food Crimes',
  outcome: 'b',
  headline: 'SIDE B WINS',
  winner: 'SIDE B',
  loser: 'SIDE A',
  tally: [1, 2],
  completed: 3,
  appointed: 3,
  quote: { speaker: 'Agent B', text: 'Counter! The prosecution bench is cooking with no ingredients.' },
  sentence: 'Admit it in the group chat.',
  fingerprint: 'abcdef0123',
};
