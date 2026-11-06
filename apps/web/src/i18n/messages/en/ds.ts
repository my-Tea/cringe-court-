/** English copy for the `ds` namespace. Keys are flat; dots only group related copy. */
export const ds = {
  // Amount
  'amount.unit': 'USDC',
  'amount.plus': 'plus',
  'amount.minus': 'minus',

  // Badge
  'testnet.label': 'Testnet',
  'testnet.title': 'Arc testnet: test USDC only, no real money',
  'testnet.explainer': ': Arc testnet, test USDC only, no real money',

  // Countdown
  'countdown.ended': 'Ended',
  'countdown.aria.ended': '{label}: ended, deadline {deadline}',
  'countdown.aria.left': '{label}: {remaining} left, deadline {deadline}',
  'countdown.deadline': 'Deadline {deadline}. Fixed for this case.',
  'countdown.dayHour': '{days}d {hours}h',
  'countdown.zeroSeconds': '0 seconds',

  // DialogueBox
  'dialogue.skip': 'Skip',

  // Field / PaperField
  'field.optional': '(optional)',
  'field.counter.characters': 'characters',
  'field.counter.over': ', {count} over the limit',
  'field.password.hide': 'Hide password',
  'field.password.show': 'Show password',

  // PhaseStepper
  'stepper.label': 'Trial progress',
  'stepper.done': '(done)',

  // Receipt
  'receipt.title': 'Settlement receipt',
  'receipt.net': 'Net',
  'receipt.explorer': 'View on Arc testnet explorer',
  'receipt.newTab': '(opens in a new tab)',

  // States
  'state.loading': 'One moment…',
  'state.retry': 'Try again',
  'state.details': 'Technical details',

  // Spinner / Portrait
  'spinner.label': 'Loading',
  'portrait.anonymous': 'Anonymous defendant',

  // ImpactText
  'impact.objection': 'Objection!',
  'impact.cook': 'Let bro cook',
  'impact.order': 'Order!',
  'impact.counter': 'Counter!',

  // Toast
  'toast.region': 'Notifications',
  'toast.dismiss': 'Dismiss notification',
} as const;
