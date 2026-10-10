// « Guide de candidature » (Word) : tout ce que l'AO exige, ce que vous avez déjà, ce qu'il reste à obtenir
// et la décision (postuler / postuler sous réserve / à régulariser avant de postuler).
import { p, h1, title, center, table, note, bullet, makeDoc, toBuffer, COLORS } from './helpers.js';
import { buildPieces, buildCalendar, DOSSIERS } from '../pieces.js';
import { evaluate } from '../evaluation.js';
import { fmtDate, fmtDateLong, fmtHeure, fmtMoney } from '../util.js';
import { companyFullName } from '../company.js';

const STAT = {
  ok: { t: '✔ OK', fill: COLORS.ok },
  ko: { t: '✖ Non rempli', fill: COLORS.warn },
  verifier: { t: '? À vérifier', fill: COLORS.note },
};
const VERDICT = {
  go: { t: 'VOUS POUVEZ POSTULER', fill: COLORS.ok },
  reserve: { t: 'POSTULER SOUS RÉSERVE', fill: COLORS.note },
  nogo: { t: 'À RÉGULARISER AVANT DE POSTULER', fill: COLORS.warn },
};

export async function guideCandidature(ao, c, opts = {}) {
  const today = opts.today ?? new Date();
  const ev = evaluate(ao, c);
  const pieces = buildPieces(ao);
  const cal = buildCalendar(ao, today).filter(x => x.tone !== 'soft');
  const r = [];

  r.push(center('Guide de candidature', { size: 22, color: COLORS.muted, after: 40 }));
  r.push(title(`${ao.modePassation || "Appel d'offres"} N° ${ao.numero || '………'}`, { size: 32, after: 60 }));
  r.push(center(ao.objet || '', { size: 24, bold: true, after: 60 }));
  r.push(center(`${ao.maitreOuvrage?.nom || ''}${ao.dateOuverture ? ` — ouverture des plis le ${fmtDateLong(ao.dateOuverture)} à ${fmtHeure(ao.heureOuverture)}` : ''}`, { size: 20, color: 'B91C1C', after: 40 }));
  r.push(center(`Soumissionnaire : ${companyFullName(c) || '………'} — établi le ${fmtDate(today.toISOString().slice(0, 10))}`, { size: 18, color: COLORS.muted, after: 160 }));

  const v = VERDICT[ev.verdict.niveau];
  r.push(table(null, [[{ text: v.t, fill: v.fill, bold: true, size: 26 }], [{ text: ev.verdict.texte, fill: v.fill, size: 21 }]], [9900]));

  // 1. Conditions de participation
  r.push(h1('1. Conditions pour pouvoir postuler'));
  if (ev.criteres.length) {
    r.push(table(['Exigence du RC', 'Votre situation', 'Statut'], ev.criteres.map(x => {
      const s = STAT[x.statut];
      return [[p(`**${x.libelle}**${x.eliminatoire ? ' (éliminatoire)' : ''}`, { size: 19, after: 20 }), p(`${x.detail || ''} ${x.source ? '— ' + x.source : ''}`.trim(), { size: 17, color: COLORS.muted, after: 20 })], x.constat, { text: s.t, fill: s.fill, bold: true }];
    }), [4200, 4200, 1500]));
  } else {
    r.push(note("Aucune condition de participation chiffrée n'a été détectée. Relisez l'article du RC sur les conditions de participation / qualification."));
  }
  if (ao.reservePME) r.push(p('Marché réservé aux TPE/PME nationales, coopératives et auto-entrepreneurs.', { bold: true, before: 80 }));

  // 2. Pièces à fournir
  r.push(h1('2. Les documents demandés'));
  r.push(p("Légende : « Prêt » = modèle généré par l'application (à relire et signer) ; « À obtenir » = document à demander à un tiers ou à réunir ; « À faire remplir » = modèle à transmettre au constructeur / au client.", { size: 18, color: COLORS.muted }));
  for (const [key, label] of Object.entries(DOSSIERS)) {
    const list = pieces.filter(x => x.dossier === key);
    if (!list.length) continue;
    r.push(p(label, { bold: true, size: 24, color: COLORS.accent, before: 180 }));
    r.push(table(['Pièce', 'Forme / échéance', 'État'], list.map(x => {
      const etat = x.mode === 'genere' ? { text: '✔ Prêt', fill: COLORS.ok } : x.mode === 'modele' ? { text: '✔ À faire remplir', fill: COLORS.ok } : { text: 'À obtenir', fill: COLORS.note };
      return [[p(`**${x.titre}**${x.optionnel ? ' (si applicable)' : ''}`, { size: 19, after: 20 }), p(x.detail || '', { size: 17, color: COLORS.ink, after: 20 })], `${x.forme || ''}${x.forme && x.quand ? ' — ' : ''}${x.quand || ''}`, etat];
    }), [5300, 3200, 1400], { size: 18, cantSplit: false }));
  }

  // 3. Ce qui vous manque
  r.push(h1("3. Ce qu'il vous reste à faire"));
  const todo = [
    ...ev.bloquants.map(x => `Condition non remplie : ${x.libelle} — ${x.constat}`),
    ...ev.aVerifier.map(x => `À vérifier : ${x.libelle}${x.constat ? ' — ' + x.constat : ''}`),
    ...ev.aObtenir.map(x => `À obtenir : ${x.titre} (${x.quand || 'dépôt du pli'})`),
  ];
  if (todo.length) todo.forEach(t => r.push(bullet(t)));
  else r.push(p('Rien de bloquant : toutes les pièces sont générées et les conditions sont remplies.'));
  if (ev.attributaire.length) {
    r.push(p("Si vous êtes classé premier, on vous demandera en plus :", { bold: true, before: 120 }));
    ev.attributaire.forEach(x => r.push(bullet(x.titre)));
  }

  // 4. Dates et vigilance
  r.push(h1('4. Dates à retenir'));
  if (cal.length) r.push(table(['Date', 'Échéance'], cal.map(x => [`${fmtDate(x.date)}${x.heure ? ' à ' + fmtHeure(x.heure) : ''}`, { text: x.action, bold: x.tone === 'critical', fill: x.tone === 'critical' ? COLORS.warn : undefined }]), [2600, 7300]));
  else r.push(p("Dates non renseignées : saisissez la date d'ouverture des plis dans l'application."));
  const vig = [...(ao.pointsVigilance || []), ...(ao.jugement?.causesElimination || [])];
  if (vig.length) {
    r.push(h1("5. Points de vigilance propres à cet appel d'offres"));
    vig.forEach(t => r.push(bullet(t)));
  }
  if (ao.jugement?.methode || ao.jugement?.criteres?.length) {
    r.push(h1('6. Jugement des offres'));
    if (ao.jugement.methode) r.push(p(`Méthode : **${ao.jugement.methode}**`));
    (ao.jugement.criteres || []).forEach(t => r.push(bullet(t)));
  }
  if (ao.estimation != null) r.push(p(`Estimation du maître d'ouvrage : ${fmtMoney(ao.estimation)} DH ${ao.estimationType}.`, { before: 120 }));
  return toBuffer(makeDoc(r, { footer: `Guide de candidature — AO N° ${ao.numero}` }));
}
