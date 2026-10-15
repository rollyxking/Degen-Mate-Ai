// Prompt building. The user's raw idea is validated in idea.ts, then turned here into a visual direction:
//   original idea  +  DegenMateCoin identity (kangaroo mascot world)  +  fitting crypto-community humour.
// The real mascot/coin is composited afterwards by pipeline.ts (the image provider only accepts reference images as public
// URLs, so it never "sees" the logo); the scene prompt therefore leaves clear room for it and never asks the model to draw it.
export const RESTRICTION =
  'The image must be an original meme about DegenMateCoin. Keep the humour, characters, visual story, and context connected to DegenMateCoin. ' +
  'Do not introduce unrelated cryptocurrency projects, competing token names, or unrelated branding. ' +
  'If a reference image is provided, use it as the primary visual reference where supported.';

// Short style tags appended to the scene prompt.
export const STYLES: Record<string, string> = {
  funny: 'comedic cartoon scene, exaggerated expressions, bright playful colors',
  relatable: 'everyday cozy scene, warm lighting, friendly cartoon style',
  'classic-degen': 'late night room, glowing monitors with charts, energy drinks, hoodie vibes, neon glow',
  community: 'group chat energy, friends gathered around screens, lively crowd, cartoon style',
  reaction: 'dramatic expressive close scene, strong emotion, simple clean background',
  cinematic: 'cinematic lighting, epic movie poster composition, volumetric light, dramatic sky',
  wholesome: 'warm sunny scene, soft pastel colors, happy celebration, confetti',
  absurd: 'surreal absurd scene, bizarre floating objects, dreamlike, deadpan composition',
};

// Different composition each time, so memes don't share one layout.
const VARIATIONS = [
  'wide establishing shot', 'dramatic low angle', 'golden hour lighting', 'neon night lighting',
  'top-down view', 'dutch angle', 'symmetrical composition', 'shallow depth of field',
];

// Pollinations' image endpoint has no documented negative-prompt parameter, so the "avoid" list is phrased positively and kept short.
const AVOID = 'no text, no letters, no numbers, no watermark, no logos, no coins';

// ---------------------------------------------------------------- idea clean-up
const BRAND_WORDS = /degen\s*mate\s*(coin)?|\bdmc\b/gi;
// Prices, multiples, percentages and promises are never carried into the picture (no invented financial claims).
const FINANCIAL = /(\$\s?\d[\d,.]*\s?[kmb]?|\b\d[\d,.]*\s?(x|%|usd|dollars?)\b|\b(guaranteed|risk[- ]free|financial advice|to the moon at)\b|\b(listed on|listing on|partnership with|partnered with|endorsed by)\b[^,.;]*)/gi;

/** Brand/finance-safe, third-person version of the idea for an image model that does not know the brand. */
export function sceneIdea(idea: string): string {
  const t = idea
    .replace(BRAND_WORDS, ' ')
    .replace(FINANCIAL, ' ')
    .replace(/\b(a |an )?(funny |classic )?meme (about|of|where|showing)\b/gi, ' ')
    .replace(/\bdegens?\b/gi, 'wild trader')
    .replace(/\byourself\b|\bmyself\b/gi, 'themselves')
    .replace(/\b(me|i|you)\b/gi, (_m, _w, off: number, str: string) => (/\b(me|i|you)\b/i.test(str.slice(0, off)) ? 'they' : 'the main character'))
    .replace(/\b(my|your)\b/gi, 'their')
    .replace(/\b(we|us)\b/gi, 'the group')
    .replace(/\bour\b/gi, 'their')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '')
    .slice(0, 200);
  return t.length >= 3 ? t : 'a cheerful crypto community moment';
}

// ---------------------------------------------------------------- themes
interface Theme { id: string; test: RegExp; story: string; props: string; mood: string }

// Ordered by priority. Only the (up to two) themes that actually match the idea are used, so not every crypto cliche lands in every image.
const THEMES: Theme[] = [
  { id: 'dip', test: /\b(dip|dips|crash\w*|red|panic\w*|bear|dump\w*|sell\w*|storm|rough|volatil\w*|calm)\b/i,
    story: 'one character stays comically calm and unbothered in the middle of chaos while everyone and everything around panics',
    props: 'swirling storm of red downward arrows and falling red candlestick shapes, flailing background characters',
    mood: 'calm smug face versus wild panic' },
  { id: 'diamond', test: /\b(diamond|hodl\w*|hold(ing)?|refus\w* to sell|never sell)\b/i,
    story: 'a determined character grips a huge sparkling diamond with both hands and will not let go',
    props: 'sparkling diamond, white-knuckled grip, light rays',
    mood: 'fierce determination' },
  { id: 'waiting', test: /\b(wait\w*|patien\w*|anticipat\w*|next (big )?move|any (minute|moment|day)|soon|edge of)\b/i,
    story: 'characters sit tensely on the very edge of their seats staring at a huge glowing screen in the distance, wide-eyed and comically impatient',
    props: 'distant giant glowing chart screen, tapping feet, nibbled nails, a wall clock, snack bowls half empty',
    mood: 'exaggerated suspense and anticipation' },
  { id: 'checking', test: /\b(check\w*|refresh\w*|portfolio|phone|screens?|charts?|again|every (five|\w+) minutes?)\b/i,
    story: 'an anxious character glances at a glowing phone again and again, shown as several overlapping ghost-copies of the same glance to show repetition',
    props: 'glowing phone, tiny red-and-green candlestick glow on their face, heaps of used coffee cups, clock hands spinning',
    mood: 'nervous compulsive energy' },
  { id: 'mocked', test: /\b(laugh\w*|friends?|obsess\w*|family|mock\w*|roast\w*|never stops|talk(s|ing)? about|annoy\w*|eye[- ]?roll\w*)\b/i,
    story: 'one enthusiastic character excitedly explains something while the friends around them laugh, smirk or roll their eyes',
    props: 'a table with drinks, a speech-bubble-shaped cloud with only little chart doodles in it, one friend facepalming',
    mood: 'affectionate teasing' },
  { id: 'celebrate', test: /\b(celebrat\w*|surviv\w*|made it|milestone|party|wins?|winning|squad|victory|cheers?|finally)\b/i,
    story: 'a happy squad cheers together, worn out but triumphant, hugging, high-fiving and tossing confetti',
    props: 'confetti, raised arms, a shared pie to split, tired but proud faces',
    mood: 'relieved joyful celebration' },
  { id: 'morning', test: /\b(wake\w*|morning|gm|sleep\w*|3 ?am|night|awake|alarm)\b/i,
    story: 'a sleepy character reaches for the phone before even opening their eyes',
    props: 'messy bed, alarm clock, glowing phone light on a sleepy face',
    mood: 'groggy habit' },
  { id: 'discover', test: /\b(discover\w*|new(comer)?|first time|learn\w*|find(s|ing)? out|heard about)\b/i,
    story: 'a surprised newcomer is being welcomed in by an eager, overly enthusiastic crowd',
    props: 'welcome mat, curious wide eyes, pointing friends',
    mood: 'bewildered curiosity' },
];

const GROUP = /\b(holders|community|squad|friends|everyone|crowd|group|team|we|us|members|people|they|everybody)\b/i;

export interface Enhanced {
  /** Human-readable creative brief (stored/logged, tested). Mentions the brand, so it is NOT sent to the image model verbatim. */
  direction: string;
  /** Compact scene description sent to the image model (brand-free, no text rendering, leaves room for the coin overlay). */
  scene: string;
  themes: string[];
}

const DIRECTION_PREFIX = 'Create a humorous DegenMateCoin community meme';

/**
 * Turns a plain meme idea into a branded visual direction. Pure and idempotent: feeding an already-enhanced direction back in
 * returns it unchanged, so branding is never stacked twice.
 */
export function enhanceIdea(idea: string): Enhanced {
  const clean = idea.replace(/\s+/g, ' ').trim();
  if (clean.startsWith(DIRECTION_PREFIX)) {
    return { direction: clean, scene: sceneIdea(clean), themes: [] };
  }
  const si = sceneIdea(clean);
  const matched = THEMES.filter((t) => t.test.test(si)).slice(0, 2);
  const group = GROUP.test(clean);
  const cast = group
    ? 'a small crowd of expressive cartoon kangaroo characters in neon yellow hi-vis safety vests, some with pink sunglasses'
    : 'one expressive cartoon kangaroo character in a neon yellow hi-vis safety vest and pink sunglasses';
  const story = matched.length
    ? matched.map((t) => t.story).join('; meanwhile ')
    : `a clear, funny, easy-to-read cartoon scene that literally acts out the situation`;
  const props = matched.map((t) => t.props).join(', ');
  const mood = matched.length ? matched.map((t) => t.mood).join(' and ') : 'big readable facial expressions and body language';

  const scene = [
    `${cast}, ${story}`,
    `the situation to show: ${si}`,
    props,
    mood,
  ].filter(Boolean).join('; ');

  const direction =
    `${DIRECTION_PREFIX} that shows this idea visually: "${si}". ` +
    `Scene: ${story}. Cast: ${cast}. Props: ${props || 'simple relevant props'}. Mood: ${mood}. ` +
    'Use expressive characters, cinematic lighting and playful internet-meme energy; show the joke instead of explaining it in text. ' +
    'Place the authentic DegenMateCoin coin mascot as a recognizable brand element in the foreground. ' +
    'Preserve the original joke and situation. Do not display invented prices, fabricated announcements, partnerships or guaranteed financial outcomes.';

  return { direction, scene, themes: matched.map((t) => t.id) };
}

// Appended AFTER the (length-capped) scene so it is never truncated: keeps the lower centre free for the composited mascot.
const COMPOSITION = 'characters and action kept in the upper two thirds of the frame, lower center foreground left as plain empty floor';

export function buildScenePrompt(idea: string, style: string, index: number): string {
  return [
    enhanceIdea(idea).scene.slice(0, 600),
    COMPOSITION,
    STYLES[style] ?? STYLES.funny,
    VARIATIONS[index % VARIATIONS.length],
    'vibrant purple and electric blue neon accents, highly detailed digital illustration, sharp focus, polished meme art',
    AVOID,
  ].join(', ');
}
