// Words we leave untouched so the sentence keeps its grammatical scaffolding
// (articles, pronouns, prepositions, conjunctions, auxiliary/modal verbs, etc).
// Everything else is treated as a content word and skibidi-fied, with its
// original suffix (-s, -ing, -ed, -er, -est, -ly) carried over so the
// replacement still agrees in tense/number with the rest of the sentence.
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

function matchCase(sample, word) {
  if (sample[0] === sample[0].toUpperCase() && sample[0] !== sample[0].toLowerCase()) {
    return word[0].toUpperCase() + word.slice(1);
  }
  return word;
}

function skibidifyWord(word) {
  const lower = word.toLowerCase();
  if (FUNCTION_WORDS.has(lower)) return word;

  let replacement;
  if (/ing$/.test(lower)) replacement = "skibidifying";
  else if (/ed$/.test(lower)) replacement = "skibidified";
  else if (/est$/.test(lower)) replacement = "skibidiest";
  else if (/er$/.test(lower)) replacement = "skibidier";
  else if (/ly$/.test(lower)) replacement = "skibidily";
  else if (/s$/.test(lower) && !/ss$/.test(lower)) replacement = "skibidis";
  else replacement = "skibidi";

  return matchCase(word, replacement);
}

function skibidify(text) {
  return text.replace(/[A-Za-z]+(?:'[A-Za-z]+)?/g, (word) => skibidifyWord(word));
}

const inputEl = document.getElementById("input-text");
const outputEl = document.getElementById("output-text");
const translateBtn = document.getElementById("translate-btn");
const copyBtn = document.getElementById("copy-btn");

function renderOutput(original, translated) {
  outputEl.textContent = "";
  if (!translated) return;
  // Highlight the skibidi words so it's easy to see what changed vs. what stayed put.
  const parts = translated.split(/(skibidi(?:fying|fied|est|ly|er|s)?)/i);
  for (const part of parts) {
    if (!part) continue;
    if (/^skibidi/i.test(part)) {
      const mark = document.createElement("mark");
      mark.textContent = part;
      outputEl.appendChild(mark);
    } else {
      outputEl.appendChild(document.createTextNode(part));
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
  renderOutput(value, skibidify(value));
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
