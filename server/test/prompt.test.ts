import test from 'node:test';
import assert from 'node:assert/strict';
import { enhanceIdea, buildScenePrompt, sceneIdea, STYLES } from '../src/prompt.js';
import { SLOTS, COIN_SCALE } from '../src/pipeline.js';
import { COIN_PATH, CUTOUT_PATH, loadCoin } from '../src/coin.js';

test('enhancement keeps the original meaning and adds a visual direction, not just a suffix', () => {
  const e = enhanceIdea('holders waiting for the next big move');
  assert.match(e.direction, /waiting for the next big move/);
  assert.match(e.direction, /DegenMateCoin/);
  assert.ok(e.themes.includes('waiting'));
  assert.match(e.scene, /edge of their seats/);
  assert.ok(e.direction.length > 300);
});
test('diamond hands + dip picks matching visuals only', () => {
  const e = enhanceIdea('diamond hands during a market dip');
  assert.deepEqual(e.themes.sort(), ['diamond', 'dip']);
  assert.match(e.scene, /sparkling diamond/); assert.match(e.scene, /calm/);
  assert.doesNotMatch(e.scene, /confetti|alarm clock/);
});
test('"me checking my portfolio every five minutes" becomes a phone-checking scene (first person -> character)', () => {
  const e = enhanceIdea('me checking my portfolio every five minutes');
  assert.ok(e.themes.includes('checking')); assert.match(e.scene, /phone/);
  assert.match(e.scene, /the main character checking their portfolio/);
  assert.match(e.scene, /one expressive cartoon kangaroo/); // single-person idea -> single character
});
test('group ideas get a crowd cast', () => {
  assert.match(enhanceIdea('the squad celebrating after surviving a rough week').scene, /small crowd/);
});
test('unseen idea with no crypto words still gets a usable scene and the situation preserved', () => {
  const e = enhanceIdea('a kangaroo trying to parallel park a pie truck');
  assert.match(e.scene, /parallel park a pie truck/); assert.deepEqual(e.themes, []);
  assert.match(e.scene, /literally acts out the situation/);
});
test('enhancement is idempotent: branding is not stacked on repeated enhancement', () => {
  const once = enhanceIdea('holders waiting for the next big move');
  const twice = enhanceIdea(once.direction);
  assert.equal(twice.direction, once.direction);
  assert.equal((twice.direction.match(/DegenMateCoin/g) ?? []).length, (once.direction.match(/DegenMateCoin/g) ?? []).length);
});
test('scene prompt never names the brand, other coins, or asks the model to render text/coins', () => {
  for (const idea of ['DegenMateCoin holders waiting for the next big move', 'dmc diamond hands']) {
    const p = buildScenePrompt(idea, 'funny', 0);
    assert.doesNotMatch(p, /degen\s*mate|dmc/i);
    assert.match(p, /no text, no letters, no numbers, no watermark, no logos, no coins/);
  }
});
test('financial claims are not carried into the picture', () => {
  const idea = 'holders celebrating DegenMateCoin hitting $1.50 and 100x guaranteed, listed on Binance, partnership with Nike';
  const s = sceneIdea(idea);
  assert.doesNotMatch(s, /\$|\b100x\b|guaranteed|listed on|partnership/i);
  const e = enhanceIdea(idea);
  assert.doesNotMatch(e.scene, /\$1\.50|100x|guaranteed|listed on|partnership/i);
  assert.match(e.direction, /Do not display invented prices, fabricated announcements, partnerships or guaranteed financial outcomes/);
});
test('prompt stays short enough for the GET-URL provider and works for every style/index', () => {
  const long = 'holders waiting '.repeat(30).slice(0, 500);
  for (const style of Object.keys(STYLES)) for (let i = 0; i < 8; i++) {
    const p = buildScenePrompt(long, style, i);
    assert.ok(encodeURIComponent(p).length < 3500, `${style}/${i}: ${encodeURIComponent(p).length}`);
  }
});
test('official coin assets exist, load, and the overlay keeps the coin inside the frame, below the main action', () => {
  const { coin, cutout } = loadCoin();
  assert.ok(coin.length > 1000 && cutout && cutout.length > 1000);
  assert.match(COIN_PATH, /assets[\\/]coin\.png$/); assert.match(CUTOUT_PATH, /coin-transparent\.png$/);
  for (const [W, H] of [[1024, 1024], [1024, 768], [768, 1024]]) for (const s of SLOTS) {
    const size = Math.min(W, H) * COIN_SCALE;
    assert.ok(s.x * W - size / 2 > -size * 0.1 && s.x * W + size / 2 < W * 1.0 + size * 0.1);
    assert.ok(s.y * H - size / 2 > H * 0.5, 'coin must not cover the upper half where characters are');
  }
});

test('regressions: empty-floor composition hint survives long ideas; "won\'t" is not a celebration; pronouns read naturally', () => {
  const long = 'holders waiting for something ' .repeat(17).slice(0, 500);
  assert.match(buildScenePrompt(long, 'funny', 0), /lower center foreground left as plain empty floor/);
  const e = enhanceIdea("when you promise yourself you won't check the charts again");
  assert.ok(!e.themes.includes('celebrate') && e.themes.includes('checking'));
  assert.match(sceneIdea("when you promise yourself you won't check the charts again"), /^when the main character promise themselves they won't check/);
});
