// Words we leave untouched so the sentence keeps its grammatical scaffolding
// (articles, pronouns, prepositions, conjunctions, auxiliary/modal verbs, etc).
// Everything else is treated as a content word and swapped for a random slang
// term below, with its original suffix (-s, -ing, -ed, -er, -est, -ly) carried
// over so the replacement still agrees in tense/number with the rest of the
// sentence.
const FUNCTION_WORDS = new Set([
  "a", "an", "the",
  "and", "or", "but", "nor", "so", "yet", "for",
  "in", "on", "at", "by", "to", "of", "with", "from", "into", "onto", "upon",
  "over", "under", "about", "above", "below", "between", "among", "through",
  "during", "before", "after", "since", "until", "without", "within", "along",
  "across", "behind", "beyond", "near", "per", "via", "off", "out", "up", "down",
  "i", "you", "he", "she", "it", "we", "they",
  "me", "him", "her", "us", "them",
  "my", "your", "his", "its", "our", "their",
  "mine", "yours", "hers", "ours", "theirs",
  "this", "that", "these", "those",
  "who", "whom", "whose", "which", "what",
  "am", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did",
  "will", "would", "shall", "should", "can", "could", "may", "might", "must",
  "not", "no", "yes", "very", "too", "also", "just", "only", "even", "still",
  "than", "as", "if", "because", "while", "when", "where", "why", "how",
  "then", "there", "here", "now", "all", "some", "any", "each", "every",
  "don't", "won't", "can't", "isn't", "aren't", "wasn't", "weren't",
  "doesn't", "didn't", "wouldn't", "couldn't", "shouldn't",
  "let's", "it's", "that's", "there's",
]);

// Each entry's `base` is what fills in for a plain-form word (a bare noun,
// adjective, or infinitive verb). `forms` gives hand-picked irregular
// inflections where naive suffixing would look wrong (e.g. "mogging", not
// "moging"); anything left out falls back to `genericInflect`.
const SLANG_WORDS = [
  { base: "skibidi", forms: { plural: "skibidis", ing: "skibidifying", ed: "skibidified", er: "skibidier", est: "skibidiest", ly: "skibidily" } },
  { base: "ohio" },
  { base: "gyatt" },
  { base: "rizz", forms: { plural: "rizzes", ing: "rizzing", ed: "rizzed" } },
  { base: "sigma" },
  { base: "mew", forms: { ing: "mewing", ed: "mewed" } },
  { base: "mog", forms: { plural: "mogs", ing: "mogging", ed: "mogged" } },
  { base: "looksmax", forms: { ing: "looksmaxxing", ed: "looksmaxxed" } },
  { base: "aura" },
  { base: "npc" },
  { base: "brainrot" },
  { base: "cook", forms: { ing: "cooking", ed: "cooked" } },
  { base: "glaze", forms: { ing: "glazing", ed: "glazed" } },
  { base: "delulu" },
  { base: "goofy", forms: { ly: "goofily" } },
  { base: "cap", forms: { plural: "caps", ing: "capping", ed: "capped" } },
  { base: "bet" },
  { base: "slay", forms: { ing: "slaying", ed: "slayed" } },
  { base: "bussin" },
  { base: "mid" },
  { base: "sus" },
  { base: "lit" },
  { base: "fire" },
  { base: "gas" },
  { base: "drip", forms: { ing: "dripping", ed: "dripped" } },
  { base: "based" },
  { base: "periodt" },
  { base: "frfr" },
  { base: "simp", forms: { plural: "simps", ing: "simping", ed: "simped" } },
  { base: "stan", forms: { plural: "stans", ing: "stanning", ed: "stanned" } },
  { base: "clanker" },
];

// Multi-word / fixed expressions don't inflect — they only ever sub in for a
// content word already in its plain (base) form, never for a plural/-ing/-ed/
// -er/-est/-ly slot, so we never end up gluing a suffix onto a whole phrase.
const SLANG_PHRASES = [
  "no cap", "touch grass", "say less", "it's giving", "main character energy",
  "sending me", "glow up", "situationship", "beige flag", "fanum tax",
  "aura farming", "goofy ahh", "6-7", "ate and left no crumbs", "crash out",
  "W", "L",
];

const PHRASE_CHANCE = 0.3;

function genericInflect(base, form) {
  switch (form) {
    case "plural":
      return /s$/.test(base) ? base : base + "s";
    case "ing":
      return /e$/.test(base) && base !== "be" ? base.slice(0, -1) + "ing" : base + "ing";
    case "ed":
      if (/e$/.test(base)) return base + "d";
      if (/[^aeiou]y$/.test(base)) return base.slice(0, -1) + "ied";
      return base + "ed";
    case "er":
      return /e$/.test(base) ? base + "r" : base + "er";
    case "est":
      return /e$/.test(base) ? base + "st" : base + "est";
    case "ly":
      return base + "ly";
    default:
      return base;
  }
}

function inflect(entry, form) {
  if (form === "base") return entry.base;
  if (entry.forms && entry.forms[form]) return entry.forms[form];
  return genericInflect(entry.base, form);
}

function detectForm(lower) {
  if (/ing$/.test(lower)) return "ing";
  if (/ed$/.test(lower)) return "ed";
  if (/est$/.test(lower)) return "est";
  if (/er$/.test(lower)) return "er";
  if (/ly$/.test(lower)) return "ly";
  if (/s$/.test(lower) && !/ss$/.test(lower)) return "plural";
  return "base";
}

function matchCase(sample, word) {
  if (sample[0] === sample[0].toUpperCase() && sample[0] !== sample[0].toLowerCase()) {
    return word[0].toUpperCase() + word.slice(1);
  }
  return word;
}

function pickReplacement(form) {
  if (form === "base" && Math.random() < PHRASE_CHANCE) {
    return SLANG_PHRASES[Math.floor(Math.random() * SLANG_PHRASES.length)];
  }
  const entry = SLANG_WORDS[Math.floor(Math.random() * SLANG_WORDS.length)];
  return inflect(entry, form);
}

// Returns the replacement text plus whether a swap actually happened, so the
// caller can highlight it without having to re-guess from the output string
// (which would break now that the replacement pool isn't just one word).
function transformWord(word) {
  const lower = word.toLowerCase();
  if (FUNCTION_WORDS.has(lower)) return { text: word, replaced: false };
  const form = detectForm(lower);
  const replacement = pickReplacement(form);
  return { text: matchCase(word, replacement), replaced: true };
}

function skibidifyTokens(text) {
  const tokens = [];
  const re = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
  let lastIndex = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > lastIndex) tokens.push({ text: text.slice(lastIndex, m.index), replaced: false });
    tokens.push(transformWord(m[0]));
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex), replaced: false });
  return tokens;
}

const inputEl = document.getElementById("input-text");
const outputEl = document.getElementById("output-text");
const translateBtn = document.getElementById("translate-btn");
const copyBtn = document.getElementById("copy-btn");

function renderOutput(tokens) {
  outputEl.textContent = "";
  for (const token of tokens) {
    if (!token.text) continue;
    if (token.replaced) {
      const mark = document.createElement("mark");
      mark.textContent = token.text;
      outputEl.appendChild(mark);
    } else {
      outputEl.appendChild(document.createTextNode(token.text));
    }
  }
  copyBtn.disabled = false;
}

function runTranslation() {
  const value = inputEl.value.trim();
  if (!value) {
    outputEl.textContent = "";
    copyBtn.disabled = true;
    return;
  }
  renderOutput(skibidifyTokens(value));
}

translateBtn.addEventListener("click", runTranslation);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    runTranslation();
  }
});

copyBtn.addEventListener("click", () => {
  const text = outputEl.textContent;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const original = copyBtn.textContent;
    copyBtn.textContent = "✅ Copied";
    setTimeout(() => { copyBtn.textContent = original; }, 1200);
  });
});
