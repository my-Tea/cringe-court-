/**
 * The town's conversations.
 *
 * These are written to sound like the courtroom cast rather than generic RPG
 * villagers: the judge is still the judge, and the town knows it. Each tree is
 * short on purpose — a town of nine-line conversations reads better and is
 * cheaper to keep in the i18n catalogue than one of branching epics.
 *
 * Every NPC referenced here must exist on a map; `town.test.ts` enforces that
 * link in both directions, so an orphaned tree or a mute NPC fails the build.
 */
import type { DialogueTree } from '../dialogue';

export const TOWN_DIALOGUE: Readonly<Record<string, DialogueTree>> = {
  /* ── Town square ──────────────────────────────────────────────────────── */

  vera: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'vera',
        text: 'You walked all the way out here? The trial is that way, you know. Back through those steps.',
        choices: [
          { text: 'I wanted to see the town.', next: 'town' },
          { text: 'What is this place?', next: 'what' },
          { text: 'Just passing through.', next: 'bye' },
        ],
      },
      town: {
        speaker: 'vera',
        text: 'Then look properly. Fountain is older than the courthouse, the market never closes on time, and the archive has a door nobody has opened in nine years.',
        choices: [
          { text: 'Nobody has opened it?', next: 'archive' },
          { text: 'Thanks, Vera.', next: 'bye' },
        ],
      },
      archive: {
        speaker: 'vera',
        text: 'The Clerk says the lock is complicated. I say the Clerk lost the key and is embarrassed. Either way, ask her. She is in there all day.',
        next: 'bye',
      },
      what: {
        speaker: 'vera',
        text: 'CringeCourt. You stand in the box, they argue about you, and a jury of strangers decides whether you cooked. The rest of us live here.',
        choices: [
          { text: 'Does anyone ever win?', next: 'win' },
          { text: 'That is grim.', next: 'grim' },
        ],
      },
      win: {
        speaker: 'vera',
        text: 'Acquitted is a win. Not cooked is a win. Mistrial is a win for the lawyers and nobody else. You will learn the difference fast.',
        next: 'bye',
      },
      grim: {
        speaker: 'vera',
        text: 'It pays the rent. Do not tell the judge I said that.',
        next: 'bye',
      },
      bye: {
        speaker: 'vera',
        text: 'Mind the fountain on your way through. People throw things in it.',
      },
    },
  },

  gus: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'gus',
        text: 'ALL RISE. Sorry. Force of habit. I do it at the bakery too.',
        choices: [
          { text: 'You are the bailiff.', next: 'bailiff' },
          { text: 'Do you ever get a day off?', next: 'off' },
        ],
      },
      bailiff: {
        speaker: 'gus',
        text: 'Twenty-two years. I have called that room to order more times than I have called my own dog. He does not listen either.',
        choices: [
          { text: 'What is the judge like?', next: 'judge' },
          { text: 'Good luck, Gus.', next: 'bye' },
        ],
      },
      judge: {
        speaker: 'gus',
        text: 'Off the bench? He is fine. On the bench he wears the sunglasses and becomes a weather event. You will see.',
        next: 'bye',
      },
      off: {
        speaker: 'gus',
        text: 'Tuesdays. I sit by the fountain and do not call anybody to rise. It is the best day of the week.',
        next: 'bye',
      },
      bye: {
        speaker: 'gus',
        text: 'All rise. Sorry. Safe travels.',
      },
    },
  },

  mara: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'mara',
        text: 'You are the one on trial, are you not? I was in the gallery. You looked very calm. Nobody is ever that calm.',
        choices: [
          { text: 'I was terrified.', next: 'honest' },
          { text: 'Were you watching me?', next: 'watching' },
        ],
      },
      honest: {
        speaker: 'mara',
        text: 'Good. Calm people are the ones who turn out to have done it. Terrified people just want to go home.',
        choices: [
          { text: 'Do you think I did it?', next: 'verdict' },
          { text: 'That is comforting. Sort of.', next: 'bye' },
        ],
      },
      verdict: {
        speaker: 'mara',
        text: 'I am not on the jury. But between us, the evidence was thin and the prosecution was louder than it was right. You will be fine.',
        next: 'bye',
      },
      watching: {
        speaker: 'mara',
        text: 'Everyone was. It is the only show in town. That and the market, and the market has been the same since my mother was young.',
        next: 'bye',
      },
      bye: {
        speaker: 'mara',
        text: 'Come back when you have a verdict. I will pretend to be surprised.',
      },
    },
  },

  clem: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'clem',
        text: 'Psst. Want to know the secret of the square? Everything is one block deeper than it looks.',
        choices: [
          { text: 'That makes no sense.', next: 'sense' },
          { text: 'Go on.', next: 'on' },
        ],
      },
      sense: {
        speaker: 'clem',
        text: 'It is not supposed to. That is what makes it a secret.',
        next: 'bye',
      },
      on: {
        speaker: 'clem',
        text: 'The fountain, the steps, the market awnings. All of it sits on the same grid. Somebody built this town the way you would build a block house.',
        choices: [
          { text: 'You have thought about this a lot.', next: 'lot' },
          { text: 'I will keep that in mind.', next: 'bye' },
        ],
      },
      lot: {
        speaker: 'clem',
        text: 'I have a lot of time and a very good view of the pavement.',
        next: 'bye',
      },
      bye: {
        speaker: 'clem',
        text: 'Mind the blocks. They are exactly where you think they are.',
      },
    },
  },

  /* ── Market ───────────────────────────────────────────────────────────── */

  agnes: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'agnes',
        text: 'Fresh this morning. Mostly. Some of it is fresh from yesterday, but that is still fresh.',
        choices: [
          { text: 'What are you selling?', next: 'selling' },
          { text: 'Do you take evidence?', next: 'evidence' },
        ],
      },
      selling: {
        speaker: 'agnes',
        text: 'Whatever survives the cart ride in. Today that is turnips, a very confident pear, and three jars of something the label calls "relish".',
        next: 'bye',
      },
      evidence: {
        speaker: 'agnes',
        text: 'You are thinking of the archive. That is the building with the heavy door and the smell of old paper. Two streets over, past the stalls.',
        choices: [
          { text: 'Is it open?', next: 'open' },
          { text: 'I will find it.', next: 'bye' },
        ],
      },
      open: {
        speaker: 'agnes',
        text: 'The Clerk is always in. Whether the door is open is a different question, and the answer is usually "only for her".',
        next: 'bye',
      },
      bye: {
        speaker: 'agnes',
        text: 'Buy something on the way back. The stalls remember faces.',
      },
    },
  },

  milo: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'milo',
        text: 'Milo. I run the awning stall. Well. I run the awning. Pip runs the stall.',
        choices: [
          { text: 'What is the difference?', next: 'diff' },
          { text: 'Nice awning.', next: 'nice' },
        ],
      },
      diff: {
        speaker: 'milo',
        text: 'The awning is the part people see. I am very good at the part people see.',
        next: 'bye',
      },
      nice: {
        speaker: 'milo',
        text: 'Thank you. I picked the stripes. Pip said they were loud. Pip is correct, and that is the point.',
        next: 'bye',
      },
      bye: {
        speaker: 'milo',
        text: 'Come by later. The light is better on the awning after noon.',
      },
    },
  },

  pip: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'pip',
        text: 'Do not mind Milo. He will talk about that awning until the market closes. Probably after.',
        choices: [
          { text: 'You two work together?', next: 'together' },
          { text: 'What do you actually sell?', next: 'sell' },
        ],
      },
      together: {
        speaker: 'pip',
        text: 'He is the front of the stall. I am the person who knows where the money is. It works.',
        next: 'bye',
      },
      sell: {
        speaker: 'pip',
        text: 'Hats, mostly. Bad ones. There is a market for a bad hat, and the market is Milo wearing it.',
        next: 'bye',
      },
      bye: {
        speaker: 'pip',
        text: 'Watch the crates. Milo stacked them.',
      },
    },
  },

  /* ── Archive ──────────────────────────────────────────────────────────── */

  clerk: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'clerk',
        text: 'Quietly, please. Everything in here is numbered, and some of it is listening.',
        choices: [
          { text: 'What is in here?', next: 'what' },
          { text: 'Vera says you lost the key.', next: 'key' },
          { text: 'I will come back later.', next: 'bye' },
        ],
      },
      what: {
        speaker: 'clerk',
        text: 'Every case that ever came through the court. Exhibit A through A great many. Evidence that was argued over, evidence that was ignored, evidence nobody will ever see again.',
        choices: [
          { text: 'Can I look at my case?', next: 'mine' },
          { text: 'That is a lot of paper.', next: 'paper' },
        ],
      },
      mine: {
        speaker: 'clerk',
        text: 'If it is still open, it is in the front room. If it is closed, it goes in the back. The back room is what the door is for.',
        choices: [
          { text: 'You never open it?', next: 'key' },
          { text: 'Understood.', next: 'bye' },
        ],
      },
      paper: {
        speaker: 'clerk',
        text: 'Paper is patient. It waits for the trial to end and then outlives everybody in it.',
        next: 'bye',
      },
      key: {
        speaker: 'clerk',
        text: 'I did not lose the key. The key is exactly where I left it. The lock is simply very good at its job, and I respect it.',
        choices: [
          { text: 'That is not an answer.', next: 'notanswer' },
          { text: 'I respect it too.', next: 'respect' },
        ],
      },
      notanswer: {
        speaker: 'clerk',
        text: 'No. It is a better answer than the one you were expecting.',
        next: 'bye',
      },
      respect: {
        speaker: 'clerk',
        text: 'Then we understand each other. Do not touch the strongbox.',
        next: 'bye',
      },
      bye: {
        speaker: 'clerk',
        text: 'Return anything you move to exactly where you found it. Exactly.',
      },
    },
  },

  /* ── Tavern ───────────────────────────────────────────────────────────── */

  odile: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'odile',
        text: 'The Gavel & Goat. Best ale in the town, which is easy because it is the only ale in the town.',
        choices: [
          { text: 'Why the name?', next: 'name' },
          { text: 'Is the judge a regular?', next: 'judge' },
          { text: 'Just looking.', next: 'bye' },
        ],
      },
      name: {
        speaker: 'odile',
        text: 'The judge came in the year I opened and had opinions about the ale. I had opinions about his opinions. The sign was cheaper than the argument.',
        choices: [
          { text: 'Does he mind?', next: 'mind' },
          { text: 'Good sign.', next: 'good' },
        ],
      },
      mind: {
        speaker: 'odile',
        text: 'He pretends not to. He is in the corner booth so often I had to put his name on it.',
        next: 'bye',
      },
      good: {
        speaker: 'odile',
        text: 'It has horns. You can see them from the market.',
        next: 'bye',
      },
      judge: {
        speaker: 'odile',
        text: 'Every Thursday. Magnifies the ale. Says it improves the constitution of the proceedings. He still wears the sunglasses indoors, which I find rude.',
        choices: [
          { text: 'Why the sunglasses?', next: 'glasses' },
          { text: 'Thursday. Noted.', next: 'bye' },
        ],
      },
      glasses: {
        speaker: 'odile',
        text: 'Nobody knows. Nobody will ever know. I have stopped wondering and started pouring.',
        next: 'bye',
      },
      bye: {
        speaker: 'odile',
        text: 'Sit anywhere. Do not sit in his booth on a Thursday.',
      },
    },
  },

  'drunk-juror': {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'drunk-juror',
        text: 'I was on your jury. Well. I was nearly on your jury. I was on somebody\u2019s jury. It is all one long week.',
        choices: [
          { text: 'Did you vote?', next: 'vote' },
          { text: 'How long have you been here?', next: 'long' },
        ],
      },
      vote: {
        speaker: 'drunk-juror',
        text: 'Three times. Or three cases. Or the same case three times. The ballot box is sealed, you know. That is the whole point of it. Sealed.',
        choices: [
          { text: 'Sealed is good.', next: 'sealed' },
          { text: 'I should get back.', next: 'bye' },
        ],
      },
      sealed: {
        speaker: 'drunk-juror',
        text: 'Sealed is the BEST. If nobody can see it, nobody can argue about it. That is how I sleep at night.',
        next: 'bye',
      },
      long: {
        speaker: 'drunk-juror',
        text: 'Since the trial next to mine. The one with the sandwich. You remember the sandwich.',
        next: 'bye',
      },
      bye: {
        speaker: 'drunk-juror',
        text: 'Good luck out there. Or in there. Whichever room you are in.',
      },
    },
  },

  /* ── Residential streets ──────────────────────────────────────────────── */

  neighbour: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'neighbour',
        text: 'Lantern Row. Quiet, except on Thursdays, when the singing from the tavern comes up the street.',
        choices: [
          { text: 'Is the judge on this street?', next: 'judge' },
          { text: 'It is a lovely lane.', next: 'lovely' },
        ],
      },
      judge: {
        speaker: 'neighbour',
        text: 'On Thursdays. The rest of the time he lives above the court, behind the bench. Nobody has seen his front door and I have been looking for it for years.',
        next: 'bye',
      },
      lovely: {
        speaker: 'neighbour',
        text: 'Thank you. We keep the flowers. The Council keeps the lamps, and the Council keeps promising to mend the one by the corner.',
        next: 'bye',
      },
      bye: {
        speaker: 'neighbour',
        text: 'If you hear singing, that is normal.',
      },
    },
  },

  child: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'child',
        text: 'Are you the one from the court? Did they say you did it? You did not do it.',
        choices: [
          { text: 'How do you know?', next: 'know' },
          { text: 'Thank you.', next: 'thanks' },
        ],
      },
      know: {
        speaker: 'child',
        text: 'Because you look like my aunt and she never did it either. Also the lawyer was shouting and shouting usually means they are guessing.',
        choices: [
          { text: 'That is very clever.', next: 'clever' },
          { text: 'Your aunt sounds nice.', next: 'aunt' },
        ],
      },
      clever: {
        speaker: 'child',
        text: 'I am going to be a judge. A better one. I will do it without shouting.',
        next: 'bye',
      },
      aunt: {
        speaker: 'child',
        text: 'She is. She makes the bread for the market. The one with the very confident pear.',
        next: 'bye',
      },
      thanks: {
        speaker: 'child',
        text: 'You are welcome. I told the fountain you were innocent. It did not say anything back.',
        next: 'bye',
      },
      bye: {
        speaker: 'child',
        text: 'Bye! Watch the puddle. That is also me.',
      },
    },
  },

  /* ── The bench ────────────────────────────────────────────────────────── */

  judge: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'judge',
        text: 'You found the bench. Most people find the tavern first. I respect the order of operations, even when I disagree with it.',
        choices: [
          { text: 'Open the court.', next: 'open' },
          { text: 'I was just looking around.', next: 'later' },
        ],
      },
      open: {
        speaker: 'judge',
        text: 'Then take the stand. All rise, and try to look as if you meant to be here.',
        action: 'trial',
      },
      later: {
        speaker: 'judge',
        text: 'The town will still be here after. So will I. One of those is the comforting one.',
      },
    },
  },

  prosecutor: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'prosecutor',
        text: 'The people are ready when you are. By which I mean I am ready, and I have notes.',
        choices: [
          { text: 'What are you charging me with?', next: 'charge' },
          { text: 'I will hear it in court.', next: 'bye' },
        ],
      },
      charge: {
        speaker: 'prosecutor',
        text: 'Existing, loudly, in public. The exhibit is a pear. Do not let the defence tell you it was a salad.',
        next: 'bye',
      },
      bye: {
        speaker: 'prosecutor',
        text: 'Ask the judge to open the court. I have been standing at this table since the lamps were lit.',
      },
    },
  },

  defense: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'defense',
        text: 'Sit anywhere except the witness stand. That one makes people confess to things they only thought about.',
        choices: [
          { text: 'Are we going to win?', next: 'win' },
          { text: 'What should I do?', next: 'do' },
        ],
      },
      win: {
        speaker: 'defense',
        text: 'We are going to be interesting. Winning is a side effect, and not a reliable one.',
        next: 'bye',
      },
      do: {
        speaker: 'defense',
        text: 'Walk the town. Read the notices. Then come back and ask the judge to call the court to order. I will object at the right time. It is my one trick.',
        next: 'bye',
      },
      bye: {
        speaker: 'defense',
        text: 'If anyone offers you a pear, do not sign it.',
      },
    },
  },

  bailiff: {
    start: 'hi',
    nodes: {
      hi: {
        speaker: 'bailiff',
        text: 'All rise. Sorry. You are already standing. I do this when I am nervous, and I am always nervous before the gavel.',
        choices: [
          { text: 'Where do I stand?', next: 'stand' },
          { text: 'I will wait.', next: 'bye' },
        ],
      },
      stand: {
        speaker: 'bailiff',
        text: 'The well, when he calls you. Until then the aisle is yours. Do not lean on the ballot box. It is sealed and it knows.',
        next: 'bye',
      },
      bye: {
        speaker: 'bailiff',
        text: 'All rise. That one was on purpose.',
      },
    },
  },
};

/**
 * Cards for props you can read. Keyed by the interact `lines` id, or by the
 * interact id when a prop has no line pool (the evidence screen).
 */
export const TOWN_NOTES: Readonly<Record<string, { title: string; text: string }>> = {
  fountain: {
    title: 'The fountain',
    text: 'The water is the colour of old coins. People throw wishes in and the Clerk fishes the coins out on Fridays. The wishes stay.',
  },
  signpost: {
    title: 'Town notices',
    text: 'Court sits when the judge says it sits. The market does not close. Lantern Row asks, again, for the corner lamp to be mended. The corner lamp has been "on the list" since the last verdict.',
  },
  'market-rules': {
    title: 'Market rules',
    text: 'No shouting over the person already shouting. Pears must be confident but not libellous. Evidence is not a vegetable. The archive is not a stall.',
  },
  strongbox: {
    title: 'The strongbox',
    text: 'Locked. The plate says EXHIBITS, NOT LUNCH. Someone has scratched a small heart next to the lock and then tried, badly, to scratch it out.',
  },
  'exhibit-a': {
    title: 'Exhibit A',
    text: 'A single sheet, stamped twice and signed once by somebody who did not read it. The margin says "this is the one" in pencil. It does not say one of what.',
  },
  'ballot-box': {
    title: 'The sealed ballot box',
    text: 'Wax, ribbon, and a seal of the scales. The seal is intact. Whatever the jury decided is still in there, which is either justice or a very committed piece of stationery.',
  },
  'lane-sign': {
    title: 'Lantern Row',
    text: 'A wooden board, repainted. "Quiet street. Thursdays excepted." Underneath, smaller: "If you can hear the tavern, you are facing the right way."',
  },
  'high-seat': {
    title: 'The high seat',
    text: 'Odile has carved a tiny pair of sunglasses into the back of the chair. It is the judge\'s booth. Sitting in it on a Thursday is how people become exhibits.',
  },
  'evidence-screen': {
    title: 'The evidence',
    text: 'The screen shows the docket, the objection, and a still of the thing nobody can agree is a pear. The record is the same one the first-person court keeps. You are just standing in front of it.',
  },
};
