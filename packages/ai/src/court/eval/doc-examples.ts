/**
 * Additional complete examples for the mode docs (docs/ai/02-04). Each one is
 * checked by the validator in tests and rendered into the docs by
 * `npm run court:prompts`, so the documented examples are always valid output.
 */
import type { CaseInput } from '../schema';

export interface DocExample {
  key: string;
  input: CaseInput;
  /** Exactly what a model would return. */
  script: { analysis: Record<string, unknown>; lines: Record<string, unknown>[] };
}

export const DOC_EXAMPLES: readonly DocExample[] = [
  {
    "key": "solo-alarms",
    "input": {
      "mode": "solo",
      "caseId": "doc-solo-alarms",
      "caseTitle": "The Eleven Alarms",
      "confession": "I set 11 alarms five minutes apart so I would definitely wake up for my 9 AM flight. I snoozed every single one of them and missed the flight."
    },
    "script": {
      "analysis": {
        "core": "The defendant built an eleven-layer wake-up system and then defeated every layer personally.",
        "tension": "Eleven alarms were set to guarantee waking up, and the snooze button beat all of them.",
        "benchA": "More alarms only trained the defendant to snooze faster; the backup plan was the same thumb.",
        "benchB": "The defendant planned for the danger honestly; the failure was a sleepy morning, not a lack of effort.",
        "factRefs": [
          "F1",
          "F2"
        ]
      },
      "lines": [
        {
          "slot": "L01",
          "speaker": "clerk",
          "emotion": "amused",
          "animation": "talk",
          "text": "Case filed: The Eleven Alarms. The defendant set 11 alarms for a 9 AM flight and snoozed every one. The clerk notes that the flight left on time.",
          "factRefs": [
            "F1",
            "F2"
          ]
        },
        {
          "slot": "L02",
          "speaker": "prosecutor",
          "emotion": "smug",
          "animation": "point",
          "text": "Your Honor, the defendant set 11 alarms five minutes apart. That is not a plan to wake up. That is a plan to negotiate with yourself 11 times and lose every round to the snooze button.",
          "factRefs": [
            "F1",
            "F2"
          ]
        },
        {
          "slot": "L03",
          "speaker": "defense",
          "emotion": "confident",
          "animation": "point",
          "text": "Miss Ratio calls it a plan to negotiate with yourself. I call it redundancy. Airlines carry backup engines; my client carried backup alarms. Nobody blames the engineer when the pilot hits snooze.",
          "factRefs": [
            "F1"
          ],
          "answers": "a plan to negotiate with yourself"
        },
        {
          "slot": "L04",
          "speaker": "prosecutor",
          "emotion": "angry",
          "animation": "desk-slam",
          "text": "Backup engines? Counsel, a backup engine does not switch the first engine off. Every one of these alarms was silenced by the same thumb. That is not redundancy. That is one failure repeated 11 times.",
          "factRefs": [
            "F1",
            "F2"
          ],
          "answers": "Airlines carry backup engines"
        },
        {
          "slot": "L05",
          "speaker": "defense",
          "emotion": "amused",
          "animation": "point",
          "text": "One failure repeated 11 times is also called persistence. My client believed in that flight every five minutes, right up until the flight stopped believing in my client.",
          "factRefs": [
            "F1",
            "F2"
          ],
          "answers": "one failure repeated 11 times"
        },
        {
          "slot": "L06",
          "speaker": "judge",
          "emotion": "exasperated",
          "animation": "talk",
          "crowd": "laugh",
          "text": "The court set exactly one alarm this morning and is now worried about it. Continue, counsel, but quickly.",
          "factRefs": []
        },
        {
          "slot": "L07",
          "speaker": "prosecutor",
          "emotion": "smug",
          "animation": "desk-slam",
          "text": "Members of the jury, remember the thumb. 11 alarms, one thumb, no flight. When the backup plan is the problem, the decision is GUILTY.",
          "factRefs": [
            "F1",
            "F2"
          ]
        },
        {
          "slot": "L08",
          "speaker": "defense",
          "emotion": "triumphant",
          "animation": "point",
          "text": "Remember the persistence instead. My client trusted 11 alarms more than most people trust anything, then confessed it to a courtroom. Find my client NOT COOKED.",
          "factRefs": [
            "F1"
          ]
        }
      ]
    }
  },
  {
    "key": "solo-sourdough",
    "input": {
      "mode": "solo",
      "caseId": "doc-solo-sourdough",
      "caseTitle": "The Sourdough Roommate",
      "confession": "During a stressful month I named my sourdough starter Gerald. Now I cancel plans with friends because Gerald needs feeding. My friends say I have put bread ahead of people."
    },
    "script": {
      "analysis": {
        "core": "The defendant adopted a jar of flour and water as a dependent and now cancels on friends for it.",
        "tension": "A stress-relief hobby became a scheduling authority with a name.",
        "benchA": "Cancelling plans for a jar shows the hobby now outranks people, exactly as the friends said.",
        "benchB": "Caring for something on a schedule during a stressful month is a healthy routine, and Gerald is part of it.",
        "factRefs": [
          "F1",
          "F2",
          "F3"
        ]
      },
      "lines": [
        {
          "slot": "L01",
          "speaker": "clerk",
          "emotion": "amused",
          "animation": "talk",
          "text": "Case filed: The Sourdough Roommate. The defendant named a sourdough starter Gerald and now cancels plans when Gerald is hungry. Gerald could not attend today.",
          "factRefs": [
            "F1",
            "F2"
          ]
        },
        {
          "slot": "L02",
          "speaker": "prosecutor",
          "emotion": "smug",
          "animation": "point",
          "text": "Your Honor, the defendant cancels plans with friends because a jar needs feeding. The friends were ranked and came in below bread. The bread got a name; the friends got an apology.",
          "factRefs": [
            "F2",
            "F3"
          ]
        },
        {
          "slot": "L03",
          "speaker": "defense",
          "emotion": "confident",
          "animation": "point",
          "text": "The friends came in below bread? Wrong order of events. Gerald arrived in a stressful month, when my client needed something that rises on schedule. Gerald is a coping strategy with a crust.",
          "factRefs": [
            "F1",
            "F3"
          ],
          "answers": "came in below bread"
        },
        {
          "slot": "L04",
          "speaker": "prosecutor",
          "emotion": "angry",
          "animation": "desk-slam",
          "text": "A coping strategy? Counsel, a coping strategy helps you see your friends again. This one sends them home. When the jar needs feeding more than the people do, the jar is in charge.",
          "factRefs": [
            "F2"
          ],
          "answers": "Gerald is a coping strategy"
        },
        {
          "slot": "L05",
          "speaker": "defense",
          "emotion": "amused",
          "animation": "point",
          "text": "The jar is in charge, says the prosecution, as if that is a flaw. The friends can feed themselves; Gerald cannot. That is not neglect. That is triage.",
          "factRefs": [
            "F2",
            "F3"
          ],
          "answers": "the jar is in charge"
        },
        {
          "slot": "L06",
          "speaker": "judge",
          "emotion": "exasperated",
          "animation": "talk",
          "crowd": "laugh",
          "text": "The court notes it has never been cancelled on for bread, and is unsure whether that is a compliment.",
          "factRefs": []
        },
        {
          "slot": "L07",
          "speaker": "prosecutor",
          "emotion": "smug",
          "animation": "desk-slam",
          "text": "Members of the jury, a coping strategy that cancels friends is replacing, not coping. The bread has risen; the friendships have not. Find this decision GUILTY.",
          "factRefs": [
            "F2",
            "F3"
          ]
        },
        {
          "slot": "L08",
          "speaker": "defense",
          "emotion": "triumphant",
          "animation": "point",
          "text": "Remember the routine instead. My client found something steady in a stressful month and was honest enough to confess it. Give Gerald's keeper a break: find my client NOT COOKED.",
          "factRefs": [
            "F1"
          ]
        }
      ]
    }
  },
  {
    "key": "versus-tupperware",
    "input": {
      "mode": "versus",
      "caseId": "doc-versus-tupperware",
      "caseTitle": "The Container Swap",
      "sideA": {
        "name": "Maya",
        "account": "I lent Sam my good glass container with soup in it. Three weeks later Sam gave back a different, cheaper plastic one and called it a fair swap."
      },
      "sideB": {
        "name": "Sam",
        "account": "The glass container cracked in the microwave, which was an accident. I replaced it the same day with the best container the corner shop had, and I washed it first."
      },
      "agreedFacts": [
        "Sam borrowed Maya's glass container with soup in it.",
        "Sam returned a different, plastic container."
      ]
    },
    "script": {
      "analysis": {
        "core": "A borrowed glass container broke and came back as a cheaper plastic one, and the two friends disagree about whether that is a fair swap.",
        "tension": "The replacement came the same day, but it was the corner shop's best, which was not glass.",
        "benchA": "Maya lent glass and got plastic; nobody asked Maya whether a downgrade counts as a replacement.",
        "benchB": "The crack was an accident, and Sam replaced and washed the container without being asked.",
        "factRefs": [
          "F1",
          "F2",
          "F5",
          "F6"
        ]
      },
      "lines": [
        {
          "slot": "L01",
          "speaker": "clerk",
          "emotion": "amused",
          "animation": "talk",
          "text": "The court calls The Container Swap: Maya versus Sam. A glass container left full of soup and came back as plastic. The clerk has picked no side.",
          "factRefs": [
            "F1",
            "F2"
          ]
        },
        {
          "slot": "L02",
          "speaker": "defense",
          "emotion": "confident",
          "animation": "present-evidence",
          "text": "Both sides agree: Sam borrowed Maya's glass container and returned a plastic one. My client lent glass, received plastic, and asks when exactly she agreed to a downgrade.",
          "factRefs": [
            "F1",
            "F2"
          ]
        },
        {
          "slot": "L03",
          "speaker": "prosecutor",
          "emotion": "confident",
          "animation": "present-evidence",
          "text": "My client adds what Maya left out: the glass cracked in the microwave by accident, and Sam replaced it the same day, washed. Same-day replacements almost never happen.",
          "factRefs": [
            "F5",
            "F6"
          ]
        },
        {
          "slot": "L04",
          "speaker": "prosecutor",
          "emotion": "smug",
          "animation": "point",
          "text": "When did Maya agree to a downgrade? When Maya lent glass to someone with a microwave. Glass breaks. Sam chose the cleanup, not the crack.",
          "factRefs": [
            "F1",
            "F5"
          ],
          "answers": "when exactly she agreed to a downgrade"
        },
        {
          "slot": "L05",
          "speaker": "defense",
          "emotion": "smug",
          "animation": "point",
          "text": "Same-day replacements almost never happen, and neither do downgrades called a fair swap. The best plastic in the corner shop is still not glass.",
          "factRefs": [
            "F4",
            "F6"
          ],
          "answers": "Same-day replacements almost never happen"
        },
        {
          "slot": "L06",
          "speaker": "defense",
          "emotion": "angry",
          "animation": "desk-slam",
          "text": "Glass breaks, yes, and Maya accepted that risk. Maya never accepted glass coming back as plastic and being called fair.",
          "factRefs": [
            "F3",
            "F4"
          ],
          "answers": "Glass breaks"
        },
        {
          "slot": "L07",
          "speaker": "prosecutor",
          "emotion": "angry",
          "animation": "desk-slam",
          "text": "The best plastic in the corner shop, says counsel, about a container that came back washed and unasked. That is not a downgrade. That is a friend with a sponge.",
          "factRefs": [
            "F6"
          ],
          "answers": "The best plastic in the corner shop"
        },
        {
          "slot": "L08",
          "speaker": "judge",
          "emotion": "exasperated",
          "animation": "talk",
          "crowd": "laugh",
          "text": "The court has heard more about soup containers today than in its entire career. It remains neutral on plastic.",
          "factRefs": []
        },
        {
          "slot": "L09",
          "speaker": "defense",
          "emotion": "triumphant",
          "animation": "point",
          "text": "Remember the downgrade. Maya lent glass and got plastic plus the word fair. If that is fair, nobody's good container is safe. Vote SIDE A.",
          "factRefs": [
            "F1",
            "F2"
          ]
        },
        {
          "slot": "L10",
          "speaker": "prosecutor",
          "emotion": "triumphant",
          "animation": "point",
          "text": "Remember the sponge. An accident, a replacement and a wash, all unasked. If that is not enough, nobody should ever lend soup again. Vote SIDE B.",
          "factRefs": [
            "F5",
            "F6"
          ]
        }
      ]
    }
  },
  {
    "key": "versus-thermostat",
    "input": {
      "mode": "versus",
      "caseId": "doc-versus-thermostat",
      "caseTitle": "The Thermostat Cold War",
      "sideA": {
        "name": "Leo",
        "account": "My flatmate keeps the heating at 26 degrees all winter and then opens a window when it gets too warm. We split the heating bill, so I pay for the window too."
      },
      "sideB": {
        "name": "Nadia",
        "account": "Leo sets the heating to 17 degrees and wears a coat indoors, which is not a way to live. I open the window for fresh air, not because it is too warm."
      },
      "agreedFacts": [
        "Leo and Nadia share one thermostat.",
        "They split the heating bill equally."
      ]
    },
    "script": {
      "analysis": {
        "core": "Two flatmates share one thermostat and one bill, and each thinks the other's temperature is the unreasonable one.",
        "tension": "One heats the flat to 26 degrees and opens a window; the other sets 17 and wears a coat indoors.",
        "benchA": "Leo pays half of every warm breeze that leaves through the open window.",
        "benchB": "A coat indoors means the flat is too cold, and fresh air is not waste.",
        "factRefs": [
          "F1",
          "F2",
          "F3",
          "F5",
          "F6"
        ]
      },
      "lines": [
        {
          "slot": "L01",
          "speaker": "clerk",
          "emotion": "amused",
          "animation": "talk",
          "text": "The court calls The Thermostat Cold War: Leo versus Nadia. One thermostat, two climates, one shared bill. The clerk brought a cardigan and an open mind.",
          "factRefs": [
            "F1",
            "F2"
          ]
        },
        {
          "slot": "L02",
          "speaker": "defense",
          "emotion": "confident",
          "animation": "present-evidence",
          "text": "Both sides agree they share one thermostat and split the heating bill. My client says the heating runs at 26 degrees and then a window opens. My client is paying to heat the street.",
          "factRefs": [
            "F1",
            "F2",
            "F3",
            "F4"
          ]
        },
        {
          "slot": "L03",
          "speaker": "prosecutor",
          "emotion": "confident",
          "animation": "present-evidence",
          "text": "My client has a number too: Leo sets the heating to 17 degrees and wears a coat indoors. A flat that needs a coat is not a home. It is a bus stop with a sofa.",
          "factRefs": [
            "F5"
          ]
        },
        {
          "slot": "L04",
          "speaker": "prosecutor",
          "emotion": "smug",
          "animation": "point",
          "text": "Paying to heat the street? My client opens the window for fresh air, not because it is too warm. Fresh air is free, counsel.",
          "factRefs": [
            "F2",
            "F6"
          ],
          "answers": "paying to heat the street"
        },
        {
          "slot": "L05",
          "speaker": "defense",
          "emotion": "amused",
          "animation": "point",
          "text": "A bus stop with a sofa, maybe, but the coat costs nothing to run. The heating at 26 degrees does, and it shows up on the shared bill.",
          "factRefs": [
            "F3",
            "F4",
            "F5"
          ],
          "answers": "a bus stop with a sofa"
        },
        {
          "slot": "L06",
          "speaker": "defense",
          "emotion": "angry",
          "animation": "desk-slam",
          "text": "Fresh air is free. Warm air is not, and the window lets out both at once. My client asks only that the heating and the window stop fighting.",
          "factRefs": [
            "F3",
            "F6"
          ],
          "answers": "Fresh air is free"
        },
        {
          "slot": "L07",
          "speaker": "prosecutor",
          "emotion": "angry",
          "animation": "desk-slam",
          "text": "The coat costs nothing to run? Neither does being cold. My client wants a home where nobody dresses for the outdoors to sit on the sofa.",
          "factRefs": [
            "F5"
          ],
          "answers": "the coat costs nothing to run"
        },
        {
          "slot": "L08",
          "speaker": "judge",
          "emotion": "exasperated",
          "animation": "talk",
          "crowd": "laugh",
          "text": "The court has heard two numbers, a window and a coat, and has adjusted its own thermostat twice. Carry on.",
          "factRefs": []
        },
        {
          "slot": "L09",
          "speaker": "defense",
          "emotion": "triumphant",
          "animation": "point",
          "text": "Remember the street. Every time that window opens, my client pays half the heat it lets out. Close the window and everyone is warm enough. Vote SIDE A.",
          "factRefs": [
            "F2",
            "F3"
          ]
        },
        {
          "slot": "L10",
          "speaker": "prosecutor",
          "emotion": "triumphant",
          "animation": "point",
          "text": "Remember the bus stop. A home should not need a coat, and fresh air should not need permission. Let my client be warm and breathe. Vote SIDE B.",
          "factRefs": [
            "F5",
            "F6"
          ]
        }
      ]
    }
  },
  {
    "key": "viral-hotdog",
    "input": {
      "mode": "viral",
      "caseId": "doc-viral-hotdog",
      "caseTitle": "The Hot Dog Question",
      "question": "Is a hot dog a sandwich?",
      "summary": "A long-running internet argument about whether a hot dog, a sausage in a split roll, counts as a sandwich.",
      "sideA": {
        "label": "Sandwich",
        "position": "It is a filling between bread, which is what a sandwich is."
      },
      "sideB": {
        "label": "Not a sandwich",
        "position": "A hot dog is its own food with its own name, its own bun and its own rules."
      },
      "sources": [
        {
          "id": "S1",
          "title": "Community summary of the debate",
          "claim": "Supporters say any filling held in sliced bread is a sandwich, and the bun is sliced bread.",
          "kind": "opinion"
        },
        {
          "id": "S2",
          "title": "Community summary of the debate",
          "claim": "Opponents say nobody orders a hot dog by asking for a sausage sandwich, so everyday usage decides.",
          "kind": "opinion"
        }
      ],
      "approved": true
    },
    "script": {
      "analysis": {
        "core": "Whether a sausage in a split roll meets the definition of a sandwich or has earned its own category.",
        "tension": "Both sides agree on what a hot dog is and disagree on what a sandwich is.",
        "benchA": "A filling held in sliced bread is the plain definition of a sandwich, and the bun is sliced bread.",
        "benchB": "Everyday usage decides, and nobody orders a sausage sandwich when they want a hot dog.",
        "factRefs": [
          "F2",
          "F3",
          "F4",
          "F5"
        ]
      },
      "lines": [
        {
          "slot": "L02",
          "speaker": "judge",
          "emotion": "neutral",
          "animation": "talk",
          "text": "Background: the internet has argued for years about whether a hot dog, a sausage in a split roll, is a sandwich. Both views here are opinions. The court brought napkins.",
          "factRefs": [
            "F1"
          ]
        },
        {
          "slot": "L03",
          "speaker": "prosecutor",
          "emotion": "confident",
          "animation": "point",
          "text": "A filling between bread is a sandwich. A hot dog is a sausage in a split roll. Your Honor, it is held like a sandwich and it drips mustard like a sandwich.",
          "factRefs": [
            "F2",
            "F4"
          ]
        },
        {
          "slot": "L04",
          "speaker": "defense",
          "emotion": "confident",
          "animation": "point",
          "text": "Nobody has ever ordered a sausage sandwich at a stand. A hot dog has its own name, its own bun and its own rules. You do not get your own bun by accident. You earn it.",
          "factRefs": [
            "F3",
            "F5"
          ]
        },
        {
          "slot": "L05",
          "speaker": "defense",
          "emotion": "smug",
          "animation": "point",
          "text": "Held like a sandwich? So is a taco. By that logic half the menu is a sandwich, and a definition that covers everything decides nothing.",
          "factRefs": [
            "F4"
          ],
          "answers": "it is held like a sandwich"
        },
        {
          "slot": "L06",
          "speaker": "prosecutor",
          "emotion": "smug",
          "animation": "point",
          "text": "You earn your own bun? A burger has its own bun and its own name, and people still call it a sandwich. A special bun is just a costume for bread.",
          "factRefs": [
            "F2",
            "F4"
          ],
          "answers": "You earn it"
        },
        {
          "slot": "L07",
          "speaker": "prosecutor",
          "emotion": "angry",
          "animation": "desk-slam",
          "text": "This definition covers one thing: a filling held in sliced bread. The taco is not on trial today. The hot dog is, and the hot dog fits.",
          "factRefs": [
            "F4"
          ],
          "answers": "a definition that covers everything decides nothing"
        },
        {
          "slot": "L08",
          "speaker": "defense",
          "emotion": "triumphant",
          "animation": "desk-slam",
          "text": "If the bun is a costume, it works, because nobody is fooled. Usage decides what words mean, and nobody orders a hot dog by asking for a sandwich.",
          "factRefs": [
            "F3",
            "F5"
          ],
          "answers": "A special bun is just a costume"
        },
        {
          "slot": "L09",
          "speaker": "judge",
          "emotion": "amused",
          "animation": "talk",
          "crowd": "laugh",
          "text": "The court has heard the word bun more times than it expected in its legal career, and is now hungry. Order.",
          "factRefs": []
        },
        {
          "slot": "L10",
          "speaker": "judge",
          "emotion": "neutral",
          "animation": "gavel",
          "text": "For the sandwich side: the bun is sliced bread with a filling inside. For the other side: everyday usage gives the hot dog its own name. The question stays open.",
          "factRefs": [
            "F4",
            "F5"
          ]
        }
      ]
    }
  },
  {
    "key": "viral-gif",
    "input": {
      "mode": "viral",
      "caseId": "doc-viral-gif",
      "caseTitle": "The GIF Pronunciation Hearing",
      "question": "Should GIF be pronounced with a hard G?",
      "summary": "People disagree about whether the image format GIF is said with a hard G, as in gift, or a soft G, as in giraffe.",
      "sideA": {
        "label": "Hard G",
        "position": "GIF stands for Graphics Interchange Format, and graphics starts with a hard G."
      },
      "sideB": {
        "label": "Soft G",
        "position": "The person who created the format said it is a soft G, and the creator gets to decide."
      },
      "sources": [
        {
          "id": "S1",
          "title": "Interview with the format's creator",
          "date": "2013-05-21",
          "claim": "The creator of the GIF format said it is pronounced with a soft G, like the word jif.",
          "kind": "fact"
        },
        {
          "id": "S2",
          "title": "Community summary of the debate",
          "claim": "Hard-G supporters say an acronym should sound like the words it stands for.",
          "kind": "opinion"
        }
      ],
      "uncertainty": [
        "Dictionaries list both pronunciations."
      ],
      "approved": true
    },
    "script": {
      "analysis": {
        "core": "Whether an acronym's pronunciation is set by the words it stands for or by the person who created it.",
        "tension": "The creator said soft G, while the letters themselves point to a hard G.",
        "benchA": "GIF stands for Graphics Interchange Format, and an acronym usually sounds like the words inside it.",
        "benchB": "The creator of the format said it is a soft G, and whoever names a thing gets to say how it sounds.",
        "factRefs": [
          "F2",
          "F3",
          "F4",
          "F5"
        ]
      },
      "lines": [
        {
          "slot": "L02",
          "speaker": "judge",
          "emotion": "neutral",
          "animation": "talk",
          "text": "Background: people disagree on whether GIF takes a hard G, as in gift, or a soft G, as in giraffe. The creator said soft; hard-G supporters point to the acronym.",
          "factRefs": [
            "F1",
            "F4",
            "F5"
          ]
        },
        {
          "slot": "L03",
          "speaker": "prosecutor",
          "emotion": "confident",
          "animation": "point",
          "text": "GIF stands for Graphics Interchange Format, and graphics starts with a hard G. Your Honor, this is not a mystery. It is a spelling lesson.",
          "factRefs": [
            "F2",
            "F5"
          ]
        },
        {
          "slot": "L04",
          "speaker": "defense",
          "emotion": "confident",
          "animation": "point",
          "text": "The creator of the format said it is a soft G, like the word jif. When you invent something, you get to say how its name sounds. Ask the inventor.",
          "factRefs": [
            "F3",
            "F4"
          ]
        },
        {
          "slot": "L05",
          "speaker": "defense",
          "emotion": "smug",
          "animation": "point",
          "text": "A spelling lesson? Then learn from giraffe and gin, where the G goes soft and nobody complains. English letters have never promised to behave.",
          "factRefs": [
            "F1"
          ],
          "answers": "It is a spelling lesson"
        },
        {
          "slot": "L06",
          "speaker": "prosecutor",
          "emotion": "smug",
          "animation": "point",
          "text": "Ask the inventor? Once a word leaves its creator, everyone who says it gets a vote, and the internet reads the letters it is given.",
          "factRefs": [
            "F4",
            "F5"
          ],
          "answers": "Ask the inventor"
        },
        {
          "slot": "L07",
          "speaker": "prosecutor",
          "emotion": "angry",
          "animation": "desk-slam",
          "text": "English letters never promised to behave, which is why we lean on the words inside the acronym. Graphics, hard G. Follow the clue written down on purpose.",
          "factRefs": [
            "F2",
            "F5"
          ],
          "answers": "English letters have never promised to behave"
        },
        {
          "slot": "L08",
          "speaker": "defense",
          "emotion": "triumphant",
          "animation": "desk-slam",
          "text": "Everyone gets a vote? Then the creator's vote counts, and it is the only one cast by someone who was there when the name was chosen. That vote is soft.",
          "factRefs": [
            "F4"
          ],
          "answers": "everyone who says it gets a vote"
        },
        {
          "slot": "L09",
          "speaker": "judge",
          "emotion": "amused",
          "animation": "talk",
          "crowd": "laugh",
          "text": "The court has avoided saying the word aloud for this entire hearing and intends to keep that streak alive.",
          "factRefs": []
        },
        {
          "slot": "L10",
          "speaker": "judge",
          "emotion": "neutral",
          "animation": "gavel",
          "text": "For the hard G: the acronym starts with graphics. For the soft G: the creator of the format said soft. The question stays with the jury.",
          "factRefs": [
            "F2",
            "F4"
          ]
        }
      ]
    }
  }
];
