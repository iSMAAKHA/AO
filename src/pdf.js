import { readFile } from 'node:fs/promises';

let pdfjs;
async function lib() {
  pdfjs ??= await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
}

/** Extrait le texte d'un PDF (couche texte). Retourne { text, pages, chars }. */
export async function extractPdfText(buffer) {
  const { getDocument } = await lib();
  const doc = await getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = '';
    let lastY = null;
    for (const it of content.items) {
      if (!('str' in it)) continue;
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 3) { out.push(line); line = ''; }
      line += (line && !line.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '') + it.str;
      lastY = y;
    }
    if (line) out.push(line);
    out.push('');
  }
  const text = out.join('\n');
  return { text, pages: doc.numPages, chars: text.replace(/\s/g, '').length };
}

export async function extractPdfFile(path) {
  return extractPdfText(await readFile(path));
}
