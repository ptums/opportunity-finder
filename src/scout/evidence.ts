// Evidence checks for model judgments (ADR-003): every gate and score must cite a verbatim
// quote from the post, and reasons that parrot the rubric are counted, not trusted.

const MIN_WORDS = 4;
const MAX_WORDS = 25;
const ECHO_NGRAM = 5;

/**
 * Lowercase and keep only letters, digits, $ and %; everything else (quote characters, list
 * bullets, dashes, punctuation) becomes a space, then whitespace collapses. Peter approved
 * ignoring punctuation on 2026-10-04 after the Haiku smoke test (ADR-003 amendment).
 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}$%]+/gu, " ")
    .trim();
}

// One trailing artifact: an HTML-ish tag, a brace, or a stray quote mark / comma / space.
const TRAILING_ARTIFACT = /(<\/?[a-z]+\s*\/?>|[{}]|["'`,\s])$/i;

/**
 * Strip markup that Sonnet sometimes appends to otherwise verbatim strings ("…month.</br>",
 * "…housing.}"). Only trailing artifacts are removed, and a tag or brace is kept if the post
 * itself contains it. The words that remain must still match the post, so invented or
 * reworded quotes still fail. Peter chose this on 2026-10-04 (ADR-003 amendment).
 */
export function stripTrailingArtifacts(text: string, sourceText: string): { text: string; stripped: boolean } {
  let out = text;
  for (;;) {
    const m = out.match(TRAILING_ARTIFACT);
    if (!m) break;
    const token = m[1]!;
    const markup = /[<>{}]/.test(token);
    if (markup && sourceText.includes(token)) break;
    out = out.slice(0, -token.length);
  }
  const kept = out.trimEnd();
  // Only braces and tags count as an artifact; trailing spaces, quotes and commas are ignored anyway.
  const stripped = /[<>{}]/.test(text.slice(kept.length));
  return { text: stripped ? kept : text, stripped };
}

export type QuoteCheck = { valid: true } | { valid: false; why: "empty" | "too short" | "too long" | "not in post" };

/** A quote is valid when it is 4–25 words and a normalized substring of the text the model saw. */
export function checkQuote(quote: string, sourceText: string): QuoteCheck {
  const q = normalizeForMatch(quote);
  if (!q) return { valid: false, why: "empty" };
  const words = q.split(" ").length;
  if (words < MIN_WORDS) return { valid: false, why: "too short" };
  if (words > MAX_WORDS) return { valid: false, why: "too long" };
  return normalizeForMatch(sourceText).includes(q) ? { valid: true } : { valid: false, why: "not in post" };
}

const words = (text: string): string[] =>
  text.toLowerCase().replace(/[^a-z0-9$ ]+/g, " ").split(/\s+/).filter(Boolean);

function ngrams(text: string, n: number): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

/** Returns a checker: true when a reason shares any 5-word sequence with the prompt. */
export function rubricEchoChecker(prompt: string): (reason: string) => boolean {
  const promptGrams = ngrams(prompt, ECHO_NGRAM);
  return (reason) => [...ngrams(reason, ECHO_NGRAM)].some((g) => promptGrams.has(g));
}
