// OCR des PDF scannés (sans couche texte) : rendu des pages avec pdfjs + @napi-rs/canvas, lecture avec tesseract.js.
// Les modèles de langue (français) sont téléchargés une seule fois puis mis en cache dans data/tessdata.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

const CACHE = process.env.TESS_CACHE || join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'tessdata');
const SCALE = 2.2; // ~160 dpi : bon compromis précision / vitesse

let deps;
async function load() {
  if (deps !== undefined) return deps;
  try {
    const [{ createWorker }, canvas, pdfjs] = await Promise.all([
      import('tesseract.js'), import('@napi-rs/canvas'), import('pdfjs-dist/legacy/build/pdf.mjs'),
    ]);
    deps = { createWorker, createCanvas: canvas.createCanvas, getDocument: pdfjs.getDocument };
  } catch {
    deps = null;
  }
  return deps;
}

export async function ocrAvailable() {
  return !!(await load());
}

/** OCR d'un PDF scanné → texte (pages séparées par des sauts de ligne). */
export async function ocrPdf(buffer, onProgress = () => {}) {
  const d = await load();
  if (!d) throw new Error('OCR indisponible (tesseract.js / @napi-rs/canvas non installés)');
  await mkdir(CACHE, { recursive: true });
  const worker = await d.createWorker('fra', 1, { cachePath: CACHE, logger: () => {} });
  try {
    const doc = await d.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise;
    const out = [];
    for (let i = 1; i <= doc.numPages; i++) {
      onProgress(i - 1, doc.numPages);
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: SCALE });
      const canvas = d.createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
      const { data } = await worker.recognize(canvas.toBuffer('image/png'));
      out.push(data.text);
      page.cleanup();
    }
    onProgress(doc.numPages, doc.numPages);
    return out.join('\n');
  } finally {
    await worker.terminate();
  }
}
