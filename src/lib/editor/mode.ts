/*
 * Quick or thorough: the editor picks how hard the agent thinks per request.
 * Small, pointed edits (a word, a label, a typo, "shorter") go fast at low
 * reasoning effort; anything structural gets the full treatment. When in
 * doubt it is thorough: a slow right answer beats a fast wrong one.
 */
export type Mode = "quick" | "deep";

const DEEP =
  /\b(add|new|create|insert|section|page|layout|redesign|design|move|reorder|column|grid|component|restructure|reorganis|reorganiz|navigation|menu|footer|header|style|colou?r|font|animation|responsive|mobile|table|chart|form|template|every|all pages|throughout|whole site)\b/i;
const QUICK =
  /\b(typo|spelling|spell|rename|reword|wording|word|title|heading|headline|label|caption|button text|link text|date|deadline|number|figure|amount|shorter|longer|shorten|capitali[sz]e|punctuation|fix the text|change (the )?(text|copy)|alt text|replace (this )?image)\b/i;

export function chooseMode(text: string, hasSelection: boolean): Mode {
  const t = text.trim();
  if (t.length > 280) return "deep";
  if (DEEP.test(t)) return "deep";
  if (QUICK.test(t)) return "quick";
  if (hasSelection && t.length < 120) return "quick";
  return "deep";
}
