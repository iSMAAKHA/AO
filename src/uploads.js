// Prépare les fichiers déposés : un ZIP de DCE est ouvert, les DOCX sont lus en texte, les PDF restent tels quels.
import JSZip from 'jszip';

const MAX_ENTRIES = 40, MAX_TOTAL = 200 * 1024 * 1024;

async function docxText(buf) {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) return '';
  return xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

/** @returns {Promise<Array<{originalname:string, buffer?:Buffer, text?:string}>>} */
export async function expandUploads(files) {
  const out = [];
  let total = 0;
  for (const f of files) {
    const name = f.originalname;
    if (/\.zip$/i.test(name)) {
      const zip = await JSZip.loadAsync(f.buffer);
      const entries = Object.values(zip.files).filter(e => !e.dir && /\.(pdf|docx)$/i.test(e.name) && !/__MACOSX/.test(e.name)).slice(0, MAX_ENTRIES);
      for (const e of entries) {
        const buffer = await e.async('nodebuffer');
        total += buffer.length;
        if (total > MAX_TOTAL) throw new Error('Archive trop volumineuse');
        const base = e.name.split('/').pop();
        out.push(/\.docx$/i.test(base) ? { originalname: base, text: await docxText(buffer) } : { originalname: base, buffer });
      }
    } else if (/\.docx$/i.test(name)) out.push({ originalname: name, text: await docxText(f.buffer) });
    else out.push(f);
  }
  return out;
}
