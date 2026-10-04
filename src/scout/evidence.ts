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
