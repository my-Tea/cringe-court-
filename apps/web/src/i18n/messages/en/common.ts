/**
 * Words shared across every area. Workers on a single area add their copy to
 * that area's namespace; only add here when three or more areas need it.
 */
export const common = {
  'app.name': 'CringeCourt',
  'app.tagline': 'Your Honor, Bro Is Cooked.',
  'action.close': 'Close',
  'action.cancel': 'Cancel',
  'action.back': 'Back',
  'action.retry': 'Try again',
  'action.reload': 'Reload',
  'action.copied': 'Copied',
  'action.share': 'Share',
  'action.download': 'Download',
  'action.skip': 'Skip',
  'action.backToCourthouse': 'Back to the courthouse',
  'unit.usdc': '{amount} test USDC',
  'unit.seconds': '{count, plural, one {# second} other {# seconds}}',
  'unit.minutes': '{count, plural, one {# minute} other {# minutes}}',
  'unit.hours': '{count, plural, one {# hour} other {# hours}}',
  'unit.days': '{count, plural, one {# day} other {# days}}',
  'mode.solo': 'Solo Court',
  'mode.versus': 'Versus Court',
  'mode.grandJury': 'Grand Jury',
  'role.juror': 'Juror',
  'role.sideA': 'Side A',
  'role.sideB': 'Side B',
  'total': 'Total',
} as const;
