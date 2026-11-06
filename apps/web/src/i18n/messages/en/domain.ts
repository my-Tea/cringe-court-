/** Labels for domain enums and ids that live in packages/* (English tables stay there; the web layer maps id -> key in @/i18n/domain). */
export const domain = {
  caseNumber: 'CASE #{n}',
  'usdc.short': '{amount} USDC',
  'side.label': 'SIDE {side}',
  'side.nick': '{label} “{nick}”',
  'side.nickPlain': '{label} {nick}',
  'ballot.guilty': 'GUILTY',
  'ballot.notCooked': 'NOT COOKED',
  'ballot.sideA': 'SIDE A',
  'ballot.sideB': 'SIDE B',
  'verdict.none': 'NO VERDICT',
  'ballot.for': 'FOR',
  'ballot.against': 'AGAINST',
  // ── redaction summary (describeHits) ──
  'hits.none': 'Nothing needed removing.',
  'hits.removed': 'Removed {list}.',
  'hits.and': '{head} and {last}',
  'hits.email': '{count, plural, one {# email address} other {# email addresses}}',
  'hits.url': '{count, plural, one {# link} other {# links}}',
  'hits.phone': '{count, plural, one {# phone number} other {# phone numbers}}',
  'hits.wallet': '{count, plural, one {# wallet address} other {# wallet addresses}}',
  'hits.ens': '{count, plural, one {# ENS name} other {# ENS names}}',
  'hits.handle': '{count, plural, one {# social handle} other {# social handles}}',
  'hits.name': '{count, plural, one {# first name} other {# first names}}',
  'hits.number': '{count, plural, one {# long number} other {# long numbers}}',

  // ── category ──
  'category.crypto-crimes': 'Crypto Crimes',
  'category.dating-crimes': 'Dating Crimes',
  'category.npc-behavior': 'NPC Behavior',
  'category.internet-crimes': 'Internet Crimes',

  // ── cancel ──
  'cancel.withdrawn': 'Withdrawn by the filer',
  'cancel.consent-declined': 'The other side declined',
  'cancel.consent-missed': 'The other side did not answer in time',
  'cancel.moderation-rejected': 'Did not pass the safety review',
  'cancel.ai-unfair': 'The AI could not prepare a fair case',
  'cancel.ai-failed': 'The AI could not prepare the case',
  'cancel.funding-missed': 'Funding did not arrive in time',
  'cancel.jury-unfilled': 'Not enough jurors took a seat',
  'cancel.protective': 'Protective cancellation (our fault, not yours)',

  // ── stage ──
  'stage.filing': 'Filing',
  'stage.evidence': 'Evidence',
  'stage.counsel': 'Prosecution & Defense',
  'stage.jury': 'The Jury',
  'stage.verdict': 'Verdict',
  'stage.appeal': 'Appeal',
  'stage.share': 'Case Closed',
  'stage.closed': 'Dismissed',

  // ── character ──
  'character.judge': 'Judge Gavel.exe',
  'character.prosecutor': 'Miss Ratio',
  'character.defense': 'Counsel Chaos',
  'character.bailiff': 'Bailiff',
  'character.clerk': 'Clerk',
  'character.juror': 'Juror',
  'character.creator': 'Creator',
  'character.side-a': 'Side A',
  'character.side-b': 'Side B',
  'character.ai-narrator': 'AI Narrator',
  'character.player': 'You',

  // ── soloCategory ──
  'soloCategory.crypto-crimes.blurb': 'Aped in, held the bag, called the top in the group chat.',
  'soloCategory.crypto-crimes.example':
    'I put my rent money into a coin called $BROCCOLI because a frog avatar said "trust". It went down 94 % in one hour. I told my roommate it was "a long-term position".',
  'soloCategory.crypto-crimes.exampleTitle': 'Bought the top, again',
  'soloCategory.dating-crimes.blurb': 'Ghosting, double-texting, the 2 a.m. "u up".',
  'soloCategory.dating-crimes.example':
    'We had a great brunch. I said "let\'s do this again!" and then never texted back for three weeks because I could not decide which emoji to use.',
  'soloCategory.dating-crimes.exampleTitle': 'Ghosted after brunch',
  'soloCategory.npc-behavior.blurb': 'Reply-all, slow walking, "you too" to the waiter.',
  'soloCategory.npc-behavior.example':
    'I replied-all "lol same" to a 3,000-person email about the fire drill. Then I replied-all again to apologise. Then once more to say sorry for the apology.',
  'soloCategory.npc-behavior.exampleTitle': 'Reply-all to the whole company',
  'soloCategory.internet-crimes.blurb': 'Hot takes, ratio attempts, posting through it.',
  'soloCategory.internet-crimes.example':
    'I posted a hot take that pineapple is a vegetable, got ratioed by a cooking account, and kept posting "source?" under every reply for six hours.',
  'soloCategory.internet-crimes.exampleTitle': 'Posted through it',

  // ── soloRedaction ──
  'soloRedaction.email': 'Email address',
  'soloRedaction.url': 'Link',
  'soloRedaction.wallet': 'Wallet address',
  'soloRedaction.ens': 'ENS name',
  'soloRedaction.phone': 'Phone number',
  'soloRedaction.handle': 'Social handle',
  'soloRedaction.name': 'Name you asked to hide',

  // ── segment ──
  'segment.call-to-order': 'Call to order',
  'segment.opening': 'Opening statements',
  'segment.exhibit': 'Evidence',
  'segment.rebuttal': 'Rebuttals',
  'segment.closing': 'Closing arguments',
  'segment.jury-out': 'The jury is out',
  'segment.sentence': 'Sentence',

  // ── routeOut ──
  'routeOut.safety.title': 'This sounds bigger than a comedy court',
  'routeOut.safety.body':
    'If someone has hurt or threatened you, CringeCourt is the wrong place for it. Please talk to someone you trust or a local support line. Nothing you typed has been saved or shared.',
  'routeOut.money.title': 'Money disputes stay out of court here',
  'routeOut.money.body':
    'Versus is for bragging rights only: nobody wins the other side’s money, and real debts deserve a real conversation, not a jury of strangers. Nothing you typed has been saved or shared.',
  'routeOut.custody.title': 'Family matters are routed out',
  'routeOut.custody.body': 'Custody and family-court topics are never put in front of a public jury. Nothing you typed has been saved or shared.',
  'routeOut.self-harm.title': 'You matter more than this argument',
  'routeOut.self-harm.body':
    'If you are thinking about hurting yourself, please reach out to someone now: a friend, family member or your local crisis line. Nothing you typed has been saved or shared.',

  // ── outcome ──
  'outcome.verdict': 'A verdict (all three jurors finish)',
  'outcome.verdict-with-no-show': 'A verdict, one juror misses a deadline',
  'outcome.no-verdict': 'NO VERDICT (fewer than 2 matching votes)',
  'outcome.consent-missed': 'Side B never answers the invite',
  'outcome.withdrawn': 'Either side withdraws before paying',
  'outcome.funding-missed': 'One side pays, the other does not by the deadline',
  'outcome.jury-unfilled': 'Not enough jurors take a seat in time',

  // ── versusStep ──
  'versusStep.invite': 'Invite',
  'versusStep.briefs': 'Briefs',
  'versusStep.counsel': 'Counsel',
  'versusStep.funding': 'Funding',
  'versusStep.jury': 'Jury',
  'versusStep.verdict': 'Verdict',

  // ── pricing ──
  'pricing.hackathon.name': 'Hackathon docket',
  'pricing.launch.name': 'Sponsored Docket',

  // ── screening ──
  'screening.title': 'Juror Screening',
  'screening.intro':
    'Before you take a seat, the court checks that you are a real, unique person. We never learn who you are, and nothing about your real identity is shown to anyone.',
  'screening.honesty': 'This check confirms you are one human. It does not prove you are impartial. That part is on you, the bailiff, and a lot of random draws.',
  'screening.success': 'Screening passed. The bench has a seat with your name on it. Well, a pseudonym.',
  'screening.not_verified': 'The court could not confirm you are human this time. No harm done, you can try again.',
  'screening.ineligible_level': 'A paid seat needs Proof of Human. You can still watch and vote.',
  'screening.is_party': 'You cannot judge your own case.',
  'screening.already_seated': 'You already hold a seat on this case. One person, one ballot.',
  'screening.cancelled': 'Screening cancelled. Your seat stays open whenever you are ready.',
  'screening.expired': 'That screening request timed out. Start a fresh one.',
  'screening.already_verified': 'This person has already been screened for this court. One human, one identity.',
  'screening.invalid_proof': 'The proof did not check out, so no seat was granted.',
  'screening.wrong_action': 'That proof was made for a different court session. Please start again from here.',
  'screening.network': 'The screening desk is unreachable right now. Try again in a moment.',
  'screening.malformed': 'Something odd came back from the screening. Please try again.',

  // ── error ──
  'error.ModeDisabled': 'This court is closed for now.',
  'error.PassDisabled': "The 0G Compute Pass isn't available yet. The standard price covers your AI.",
  'error.PartyNotVerified': "Verify you're a human first, so you can be kept off your own jury.",
  'error.SamePerson': "You can't take yourself to court.",
  'error.NotCounterparty': 'This invite is for someone else.',
  'error.NotCreator': 'Only the person who opened this case can do that.',
  'error.DeadlinePassed': 'That deadline has passed.',
  'error.NotExpired': "That deadline hasn't passed yet.",
  'error.BelowMinContribution': 'Contributions start at 0.10 test USDC.',
  'error.SponsorRequired': 'Public cases need a sponsor before they can be published.',
  'error.MarketingCapReached': 'The marketing budget for unsponsored public cases is used up.',
  'error.OfferExpired': 'This seat offer timed out. Wait for the next one; declining never costs you anything.',
  'error.InvalidSeatOffer': "This seat offer isn't valid for you.",
  'error.AlreadySeated': 'You already hold a seat on this jury.',
  'error.PartyCannotServe': "People in a case can't sit on its jury.",
  'error.JurorNotVerified': 'Juror Screening needed: verify with World ID to take a paid seat.',
  'error.HumanAlreadySeated': "One seat per human. You're already on this jury with another wallet.",
  'error.NotJuror': 'Only seated jurors can vote on this case.',
  'error.CommitClosed': 'The secret ballot window has closed.',
  'error.RevealNotOpen': "It isn't time to open your scroll.",
  'error.NoCommitment': "There's no sealed ballot from you to open.",
  'error.AlreadyRevealed': 'Your scroll is already open.',
  'error.InvalidChoice': 'Pick one of the two sides.',
  'error.CommitmentMismatch': "That scroll doesn't match your sealed ballot. Check you're using the saved scroll for this case.",
  'error.NotFinalizable': "The court can't be settled until every scroll is open or the reveal deadline passes.",
  'error.InsufficientReserve': "The platform's incident reserve is too low to open this court.",
  'error.NotRefundable': "This case isn't refundable.",
  'error.NothingToClaim': 'Nothing to collect.',

  // ── npc ──
  'npc.touch-grass-tina.name': 'Touch-Grass Tina',
  'npc.touch-grass-tina.bio': 'Has been offline since 2019. Judges everyone.',
  'npc.touch-grass-tina.says0': 'Bro is cooked. Log off.',
  'npc.touch-grass-tina.says1': 'Honestly? Relatable. Not cooked.',
  'npc.chronically-online-chad.name': 'Chronically Online Chad',
  'npc.chronically-online-chad.bio': 'Has seen worse before breakfast. Usually forgives.',
  'npc.chronically-online-chad.says0': 'Even I can’t defend this. Guilty.',
  'npc.chronically-online-chad.says1': 'Let bro cook. I’ve done worse today.',
  'npc.grandma-wifi.name': 'Grandma Wi-Fi',
  'npc.grandma-wifi.bio': 'Thinks the cloud is weather. Votes on vibes.',
  'npc.grandma-wifi.says0': 'In my day we called this “a disgrace”.',
  'npc.grandma-wifi.says1': 'Oh, the poor dear. Not cooked.',
} as const;
