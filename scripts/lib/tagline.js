// Some older archive items carry the whole article in the abstract field. Keep only a short teaser.
const MAX = 240;

export function tagline(text) {
  if (typeof text !== 'string') return text;
  const t = text.trim();
  if (t.length <= MAX) return t;
  const head = t.slice(0, MAX);
  const sentenceEnd = Math.max(head.lastIndexOf('. '), head.lastIndexOf('? '), head.lastIndexOf('! '));
  if (sentenceEnd >= 60) return head.slice(0, sentenceEnd + 1);
  return `${head.slice(0, head.lastIndexOf(' ')).replace(/[\s,;:–—-]+$/, '')}…`;
}
