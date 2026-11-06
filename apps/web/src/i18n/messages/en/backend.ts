/** English copy for the `backend` namespace: the shared court server (docs/BACKEND.md). */
export const backend = {
  // ── deploy configuration (Settings → Connections)
  'config.invalid': 'VITE_BACKEND_URL is “{value}”, which is not an http(s) address. Versus and Grand Jury stay on this device.',
  'config.idkit':
    'World ID proofs are checked by the court server. The signing key stays there. This browser only receives the result.',

  // ── connecting, and when it fails
  'gate.connecting.title': 'Connecting to the court server…',
  'gate.connecting.body': 'This build plays Versus and Grand Jury on a court shared across devices.',
  'gate.error.title': 'The court server is not answering',
  'gate.error.body':
    'Versus and Grand Jury on this build run on a shared court server ({host}). {reason} Try again, or play the local demo, which keeps every case on this device only.',
  'gate.retry': 'Try again',
  'gate.local': 'Play the local demo instead',
  'gate.newSession.title': 'Fresh seat on the court server',
  'gate.newSession.body': 'The court server did not recognise this device (it may have been reset), so it gave you a new session. Cases from before are not on this server.',
  'gate.newSession.dismiss': 'Got it',

  // ── local demo chosen while a server is configured
  'local.title': 'Local demo',
  'local.body': 'Cases you start now live on this device only. This build also has a shared court server, so invites can work across devices.',
  'local.useServer': 'Use the shared court',

  // ── live status
  'status.live': 'Shared court · live',
  'status.connecting': 'Shared court · connecting',
  'status.polling': 'Shared court · checking every few seconds',
  'status.offline': 'Shared court · offline',
  'status.offline.title': 'Lost the court server',
  'status.offline.body': 'Reconnecting. Until it is back, actions fail instead of being lost, and this device keeps what it has.',

  // ── errors from the server, by code
  'error.unreachable': 'Could not reach the court server. Nothing was sent.',
  'error.timeout': 'The court server took too long to answer. Check the case before trying again: it may have gone through.',
  'error.rateLimited': 'Too many requests from this device. Wait {seconds} s and try again.',
  'error.unauthorized': 'The court server no longer knows this device. Reload the page to get a fresh session.',
  'error.full': 'The court server is full right now. Try again later, or play the local demo.',
  'error.disabled': 'This court server has that demo control switched off.',
  'error.server': 'The court server hit a problem. Nothing was recorded.',
  'error.badResponse': 'The court server sent an answer this app cannot read. Is it the same version?',

  // ── people on this device
  'persona.name': 'Device person {n}',

  // ── Versus invites over the server
  'invite.loading': 'Looking up this invite on the court server…',
  'invite.error.title': 'Could not open this invite',

  // ── Grand Jury on the server
  'gj.ribbon': 'Shared court on {host}: everyone sees this docket, and jurors are real people on their own devices. The summoning crowd is still simulated. Test money only.',

  // ── Settings → Connections
  'settings.title': 'Court server',
  'settings.shared': 'Shared',
  'settings.local': 'This device only',
  'settings.sharedBody': 'Versus and Grand Jury run on {host}: invites, juries and verdicts work across devices. Test money only.',
  'settings.localChosen': 'This device chose the local demo. Cases stay in this browser.',
  'settings.noneBody': 'No court server is configured, so every Versus and Grand Jury court lives in this browser. Set VITE_BACKEND_URL to share them across devices.',
  'settings.url': 'Address',
} as const;
