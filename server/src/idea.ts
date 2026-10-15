// Validation of the user's meme idea. Replaces the old keyword gate ("must mention degen / holder / chart ...").
//
// Policy: ANY ordinary, relatable idea is accepted, because the enhancement step (prompt.ts) is what turns it into a
// DegenMateCoin meme. The only things refused are:
//   - empty / too short / too long / non-text / gibberish input   (structural, mirrored by client/src/lib/idea.ts)
//   - ideas about OTHER coins or projects                          (existing brand policy, kept)
//   - clearly prohibited content (sexual, minors, hate, graphic violence, self-harm, doxxing/targeting)
// Keep the structural part in sync with client/src/lib/idea.ts (server/test/idea.test.ts checks parity).

export const IDEA_MIN = 8;
export const IDEA_MAX = 500;

export function normalizeIdea(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function structuralProblem(raw: unknown): string | null {
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

// Existing policy: this lab is only for DegenMateCoin.
const COMPETITORS = /\b(bitcoin|btc|ethereum|eth|dogecoin|doge|shib|shiba|pepe|solana|sol|bonk|xrp|ripple|cardano|litecoin|bnb|tether|usdt|wif|floki)\b/i;

// Conservative blocklist for clearly prohibited content. Deliberately narrow so normal degen humour
// (panic, "rekt", "dead", "killing it") is never refused. Extend as needed.
const PROHIBITED: [RegExp, string][] = [
  [/\b(nude|naked|porn\w*|nsfw|sex(ual|ually)?|erotic|fetish|genitals?|topless|onlyfans)\b/i, 'sexual content'],
  [/\b(child|kid|minor|underage|teen(ager)?|schoolgirl|schoolboy)s?\b[^.]{0,40}\b(sex\w*|nude|naked|porn\w*)\b/i, 'sexual content involving minors'],
  [/\b(n[i1]gg(er|a)s?|f[a4]gg?(ot)?s?|k[i1]ke|sp[i1]cs?|ch[i1]nks?|tr[a4]nn(y|ies))\b/i, 'hateful language'],
  [/\b(kill|murder|shoot|stab|behead|lynch|bomb)\b[^.]{0,30}\b(them|him|her|everyone|people|jews|muslims|christians|blacks|whites|gays|immigrants)\b/i, 'violence against people'],
  [/\b(gore|dismember\w*|mutilat\w*|decapitat\w*)\b/i, 'graphic violence'],
  [/\b(suicide|kill myself|kill yourself|kys|self[- ]?harm|cut myself)\b/i, 'self-harm'],
  [/\b(home address|phone number|social security|ssn|credit card number|doxx?\w*)\b/i, 'personal information'],
  [/\b(guaranteed|risk[- ]free)\b[^.]{0,30}\b(profit|returns?|gains?|money)\b/i, 'investment promises'],
];

export type IdeaCheck = { ok: true; idea: string } | { ok: false; code: 'invalid' | 'off_topic' | 'prohibited'; status: number; message: string };

export function checkIdea(raw: unknown): IdeaCheck {
  const problem = structuralProblem(raw);
  if (problem) return { ok: false, code: 'invalid', status: 400, message: problem };
  const idea = normalizeIdea(raw as string);
  if (COMPETITORS.test(idea)) {
    return { ok: false, code: 'off_topic', status: 422, message: 'This lab is only for DegenMateCoin. Please rewrite your idea without other coins or projects.' };
  }
  const bad = PROHIBITED.find(([re]) => re.test(idea));
  if (bad) {
    return { ok: false, code: 'prohibited', status: 422, message: `This idea can't be used because it involves ${bad[1]}. Please try a different meme idea.` };
  }
  return { ok: true, idea };
}
