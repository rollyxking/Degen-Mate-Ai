// Meme-idea input rules. The server has an identical copy of the structural rules in server/src/idea.ts
// (a test asserts they agree). The server is authoritative: this only gives instant feedback in the form.
export const IDEA_MIN = 8;
export const IDEA_MAX = 500;

export function normalizeIdea(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Returns an error message, or null when the idea is structurally acceptable.
export function ideaProblem(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'Describe your meme idea in a few more words.';
  const t = normalizeIdea(raw);
  if (!t) return 'Describe your meme idea in a few more words.';
  if (t.length < IDEA_MIN) return 'Describe your meme idea in a few more words.';
  if (raw.length > IDEA_MAX * 2 || t.length > IDEA_MAX) return 'Keep the idea under 500 characters.';
  const letters = (t.match(/\p{L}/gu) ?? []).length;
  if (letters < 4 || letters / t.length < 0.4) return 'Please describe the idea with a few real words.';
  if (/(.)\1{9,}/u.test(t)) return 'Please describe the idea with a few real words.';
  return null;
}
