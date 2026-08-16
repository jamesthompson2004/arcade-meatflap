// A port of Weizenbaum's 1966 ELIZA/DOCTOR mechanism (decomposition/reassembly rules keyed
// off ranked keywords, pronoun reflection, a MEMORY stack, and a content-free fallback list),
// not a line-by-line transcription of the original MAD-SLIP script. See:
// Weizenbaum, J. "ELIZA — A Computer Program for the Study of Natural Language Communication
// Between Man and Machine." CACM 9(1), Jan 1966.
//
// Two subtleties from the paper worth flagging for anyone touching this file:
// 1. Keyword *detection* runs on the ORIGINAL words the user typed, but decomposition
//    *matching* runs on a pronoun-reflected copy (I<->YOU, MY<->YOUR, ...). That's why a
//    keyword like "MY" is detected via the literal word "my", while its own decomposition
//    patterns are written expecting "YOUR" — by the time matching happens, "my" has already
//    become "your" in the working copy. Same story for "I" (rules match against "YOU").
// 2. Each decomposition rule cycles through its own reassembly list in order (not randomly)
//    so the same rule matching twice in a row doesn't repeat itself — `idx` on each rule
//    tracks that, exactly as described in the paper.

function W(n) { return { wild: true, count: n || 0 }; } // 0 = any number of words, incl. none
function ALT(...words) { return { alt: words }; }

const CONTRACTION_EXPANSIONS = [
  [/\bDON'?T\b/g, "DO NOT"],
  [/\bCAN'?T\b/g, "CAN NOT"],
  [/\bWON'?T\b/g, "WILL NOT"],
  [/\bISN'T\b/g, "IS NOT"],
  [/\bAREN'T\b/g, "ARE NOT"],
  [/\bWASN'T\b/g, "WAS NOT"],
  [/\bWEREN'T\b/g, "WERE NOT"],
  [/\bHASN'T\b/g, "HAS NOT"],
  [/\bHAVEN'T\b/g, "HAVE NOT"],
  [/\bHADN'T\b/g, "HAD NOT"],
  [/\bDOESN'T\b/g, "DOES NOT"],
  [/\bDIDN'T\b/g, "DID NOT"],
  [/\bSHOULDN'T\b/g, "SHOULD NOT"],
  [/\bWOULDN'T\b/g, "WOULD NOT"],
  [/\bCOULDN'T\b/g, "COULD NOT"],
  [/\bI'M\b/g, "I AM"],
  [/\bYOU'RE\b/g, "YOU ARE"],
  [/\bHE'S\b/g, "HE IS"],
  [/\bSHE'S\b/g, "SHE IS"],
  [/\bTHAT'S\b/g, "THAT IS"],
  [/\bTHERE'S\b/g, "THERE IS"],
  [/\bWHAT'S\b/g, "WHAT IS"],
  [/\bIT'S\b/g, "IT IS"],
  [/\bWE'RE\b/g, "WE ARE"],
  [/\bTHEY'RE\b/g, "THEY ARE"],
  [/\bI'VE\b/g, "I HAVE"],
  [/\bYOU'VE\b/g, "YOU HAVE"],
  [/\bWE'VE\b/g, "WE HAVE"],
  [/\bTHEY'VE\b/g, "THEY HAVE"],
  [/\bI'D\b/g, "I WOULD"],
  [/\bYOU'D\b/g, "YOU WOULD"],
  [/\bWE'D\b/g, "WE WOULD"],
  [/\bTHEY'D\b/g, "THEY WOULD"],
  [/\bI'LL\b/g, "I WILL"],
  [/\bYOU'LL\b/g, "YOU WILL"],
  [/\bWE'LL\b/g, "WE WILL"],
  [/\bTHEY'LL\b/g, "THEY WILL"],
];

// Applied per-word from the ORIGINAL value only (not iteratively), so this is a simultaneous
// swap — "I" and "YOU" both flip in one pass without one clobbering the other.
const PRONOUN_MAP = {
  I: "YOU", ME: "YOU", MY: "YOUR", MYSELF: "YOURSELF",
  YOU: "I", YOUR: "MY", YOURSELF: "MYSELF",
  AM: "ARE", ARE: "AM", WAS: "WERE", WERE: "WAS",
};

function splitIntoClauses(raw) {
  return raw.split(/[.,!?;]+/).map((s) => s.trim()).filter(Boolean);
}

function tokenize(clause) {
  let s = " " + clause.toUpperCase() + " ";
  for (const [re, rep] of CONTRACTION_EXPANSIONS) s = s.replace(re, rep);
  s = s.replace(/[^A-Z' ]+/g, " ");
  return s.trim().split(/\s+/).filter(Boolean);
}

function matchPattern(words, pattern) {
  function rec(wi, pi, caps) {
    if (pi === pattern.length) return wi === words.length ? caps : null;
    const tok = pattern[pi];
    if (tok.alt) {
      if (wi < words.length && tok.alt.includes(words[wi])) return rec(wi + 1, pi + 1, [...caps, words[wi]]);
      return null;
    }
    if (tok.wild) {
      if (tok.count > 0) {
        if (wi + tok.count > words.length) return null;
        return rec(wi + tok.count, pi + 1, [...caps, words.slice(wi, wi + tok.count).join(" ")]);
      }
      for (let take = 0; wi + take <= words.length; take++) {
        const res = rec(wi + take, pi + 1, [...caps, words.slice(wi, wi + take).join(" ")]);
        if (res) return res;
      }
      return null;
    }
    // literal word
    if (wi < words.length && words[wi] === tok) return rec(wi + 1, pi + 1, caps);
    return null;
  }
  return rec(0, 0, []);
}

function applyTemplate(template, caps) {
  let text = template.replace(/\{(\d+)\}/g, (_, n) => (caps[+n - 1] || "").toLowerCase());
  text = text.replace(/\s+([?.])/g, "$1").replace(/\s+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// --- Keyword dictionary --------------------------------------------------------------
// Each entry: triggers (words that count as this keyword), rank (higher wins when several
// keywords appear in the same clause), decomps tried in order, each with reassemblies cycled
// in order. `memory: true` also stashes a MEMORY-list line, replayed later on a keyword-less
// turn — the mechanism the paper singles out as ELIZA's way of seeming to "remember."
//
// Capture numbering gotcha (this bit several new patterns before it was caught): {n} in a
// reassembly refers to the nth W(...)/ALT(...) token in that decomposition's pattern —
// literal words don't count. `[W(0), "YOU", "LOVE", W(0)]` has only 2 captures ({1} pre,
// {2} post) despite being a 4-token pattern; a reassembly referencing {3} or {4} silently
// resolves to an empty string instead of erroring, so a wrong index doesn't fail loudly, it
// just quietly drops words from the output. After adding or editing any pattern, sanity-check
// it — e.g. run this in the console: for each decomp, count `pattern.filter(t => t.wild ||
// t.alt).length` and confirm no reassembly references a {n} above that count.
const FAMILY_WORDS = ["MOTHER", "FATHER", "MOM", "DAD", "SISTER", "BROTHER", "WIFE", "HUSBAND", "FAMILY", "CHILDREN", "PARENTS"];
// {2} is the bare family word itself (e.g. "mother"); {3} is whatever follows it in the
// sentence, pronoun-reflected (e.g. "takes care of me" -> "takes care of you"). Templates
// below only insert {2} where a bare word reads fine on its own ("Your {2}?") and use {3}
// where a predicate is expected ("Who else in your family {3}?") — mixing those up is what
// produced "Who else in your family mother?" during testing.
const FAMILY_REASSEMBLIES = [
  "Tell me more about your family.",
  "Who else in your family {3}?",
  "Your {2}?",
  "What else comes to mind when you think of your {2}?",
];

const KEYWORDS = [
  {
    triggers: ["SORRY"], rank: 0,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "Please don't apologize.",
      "Apologies are not necessary.",
      "What feelings do you have when you apologize?",
      "I've told you that apologies are not required.",
    ] }],
  },
  {
    triggers: ["REMEMBER"], rank: 5,
    decomps: [
      { pattern: [W(0), "DO", "I", "REMEMBER", W(0)], idx: 0, reassemblies: [
        "Did you think I would forget {2}?",
        "Why do you think I should recall {2} now?",
        "What about {2}?",
        "You mentioned {2}?",
      ] },
      { pattern: [W(0), "YOU", "REMEMBER", W(0)], idx: 0, reassemblies: [
        "Do you often think of {2}?",
        "Does thinking of {2} bring anything else to mind?",
        "What else do you remember?",
        "Why do you remember {2} just now?",
        "What in the present situation reminds you of {2}?",
      ] },
    ],
  },
  {
    triggers: ["IF"], rank: 3,
    decomps: [{ pattern: [W(0), "IF", W(0)], idx: 0, reassemblies: [
      "Do you think it's likely that {2}?",
      "Do you wish that {2}?",
      "What do you think about {2}?",
      "Really, {2}?",
    ] }],
  },
  {
    triggers: FAMILY_WORDS, rank: 0,
    decomps: [{ pattern: [W(0), ALT(...FAMILY_WORDS), W(0)], idx: 0, reassemblies: FAMILY_REASSEMBLIES }],
  },
  {
    triggers: ["MY"], rank: 2,
    decomps: [
      { pattern: [W(0), "YOUR", ALT(...FAMILY_WORDS), W(0)], idx: 0, reassemblies: FAMILY_REASSEMBLIES },
      {
        pattern: [W(0), "YOUR", W(0)], idx: 0, memory: true,
        memoryTemplates: ["Let's discuss further why your {2}.", "Earlier you said your {2}."],
        reassemblies: [
          "Your {2}?",
          "Why do you say your {2}?",
          "Does that suggest anything else which belongs to you?",
          "Is it important to you that {2}?",
        ],
      },
    ],
  },
  {
    triggers: ["DREAM", "DREAMS", "DREAMED", "DREAMT"], rank: 3,
    decomps: [
      { pattern: [W(0), "DREAM", ALT("ABOUT", "OF"), W(0)], idx: 0, reassemblies: [
        "Really, {3}?",
        "Have you ever fantasized {3} while you were awake?",
        "Have you dreamt {3} before?",
      ] },
      { pattern: [W(0)], idx: 0, reassemblies: [
        "What does that dream suggest to you?",
        "Do you dream often?",
        "What persons appear in your dreams?",
        "Don't you believe that dream has something to do with your problem?",
      ] },
    ],
  },
  {
    triggers: ["EVERYONE", "EVERYBODY", "NOBODY", "NOONE", "EVERYTHING", "NOTHING", "ALWAYS"], rank: 2,
    decomps: [
      { pattern: [W(0), ALT("EVERYONE", "EVERYBODY"), W(0)], idx: 0, reassemblies: [
        "Really, {2}?",
        "Surely not {2}.",
        "Can you think of anyone in particular?",
        "Who, may I ask?",
        "Someone special perhaps?",
        "You have a particular person in mind, don't you?",
      ] },
      { pattern: [W(0), ALT("NOBODY", "NOONE"), W(0)], idx: 0, reassemblies: [
        "Surely not everyone.",
        "Can you think of anyone in particular?",
      ] },
      { pattern: [W(0), "ALWAYS", W(0)], idx: 0, reassemblies: [
        "Can you think of a specific example?",
        "When?",
        "What incident are you thinking of?",
        "Really, always?",
      ] },
      { pattern: [W(0)], idx: 0, reassemblies: ["Can you think of a specific example?", "When?"] },
    ],
  },
  {
    triggers: ["ALIKE", "SAME", "LIKE"], rank: 10,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "In what way?",
      "What resemblance do you see?",
      "What other connections do you see?",
      "What do you suppose that resemblance means?",
      "What is the connection, do you suppose?",
      "Could there really be some connection?",
      "How?",
    ] }],
  },
  {
    triggers: ["NAME", "NAMES", "NAMED"], rank: 15,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "I am not interested in names.",
      "I've told you before, I don't care about names — please continue.",
    ] }],
  },
  {
    triggers: ["COMPUTER", "COMPUTERS", "MACHINE", "MACHINES"], rank: 50,
    decomps: [{ pattern: [W(0), ALT("COMPUTER", "COMPUTERS", "MACHINE", "MACHINES"), W(0)], idx: 0, reassemblies: [
      "Do computers worry you?",
      "Why do you mention computers?",
      "What do you think machines have to do with your problem?",
      "Don't you think computers can help people?",
      "What about machines worries you?",
    ] }],
  },
  {
    triggers: ["DEUTSCH", "FRANCAIS", "ITALIANO", "ESPANOL"], rank: 50,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: ["I am sorry, I speak only English."] }],
  },
  {
    triggers: ["HELLO", "HI"], rank: 0,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: ["How do you do. Please state your problem."] }],
  },
  {
    triggers: ["I"], rank: 0,
    decomps: [
      { pattern: [W(0), "YOU", ALT("WANT", "NEED"), W(0)], idx: 0, reassemblies: [
        "What would it mean to you if you got {3}?",
        "Why do you want {3}?",
        "Suppose you got {3} soon.",
        "What if you never got {3}?",
        "What would getting {3} mean to you?",
      ] },
      { pattern: [W(0), "YOU", ALT("ARE", "WERE"), W(0)], idx: 0, reassemblies: [
        "Did you come to me because you are {3}?",
        "How long have you been {3}?",
        "Do you believe it is normal to be {3}?",
        "Do you enjoy being {3}?",
      ] },
      { pattern: [W(0), "YOU", "CAN", "NOT", W(0)], idx: 0, reassemblies: [
        "How do you know you can't {2}?",
        "Have you tried?",
        "Perhaps you could {2} now.",
        "Do you really want to be able to {2}?",
      ] },
      { pattern: [W(0), "YOU", "FEEL", "LIKE", W(0)], idx: 0, reassemblies: [
        "Why do you feel like {2}?",
        "What would it take to not feel like {2}?",
        "How long have you felt like {2}?",
      ] },
      { pattern: [W(0), "YOU", "FEEL", W(0)], idx: 0, reassemblies: [
        "Do you often feel {2}?",
        "Do you enjoy feeling {2}?",
        "Of what does feeling {2} remind you?",
      ] },
      { pattern: [W(0), "YOU", "HAVE", "BEEN", W(0)], idx: 0, reassemblies: [
        "How long have you been {2}?",
        "What changed?",
        "What was different before you were {2}?",
      ] },
      { pattern: [W(0), "YOU", W(0)], idx: 0, reassemblies: [
        "Can you elaborate on that?",
        "Do you say that for some special reason?",
        "That's quite interesting.",
        "Please go on.",
        "I see.",
      ] },
    ],
  },
  {
    triggers: ["YOU"], rank: 0,
    decomps: [{ pattern: [W(0), "I", W(0)], idx: 0, reassemblies: [
      "We were discussing you, not me.",
      "Why do you say I?",
      "What answer would please you most?",
      "What do you think?",
      "What comes to mind when you ask that?",
      "Have you asked such a question before?",
      "Have you asked anyone else?",
    ] }],
  },
  {
    triggers: ["WHY"], rank: 0,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "Why don't you tell me the real reason?",
      "Does that reason seem to explain anything else?",
      "What other reasons come to mind?",
    ] }],
  },
  {
    triggers: ["HOW", "WHAT"], rank: 0,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "Why do you ask?",
      "Does that question interest you?",
      "What is it you really want to know?",
      "Are such questions much on your mind?",
      "What answer would please you most?",
    ] }],
  },
  {
    triggers: ["BECAUSE"], rank: 0,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "Is that the real reason?",
      "Don't any other reasons come to mind?",
      "Does that reason seem to explain anything else?",
      "What other reasons might there be?",
    ] }],
  },
  {
    triggers: ["YES"], rank: 0,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "You seem quite positive.",
      "You are sure?",
      "I see.",
      "I understand.",
    ] }],
  },
  {
    triggers: ["NO"], rank: 0,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "Are you saying no just to be negative?",
      "You are being a bit negative.",
      "Why not?",
      "Why 'no'?",
    ] }],
  },
  {
    triggers: ["MAYBE", "PERHAPS"], rank: 0,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "You don't seem quite certain.",
      "Why the uncertain tone?",
      "Can't you be more positive?",
      "You aren't sure?",
      "Don't you know?",
    ] }],
  },
  {
    triggers: ["BELIEVE", "FEEL", "THINK", "WISH"], rank: 0,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "Do you feel strongly about discussing such things?",
      "Perhaps you don't want to feel that.",
      "Why the uncertain tone?",
      "Do you really think so?",
    ] }],
  },
  {
    triggers: ["BUT", "HOWEVER"], rank: 1,
    decomps: [{ pattern: [W(0), ALT("BUT", "HOWEVER"), W(0)], idx: 0, reassemblies: [
      "You say 'but' — what's the reservation?",
      "What comes after that 'but' that worries you?",
      "Is that a real objection, or a habit?",
      "What would you say if you dropped the 'but'?",
    ] }],
  },
  {
    triggers: ["LOVE", "LOVES", "LOVED"], rank: 2,
    decomps: [
      { pattern: [W(0), "YOU", "LOVE", W(0)], idx: 0, reassemblies: [
        "What do you love about {2}?",
        "How long have you loved {2}?",
        "Does loving {2} make you happy?",
        "Have you told {2} that?",
      ] },
      { pattern: [W(0)], idx: 0, reassemblies: [
        "Tell me more about that love.",
        "Love is complicated, isn't it?",
        "What does love mean to you?",
      ] },
    ],
  },
  {
    triggers: ["HATE", "HATES", "HATED"], rank: 2,
    decomps: [
      { pattern: [W(0), "YOU", "HATE", W(0)], idx: 0, reassemblies: [
        "Why do you hate {2}?",
        "What is it about {2} that bothers you so much?",
        "Has hating {2} always felt this way?",
      ] },
      { pattern: [W(0)], idx: 0, reassemblies: [
        "That's strong language. What's behind it?",
        "Hate takes a lot of energy. What's it protecting you from?",
      ] },
    ],
  },
  {
    triggers: ["AFRAID", "SCARED", "TERRIFIED", "FEAR", "SCARY"], rank: 3,
    decomps: [
      { pattern: [W(0), ALT("AFRAID", "SCARED", "TERRIFIED"), "OF", W(0)], idx: 0, reassemblies: [
        "What is it about {3} that frightens you?",
        "How long have you been afraid of {3}?",
        "Do you think {3} could really hurt you?",
      ] },
      { pattern: [W(0)], idx: 0, reassemblies: [
        "What are you afraid of, exactly?",
        "Fear can be very revealing.",
        "Does that fear stop you from doing something?",
      ] },
    ],
  },
  {
    triggers: ["ANGRY", "MAD", "FURIOUS", "ANNOYED", "IRRITATED"], rank: 2,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "What makes you feel that way?",
      "Is it really anger, or something else underneath?",
      "Who or what triggered that?",
      "Does staying angry help?",
    ] }],
  },
  {
    triggers: ["HAPPY", "GLAD", "EXCITED"], rank: 0,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "What's making you feel that way?",
      "It's good to hear that.",
      "Do you often feel this way?",
    ] }],
  },
  {
    triggers: ["GUILTY", "GUILT", "ASHAMED"], rank: 3,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "Why do you feel guilty?",
      "Guilt can be a heavy thing to carry.",
      "What would it take for you to forgive yourself?",
    ] }],
  },
  {
    triggers: ["LONELY", "ALONE"], rank: 3,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "How long have you felt this way?",
      "What does being alone feel like for you?",
      "Do you feel this way even when you're around others?",
    ] }],
  },
  {
    triggers: ["TIRED", "EXHAUSTED"], rank: 2,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "What's been wearing you out?",
      "Have you been sleeping well?",
      "Everyone needs rest sometimes.",
    ] }],
  },
  {
    triggers: ["WORK", "JOB", "BOSS", "CAREER"], rank: 2,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "Tell me more about your work.",
      "Does your job make you feel this way?",
      "What's your relationship with your boss like?",
    ] }],
  },
  {
    triggers: ["SCHOOL", "COLLEGE", "CLASS", "STUDY", "STUDIES"], rank: 2,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "How is school going?",
      "Does studying stress you out?",
      "Tell me about your classes.",
    ] }],
  },
  {
    triggers: ["RELATIONSHIP", "BOYFRIEND", "GIRLFRIEND", "MARRIAGE", "DIVORCE", "PARTNER"], rank: 2,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "Tell me more about your relationship.",
      "How long have you been together?",
      "Does your partner know how you feel?",
    ] }],
  },
  {
    triggers: ["FRIEND", "FRIENDS"], rank: 0,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "Tell me about your friends.",
      "Do your friends know about this?",
      "What role do your friends play in this?",
    ] }],
  },
  {
    triggers: ["SICK", "ILL", "PAIN", "HURT"], rank: 3,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "How long have you been feeling this way?",
      "Have you seen someone about that?",
      "Does this happen often?",
    ] }],
  },
  {
    triggers: ["MONEY"], rank: 2,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "Does money worry you often?",
      "What about money concerns you most?",
      "Is this really about money, or something else?",
    ] }],
  },
  {
    triggers: ["DEATH", "DIE", "DYING", "DIED"], rank: 6,
    decomps: [{ pattern: [W(0)], idx: 0, reassemblies: [
      "That sounds like a heavy thing to think about.",
      "Would you like to talk more about that?",
      "What's brought this to mind?",
    ] }],
  },
  {
    triggers: ["SHOULD"], rank: 0,
    decomps: [
      { pattern: [W(0), "YOU", "SHOULD", W(0)], idx: 0, reassemblies: [
        "Says who?",
        "What would happen if you didn't {2}?",
        "Who decided you should {2}?",
      ] },
      { pattern: [W(0)], idx: 0, reassemblies: ["Says who?", "What would happen if you didn't?"] },
    ],
  },
];

const NONE_RESPONSES = [
  "Please go on.",
  "That's quite interesting.",
  "I see.",
  "I understand.",
  "Tell me more about that.",
  "Does talking about this bother you?",
  "What does that suggest to you?",
  "Go on.",
  "What does that tell you?",
  "How does that make you feel?",
  "Can you say more about that?",
];

const KEYWORD_LOOKUP = new Map();
for (const entry of KEYWORDS) {
  for (const t of entry.triggers) KEYWORD_LOOKUP.set(t, entry);
}

let memoryQueue = [];
let noneIdx = 0;

function findCandidates(tokens) {
  const seen = new Set();
  const candidates = [];
  for (const w of tokens) {
    const entry = KEYWORD_LOOKUP.get(w);
    if (entry && !seen.has(entry)) { seen.add(entry); candidates.push(entry); }
  }
  candidates.sort((a, b) => b.rank - a.rank);
  return candidates;
}

function respond(input) {
  const clauses = splitIntoClauses(input);
  let originalTokens = [];
  let candidates = [];
  for (const clause of clauses) {
    const toks = tokenize(clause);
    const cands = findCandidates(toks);
    if (cands.length) { originalTokens = toks; candidates = cands; break; }
  }
  if (!candidates.length && clauses.length) {
    originalTokens = tokenize(clauses[clauses.length - 1]);
  }
  const substituted = originalTokens.map((w) => PRONOUN_MAP[w] || w);

  for (const entry of candidates) {
    for (const decomp of entry.decomps) {
      const caps = matchPattern(substituted, decomp.pattern);
      if (!caps) continue;
      const reassembly = decomp.reassemblies[decomp.idx % decomp.reassemblies.length];
      decomp.idx++;
      if (decomp.memory) {
        const tpl = decomp.memoryTemplates[Math.floor(Math.random() * decomp.memoryTemplates.length)];
        memoryQueue.push(applyTemplate(tpl, caps));
        if (memoryQueue.length > 6) memoryQueue.shift();
      }
      return applyTemplate(reassembly, caps);
    }
  }
  if (memoryQueue.length && Math.random() < 0.6) return memoryQueue.shift();
  return NONE_RESPONSES[noneIdx++ % NONE_RESPONSES.length];
}

function resetEliza() {
  for (const entry of KEYWORDS) for (const d of entry.decomps) d.idx = 0;
  memoryQueue = [];
  noneIdx = 0;
}

// --- UI --------------------------------------------------------------------------------
const transcript = document.getElementById("transcript");
const form = document.getElementById("input-form");
const input = document.getElementById("input-text");
const restartBtn = document.getElementById("restart-btn");

function addMessage(text, who) {
  const div = document.createElement("div");
  div.className = "msg " + who;
  div.textContent = text;
  transcript.appendChild(div);
  transcript.scrollTop = transcript.scrollHeight;
  return div;
}

function startConversation() {
  transcript.textContent = "";
  resetEliza();
  addMessage("How do you do. Please tell me your problem.", "eliza");
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addMessage(text, "user");
  input.value = "";
  const typing = addMessage("…", "eliza typing");
  const delay = 450 + Math.random() * 550;
  setTimeout(() => {
    typing.remove();
    addMessage(respond(text), "eliza");
  }, delay);
});

restartBtn.addEventListener("click", startConversation);

startConversation();
