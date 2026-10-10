// Serveur local de l'application « Dossier AO » : http://localhost:3000
import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPdfText } from './src/pdf.js';
import { ocrPdf, ocrAvailable } from './src/ocr.js';
import { extractAO } from './src/extract.js';
import { llmAnalyze, llmAvailable, excerptFor } from './src/llm.js';
import { evaluate } from './src/evaluation.js';
import { expandUploads } from './src/uploads.js';
import { loadCompany, saveCompany, PUBLIC_MODE } from './src/company.js';
import { buildAll, buildZip, normalizeAO } from './src/generators/index.js';
import { buildPieces, buildCalendar, tenderLimits, DOSSIERS } from './src/pieces.js';
import { totals } from './src/generators/financier.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: (PUBLIC_MODE ? 30 : 80) * 1024 * 1024, files: 10 } });
const PORT = process.env.PORT || 3000;
const MIN_CHARS_PER_PAGE = 120; // en dessous, la page est considérée comme scannée (pas de couche texte)

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
// Mode public : en-têtes de sécurité de base
app.use((_req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' }); next(); });
app.use(express.static(join(__dirname, 'public')));

// ---------------------------------------------------------------- Entreprise
app.get('/api/company', async (_req, res) => res.json(await loadCompany()));
app.put('/api/company', async (req, res) => {
  if (!PUBLIC_MODE) await saveCompany(req.body); // en mode public : profil gardé dans le navigateur seulement
  res.json({ ok: true });
});

app.get('/api/capabilities', async (_req, res) => res.json({ ocr: await ocrAvailable(), ai: llmAvailable(), public: PUBLIC_MODE }));

// ---------------------------------------------------------------- Analyse (tâche asynchrone)
const jobs = new Map();
const setJob = (id, patch) => jobs.set(id, { ...jobs.get(id), ...patch });
// Nettoyage : une tâche (et ses résultats) est supprimée 30 min après sa création
const forget = (map, id, ms = 30 * 60 * 1000) => setTimeout(() => map.delete(id), ms).unref();

// Limites anti-abus (mode public) : 1 analyse OCR à la fois, 15 analyses / heure / IP
let active = 0;
const hits = new Map();
function allow(ip) {
  if (!PUBLIC_MODE) return true;
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  if (list.length >= 15) return false;
  list.push(now); hits.set(ip, list); return true;
}

async function runAnalysis(id, uploaded, { useAI, useOCR }) {
  try {
    const files = await expandUploads(uploaded);
    const parts = [];
    const report = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setJob(id, { message: `Lecture de ${f.originalname}…`, progress: i / files.length });
      if (f.text != null) { report.push({ name: f.originalname, chars: f.text.length }); parts.push(`=== DOCUMENT : ${f.originalname} ===\n${f.text}`); continue; }
      if (!/\.pdf$/i.test(f.originalname)) { report.push({ name: f.originalname, error: 'Format ignoré (PDF, DOCX ou ZIP attendus)' }); continue; }
      let r = await extractPdfText(f.buffer);
      const scanned = r.chars < MIN_CHARS_PER_PAGE * r.pages;
      if (!scanned) { report.push({ name: f.originalname, pages: r.pages, chars: r.chars }); parts.push(`=== DOCUMENT : ${f.originalname} ===
${r.text}`); continue; }
      if (!useOCR || !(await ocrAvailable())) {
        report.push({ name: f.originalname, pages: r.pages, chars: r.chars, scanned: true, warning: "PDF scanné (image) sans texte : OCR indisponible. Installez les dépendances OCR (voir README) ou fournissez un PDF avec couche texte." });
        continue;
      }
      const t = await ocrPdf(f.buffer, (done, total) => setJob(id, { message: `OCR de ${f.originalname} : page ${done}/${total}…`, progress: (i + done / total) / files.length }));
      report.push({ name: f.originalname, pages: r.pages, chars: t.length, ocr: true });
      parts.push(`=== DOCUMENT : ${f.originalname} ===
${t}`);
    }
    const text = parts.join('\n');
    if (text.replace(/\s/g, '').length < 200) {
      setJob(id, { status: 'error', error: 'Aucun texte exploitable dans les fichiers fournis (PDF scannés sans OCR ?).', report });
      return;
    }
    setJob(id, { message: 'Extraction des informations…', progress: 0.95 });
    let ao = extractAO(text);
    let aiNote = null;
    if (useAI) {
      try {
        setJob(id, { message: "Lecture de l'appel d'offres par l'IA (1 à 3 min)…", progress: 0.97 });
        ao = await llmAnalyze(text, ao);
        for (const pc of ao.piecesIA || []) if (pc.type === 'autre_a_rediger') pc.extrait = excerptFor(text, pc).slice(0, 12000);
        aiNote = `Dossier lu par l'IA : ${ao.piecesIA?.length || 0} pièces et ${ao.criteres?.length || 0} conditions de participation identifiées.`;
      } catch (e) { aiNote = `Lecture IA impossible (${e.message}) — extraction par règles utilisée.`; }
    }
    if (aiNote) ao.alertes.unshift({ type: 'info', texte: aiNote });
    setJob(id, { status: 'done', progress: 1, result: { ao, report, aiNote, chars: text.length } });
  } catch (e) {
    console.error(e);
    setJob(id, { status: 'error', error: e.message });
  }
}

app.post('/api/analyze', upload.array('files', 6), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Aucun fichier reçu.' });
  if (!allow(req.ip)) return res.status(429).json({ error: "Trop d'analyses : réessayez dans une heure." });
  if (PUBLIC_MODE && active >= 2) return res.status(503).json({ error: 'Serveur occupé, réessayez dans une minute.' });
  const id = randomUUID();
  forget(jobs, id);
  jobs.set(id, { status: 'running', message: 'Démarrage…', progress: 0 });
  // multer décode les noms de fichiers en latin1
  req.files.forEach(f => { f.originalname = Buffer.from(f.originalname, 'latin1').toString('utf8'); });
  active++;
  runAnalysis(id, req.files, { useAI: req.body.ai === '1' && llmAvailable(), useOCR: req.body.ocr !== '0' }).finally(() => { active--; });
  res.json({ jobId: id });
});

app.get('/api/job/:id', (req, res) => {
  const j = jobs.get(req.params.id);
  if (!j) return res.status(404).json({ error: 'Tâche inconnue' });
  res.json(j);
});

// ---------------------------------------------------------------- Aperçu (pièces, calendrier, bornes)
app.post('/api/preview', (req, res) => {
  const ao = normalizeAO(req.body.ao);
  res.json({ pieces: buildPieces(ao), evaluation: evaluate(ao, req.body.company || {}), dossiers: DOSSIERS, calendrier: buildCalendar(ao), limites: tenderLimits(ao), totaux: totals(ao) });
});

// ---------------------------------------------------------------- Génération
const outputs = new Map(); // id -> { files, zip, name }

app.post('/api/generate', async (req, res) => {
  try {
    const company = (PUBLIC_MODE ? req.body.company : req.body.company || (await loadCompany()));
    if (!company) return res.status(400).json({ error: 'Profil entreprise manquant.' });
    if (req.body.saveCompany && !PUBLIC_MODE) await saveCompany(company);
    const ao = normalizeAO(req.body.ao);
    const files = await buildAll(ao, company, { dateSignature: req.body.dateSignature });
    const zip = await buildZip(files, ao);
    const id = randomUUID();
    forget(outputs, id);
    outputs.set(id, { files, zip, name: `Dossier_AO_${(ao.numero || 'sans_numero').replace(/[^\w-]+/g, '_')}.zip` });
    if (outputs.size > 20) outputs.delete(outputs.keys().next().value);
    res.json({ id, zip: outputs.get(id).name, files: files.map((f, i) => ({ i, path: f.path, size: f.buffer.length })) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/download/:id', (req, res) => {
  const o = outputs.get(req.params.id);
  if (!o) return res.status(404).send('Expiré — régénérez le dossier.');
  res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${o.name}"` });
  res.send(o.zip);
});

const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
app.get('/api/file/:id/:i', (req, res) => {
  const o = outputs.get(req.params.id);
  const f = o?.files[Number(req.params.i)];
  if (!f) return res.status(404).send('Introuvable');
  const name = f.path.split('/').pop();
  res.set({ 'Content-Type': MIME[name.split('.').pop()] || 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` });
  res.send(f.buffer);
});

app.listen(PORT, PUBLIC_MODE ? '0.0.0.0' : undefined, () => console.log(`Dossier AO — http://localhost:${PORT}`));
