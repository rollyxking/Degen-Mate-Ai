// Local caption generation. Default: built-in caption bank (instant, no network).
// Optional: a local Ollama model if OLLAMA_URL is set. Nothing here calls an external service.
import { randomInt } from 'node:crypto';
import { config } from './config.js';
import { RESTRICTION } from './prompt.js';

export interface Caption { top: string; bottom: string }
const P = (top: string, bottom: string): Caption => ({ top, bottom });

const BY_TOPIC: [RegExp, Caption[]][] = [
  [/moon|rocket|launch|pump/i, [P('Me: I will only check the chart once', 'Also me: 400 checks later'), P('Rocket fuelled, snacks packed', 'Brain not included'), P('Houston, we have a degen', 'And he brought a pie')]],
  [/crash|dip|red|survive|bear/i, [P('Market dips 10%', 'Kangaroo: still hopping'), P('Everyone panicking', 'Me, vest on, calm as ever'), P('It is not a bear market', 'It is a character building market')]],
  [/bull|green|celebrat|milestone|party/i, [P('Community hits a milestone', 'Pie for everyone'), P('Timeline when the chart goes green', 'Everyone is a genius again'), P('We did it, team', 'Now back to refreshing')]],
  [/sunglasses|cool|shades/i, [P('Deal with it', 'Said the kangaroo in pink shades'), P('Sunglasses on', 'Problems off')]],
  [/wait|waiting|patience|next big move/i, [P('Waiting for the next big move', 'Staring contest with the chart'), P('Patience level: kangaroo', 'Snacks level: critical')]],
  [/timeline|wake|morning|gm\b/i, [P('Wakes up', 'Checks the timeline before opening eyes'), P('GM to everyone', 'Except the alarm clock')]],
  [/discover|new|first time|reaction/i, [P('Friend finds out about us', 'Welcome to the pie club'), P('When someone says', '"What is DegenMateCoin?" and you have 3 hours of lore')]],
];

const BY_STYLE: Record<string, Caption[]> = {
  funny: [P('I said one more minute', 'That was three hours ago'), P('Plan: sleep early', 'Reality: one more chart')],
  relatable: [P('Me pretending I am not checking', 'Phone in hand, screen on'), P('Group chat at 3 AM', 'Somehow everyone is awake')],
  'classic-degen': [P('Certified degen starter pack', 'Hoodie, energy drink, zero chill'), P('Sleep is for the weak', 'Charts are for the brave')],
  community: [P('Inside joke number 47', 'You had to be there'), P('Community member', 'Posts one meme, starts a movement')],
  reaction: [P('When the timeline says', 'Exactly what you hoped'), P('My face when', 'The pie arrives')],
  cinematic: [P('In a world of charts', 'One kangaroo stands tall'), P('Coming soon to your timeline', 'A hero in hi-vis')],
  wholesome: [P('Good vibes only', 'Pie for everyone'), P('Be kind to your fellow holder', 'We are all just hopping along')],
  absurd: [P('Why is there a pie', 'Nobody knows, nobody asks'), P('The kangaroo has seen things', 'And still brought snacks')],
};

const GENERAL: Caption[] = [
  P('Hi-vis vest on', 'Ready for anything'), P('Just a kangaroo with a pie', 'Living the dream'),
  P('Not financial advice', 'Just vibes and a pie'), P('Hop first', 'Ask questions never'), P('This is fine', 'Probably'),
];

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = randomInt(i + 1); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

function fromBank(idea: string, style: string, n: number): Caption[] {
  const topical = BY_TOPIC.filter(([re]) => re.test(idea)).flatMap(([, c]) => c);
  const pool = [...shuffle(topical), ...shuffle(BY_STYLE[style] ?? BY_STYLE.funny), ...shuffle(GENERAL)];
  const out: Caption[] = [];
  for (let i = 0; i < n; i++) out.push(pool[i % pool.length]);
  return out;
}

const LOOPBACK = ['127.0.0.1', 'localhost', '::1'];
function ollamaAllowed(): boolean {
  if (!config.ollamaUrl) return false;
  try { return LOOPBACK.includes(new URL(config.ollamaUrl).hostname.replace(/^\[|\]$/g, '')); } catch { return false; }
}

async function fromOllama(idea: string, style: string, n: number): Promise<Caption[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel, stream: false, format: 'json',
        messages: [
          { role: 'system', content: `You write short, funny classic top/bottom meme captions about DegenMateCoin (a kangaroo mascot in a hi-vis vest and pink sunglasses, holding a pie). ${RESTRICTION} Max 8 words per line. Never give financial advice. Never mention other coins.` },
          { role: 'user', content: `Idea: ${idea}\nTone: ${style}\nWrite ${n} different captions as JSON: {"captions":[{"top":"...","bottom":"..."}]}` },
        ],
      }),
    });
    const data: any = await res.json();
    const arr = JSON.parse(data.message.content).captions as Caption[];
    return arr.slice(0, n).map((c) => ({ top: String(c.top || '').slice(0, 80), bottom: String(c.bottom || '').slice(0, 80) }));
  } catch { return []; } finally { clearTimeout(timer); }
}

export async function generateCaptions(idea: string, style: string, n: number): Promise<Caption[]> {
  let out: Caption[] = [];
  if (ollamaAllowed()) out = await fromOllama(idea, style, n);
  if (out.length < n) out = [...out, ...fromBank(idea, style, n - out.length)];
  return out;
}
