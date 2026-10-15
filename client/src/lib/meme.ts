export type CaptionMode = 'top' | 'bottom' | 'both';
export interface CaptionOpts { top: string; bottom: string; mode: CaptionMode; fontSize: number; outline: boolean }

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []; let line = '';
  for (const w of text.toUpperCase().split(/\s+/).filter(Boolean)) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

// Renders the meme + captions. Captions are drawn here, never by the AI model.
export function drawMeme(canvas: HTMLCanvasElement, img: HTMLImageElement, o: CaptionOpts) {
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const fs = (canvas.width * o.fontSize) / 100, lh = fs * 1.05, pad = fs * 0.35;
  ctx.font = `900 ${fs}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
  ctx.lineWidth = fs / 6; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff';
  const paint = (lines: string[], y0: number) => lines.forEach((l, i) => {
    const y = y0 + i * lh;
    if (o.outline) ctx.strokeText(l, canvas.width / 2, y);
    ctx.fillText(l, canvas.width / 2, y);
  });
  const maxW = canvas.width * 0.94;
  if (o.mode !== 'bottom' && o.top.trim()) paint(wrap(ctx, o.top, maxW), pad);
  if (o.mode !== 'top' && o.bottom.trim()) {
    const lines = wrap(ctx, o.bottom, maxW);
    paint(lines, canvas.height - pad - lines.length * lh);
  }
}

export function download(href: string, name: string) {
  const a = document.createElement('a'); a.href = href; a.download = name; a.click();
}
export function canvasDownload(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', name: string) {
  canvas.toBlob((b) => { if (!b) return; const u = URL.createObjectURL(b); download(u, name); setTimeout(() => URL.revokeObjectURL(u), 2000); }, type, 0.92);
}
