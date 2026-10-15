import test from 'node:test';
import assert from 'node:assert/strict';
import { checkIdea, structuralProblem, IDEA_MAX } from '../src/idea.js';
import { ideaProblem } from '../../client/src/lib/idea.js';

const MUST_ACCEPT = [
  'holders waiting for the next big move',
  'diamond hands during a market dip',
  'when the market turns red but you refuse to sell',
  'me checking my portfolio every five minutes',
  'when your friends laugh at your crypto obsession',
  'the community waiting patiently for something exciting',
  'when everyone panics but you stay calm',
  'that one friend who never stops talking about crypto',
  'the squad celebrating after surviving a rough week',
  'when you promise yourself you won\'t check the charts again',
];
const NO_CRYPTO_WORDS = ['a cat refusing to get off the keyboard during a deadline', 'monday morning coffee machine breaks and everyone stares in horror'];
const UNSEEN = ['a kangaroo trying to parallel park a pie truck', 'the group chat at 3am after one sentence from the quiet guy'];

test('accepts every example idea (no keyword or token name required)', () => {
  for (const p of [...MUST_ACCEPT, ...NO_CRYPTO_WORDS, ...UNSEEN]) assert.equal(checkIdea(p).ok, true, p);
});
test('rejects empty and whitespace-only', () => {
  for (const p of ['', '   ', '\n\t  \n', '\u0000\u0001\u0002 ']) assert.equal(checkIdea(p).ok, false, JSON.stringify(p));
});
test('rejects too short / too long / gibberish', () => {
  assert.equal(checkIdea('hi').ok, false);
  const long = checkIdea('a'.repeat(IDEA_MAX + 1)); assert.equal(long.ok, false);
  assert.equal(checkIdea('word '.repeat(IDEA_MAX)).ok, false);
  assert.equal(checkIdea('!!!!!!!!!!!!!!!!').ok, false);
  assert.equal(checkIdea('12345678 9012345 6789').ok, false);
  assert.equal(checkIdea('aaaaaaaaaaaaaaaaaaaa').ok, false);
  assert.equal(checkIdea('x'.repeat(IDEA_MAX)).ok, false); // repeated-character spam at exactly the limit
});
test('accepts exactly the max length of real words', () => {
  const t = ('holders wait ').repeat(60).slice(0, IDEA_MAX);
  assert.equal(checkIdea(t).ok, true);
});
test('rejects non-string payload values', () => {
  for (const v of [undefined, null, 42, true, {}, [], ['holders waiting'], { toString: () => 'holders waiting for it' }]) assert.equal(checkIdea(v).ok, false);
});
test('existing policy kept: other coins rejected with 422 off_topic', () => {
  const r = checkIdea('holders waiting while dogecoin pumps');
  assert.deepEqual(r.ok ? null : [r.code, r.status], ['off_topic', 422]);
});
test('clearly prohibited content rejected, ordinary degen humour is not', () => {
  for (const p of ['explicit porn scene with the mascot', 'a guide to kill yourself after the dip', 'guaranteed profit for every holder']) {
    const r = checkIdea(p); assert.equal(r.ok, false, p); if (!r.ok) assert.equal(r.code, 'prohibited');
  }
  for (const p of ['me getting absolutely rekt and dead inside', 'killing it after the dip with a smug face', 'the market is a bloodbath and I am calm']) assert.equal(checkIdea(p).ok, true, p);
});
test('returns the normalized idea (control chars and whitespace collapsed)', () => {
  const r = checkIdea('  holders\u0000   waiting\n\nfor the move ');
  assert.ok(r.ok && r.idea === 'holders waiting for the move');
});
test('frontend and backend structural rules agree', () => {
  const samples = [...MUST_ACCEPT, '', '   ', 'hi', 'a'.repeat(501), 'a'.repeat(500), '!!!!!!!!!!!!', 'aaaaaaaaaaaaaaa', 'word '.repeat(200), 'ok fine idea here', '1234 5678 9999', '\u0000\u0001 holders waiting', '猫が机の上で寝ている面白いシーン'];
  for (const s of samples) assert.equal(ideaProblem(s), structuralProblem(s), JSON.stringify(s.slice(0, 30)));
});
