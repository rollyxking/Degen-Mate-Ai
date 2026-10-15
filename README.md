# DegenMateCoin Meme Lab

React + Vite + TypeScript + Tailwind frontend, Node/Express backend.
Background scenes come from a hosted image service (**Pollinations**). Your real DegenMateCoin mascot is overlaid afterwards with `sharp`, so the AI never draws (or distorts) the mascot. No OpenAI key, no billing, no local model, no ComfyUI.

## How it works

1. You type a meme idea (it does not need to mention the coin) and press Generate (`POST /api/generate`, same as before). The server validates it (`server/src/idea.ts`): real text, 8-500 characters, no other coins, nothing clearly prohibited. There is no keyword requirement.
2. The backend builds a scene prompt (`enhanceIdea` in `server/src/prompt.ts`: your idea turned into a visual story with the kangaroo mascot's world and only the crypto-humour props that fit, plus the chosen style; deterministic, no extra AI call, no prices or promises) and requests one image per variation from Pollinations: `GET https://gen.pollinations.ai/image/{prompt}?model&width&height&seed` with your key in an `Authorization` header. The response body is the image itself, so there is no job polling.
3. The backend validates the bytes (must be a real PNG/JPEG/WebP), overlays `server/assets/coin-transparent.png`, and stores the result in the gallery.
4. Captions come from the built-in caption bank (or optional local Ollama) and are drawn in the browser, so spelling is always correct.

If the provider fails, the site shows a clear message. It never fakes an image and never falls back to a paid service.

## Provider: Pollinations

- Docs: https://gen.pollinations.ai/docs (OpenAPI docs also in https://github.com/pollinations/pollinations/blob/main/APIDOCS.md)
- **Account and key: required.** The current docs say endpoints need a key unless they state otherwise, and the image endpoint accepts `Authorization: Bearer <key>` or `?key=`. Create a free account and a **secret key (`sk_...`)** at https://enter.pollinations.ai/keys. Older guides that say "no key needed" describe an earlier anonymous mode that this app does not rely on.
- **Free allowance: not guaranteed or unlimited.** Usage is metered in the provider's credits ("pollen"). I could not confirm the exact free amount for new accounts; check your dashboard at enter.pollinations.ai. When it runs out the API answers HTTP 402, and the site shows "free generation allowance ... used up". HTTP 429 means you are going too fast.
- Only the documented parameters are used: `model`, `width`, `height`, `seed`. There is **no negative-prompt parameter**, so "no text / no logos" is phrased inside the prompt, and the model may still draw stray letters. That is why captions and the mascot are added separately.
- Uploading a reference image is no longer offered: the provider only accepts reference images as public URLs, and sending your visitors' files to a third party is not something this app does silently. "Variations" now reuses the idea and style of a meme.

## Setup (Windows PowerShell)

```powershell
cd C:\Users\hp\Downloads\degenmatecoin-meme-lab
npm run install:all
Copy-Item .env.example server\.env        # if server\.env exists, merge the new variables by hand
notepad server\.env                       # paste your sk_ key after POLLINATIONS_API_KEY=
npm run check:engine --prefix server      # confirms the key is configured (no network call, no quota used)
npm run check:engine --prefix server -- --generate   # renders ONE real test image to server\data\engine-test.png
npm run dev                               # website http://localhost:5173, API :8787
```

Production build and run: `npm run build` then `npm start` (the server also serves `client/dist`).

### Upgrading from the ComfyUI version

In `server\.env` delete every `COMFYUI_*` line, `MAX_UPLOAD_MB`, and (from the older OpenAI version) `IMAGE_API_KEY`, `IMAGE_API_BASE`, `IMAGE_MODEL`, `IMAGE_QUALITY`, `CAPTION_MODEL`, `COIN_MODE`, `COIN_DESCRIPTION`. Add the `POLLINATIONS_*` lines. Change `IMAGE_SIZE` / `ALLOWED_SIZES` to 1024-based sizes (e.g. `1024x1024,1024x768,768x1024`) because this model family works best around 1024 px. You can delete the old `ComfyUI` folder and models.

## Configuration (`server\.env`)

| Variable | Default | Meaning |
|---|---|---|
| `POLLINATIONS_API_KEY` | *(empty)* | **Required.** Secret `sk_` key. Server-only, never a `VITE_` variable |
| `POLLINATIONS_MODEL` | `tongyi-mai/z-image-turbo` | The provider's documented default. Live list: https://gen.pollinations.ai/image/models |
| `PROVIDER_TIMEOUT_SEC` | `90` | Per image |
| `PROVIDER_MAX_CONCURRENT` | `2` | Parallel calls to the provider |
| `MAX_QUEUED_JOBS` | `2` | Requests allowed to wait behind the running one |
| `IMAGE_SIZE`, `ALLOWED_SIZES` | `1024x1024`, `1024x1024,1024x768,768x1024` | Sizes users can pick (rounded to multiples of 16) |
| `MAX_IMAGES_PER_REQUEST` | `2` in the example | Counts 1, 2, 4, 8 up to this cap. Every image spends free allowance |
| `DAILY_QUOTA`, `RATE_LIMIT_PER_MIN` | `20`, `6` | Per visitor per day / per IP per minute. Lower them to protect your allowance |
| `ACCESS_CODE`, `PORT`, `DATA_DIR`, `OLLAMA_URL`, `OLLAMA_MODEL` | unchanged | |

Retries: only temporary errors (429/502/503/504) are retried, at most twice, and a second 429 stops immediately. 401, 402 and other errors are never retried.

## Troubleshooting

| Message in the site | What to do |
|---|---|
| The image provider requires configuration | Put `POLLINATIONS_API_KEY=sk_...` in `server\.env`, restart `npm run dev` |
| ...rejected the API key | Wrong or revoked key. Create a new `sk_` key |
| The free generation allowance ... used up (402) | Wait, check your balance at enter.pollinations.ai, or lower `DAILY_QUOTA` |
| The free generation limit has been reached (429) | Slow down; lower `PROVIDER_MAX_CONCURRENT` / `RATE_LIMIT_PER_MIN` |
| The image generation request timed out | Try again, or raise `PROVIDER_TIMEOUT_SEC` |
| The image service is temporarily unavailable | Provider side (5xx or network). Try again later |
| The generated image could not be retrieved | Provider returned something that is not an image |
| `Cannot GET /api/generate` | You opened the API URL in the browser. It only accepts POST from the site. Open http://localhost:5173 and make sure `npm run dev` runs both api and web |
| Official coin image missing | Keep `server/assets/coin.png` and `coin-transparent.png` |

Server details (never your key) are printed in the terminal running `npm run dev`.

## Deployment notes

- The backend stores memes in `server/data` (a JSON file plus image files) and runs as a long-lived Express server. That fits a host with a persistent disk (a VPS, or a container host with a volume). It does **not** fit Vercel serverless functions as-is, because local files do not persist there. A static Vite frontend on Vercel can call a backend hosted elsewhere, but then you must proxy `/api`, `/files` and `/brand` to it. Check your host's current limits before choosing.
- Keep the key in the host's secret/environment settings, never in the repository (`.env` is already git-ignored).
- A free hosted provider cannot promise unlimited images for every visitor. Public sites should keep `DAILY_QUOTA` low or set `ACCESS_CODE`.

## Changing provider later

All provider code is in `server/src/provider.ts` and exports `generateScene()`, `getEngine()` and `EngineError`. Implement those three for another service (for example Hugging Face Inference) and nothing else in the app changes. Settings live in `server/src/config.ts`.

## The official coin image

`server/assets/coin.png` is the untouched original; `coin-transparent.png` is the cutout overlaid on every meme (resized proportionally, slightly tilted, soft shadow; the artwork is never redrawn). To change the mascot, replace both PNGs (under 4 MB).

## Tests

```powershell
npm test --prefix server     # node:test via tsx: idea validation, prompt enhancement, and the API against a local mock provider (no key, no quota)
```
Client and server structural validation rules are kept identical (`client/src/lib/idea.ts` / `server/src/idea.ts`); a test checks they agree.
