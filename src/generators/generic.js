// Document spécifique à l'AO (pièce « à rédiger » qui n'a pas de modèle dédié) : rédigé par l'IA d'après le modèle
// annexé au dossier d'appel d'offres, repli sur un canevas vierge si l'IA est indisponible.
import { p, title, center, bullet, table, note, signature, makeDoc, toBuffer, COLORS } from './helpers.js';
import { llmAvailable, llmDraft } from '../llm.js';
import { fmtDate } from '../util.js';
import { companyFullName } from '../company.js';

export async function documentSpecifique(piece, ao, c, opts = {}) {
  let draft = null, err = null;
  if (llmAvailable()) {
    try { draft = await llmDraft(piece, ao, c, piece.extrait); } catch (e) { err = e.message; }
  }
  const r = [];
  r.push(title(draft?.titre || piece.titre, { size: 32, after: 100 }));
  r.push(center(draft?.reference || `${ao.modePassation || "Appel d'offres"} N° ${ao.numero || '………'} — ${ao.objet || ''}`, { size: 20, color: COLORS.muted, after: 160 }));
  r.push(p(`Soumissionnaire : **${companyFullName(c) || '………'}**${c.representant?.nom ? ` — représenté par **${c.representant.nom}**, ${c.representant.qualite || ''}` : ''}`, { after: 160 }));
  if (draft?.sections?.length) {
    for (const s of draft.sections) {
      if (s.titre) r.push(p(s.titre, { bold: true, before: 120, after: 60 }));
      (s.paragraphes || []).forEach(t => r.push(p(t)));
      (s.puces || []).forEach(t => r.push(bullet(t)));
    }
    if (draft.tableau?.entetes?.length && draft.tableau.lignes?.length) {
      const n = draft.tableau.entetes.length, w = Math.floor(9900 / n);
      r.push(table(draft.tableau.entetes, draft.tableau.lignes.map(l => l.map(x => String(x ?? ''))), Array(n).fill(w)));
    }
    if (draft.formuleFin) r.push(p(draft.formuleFin, { before: 160 }));
    r.push(note("Brouillon rédigé automatiquement à partir du dossier d'appel d'offres : relisez-le, complétez les pointillés et comparez-le au modèle officiel avant de signer."));
  } else {
    r.push(note(err ? `Rédaction automatique impossible (${err}). Canevas à compléter à la main.` : 'Canevas à compléter : rédigez ce document selon les exigences ci-dessous.'));
    r.push(p(piece.detail || '', { before: 120 }));
    r.push(p(`Source : ${piece.source || 'RC'}`, { size: 18, color: COLORS.muted }));
    for (let i = 0; i < 12; i++) r.push(p('………………………………………………………………………………………………………………………………', { after: 120 }));
  }
  r.push(...signature(c.villeSignature, opts.dateSignature ? fmtDate(opts.dateSignature) : ''));
  return toBuffer(makeDoc(r, { footer: `${piece.titre} — AO N° ${ao.numero}` }));
}
