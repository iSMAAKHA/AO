// Évalue la faisabilité d'une candidature : conditions de participation de l'AO (lues par l'IA) comparées au profil
// de l'entreprise, plus les pièces qu'il reste à obtenir. Sert à l'écran « Faisabilité » et au guide Word.
import { buildPieces } from './pieces.js';
import { fmtMoney } from './util.js';

const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const num = v => (v === '' || v == null || !Number(v) ? null : Number(v)); // 0 = non renseigné
const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'en', 'au', 'aux', 'pour', 'par', 'sur', 'dans', 'norme', 'certificat', 'certification', 'attestation']);

/** Mots-clés significatifs d'un libellé (ex. « ISO 9001 », « agrément classe 3 »). */
const keywords = s => norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w));

function evalCritere(c, co) {
  const out = { ...c, statut: 'verifier', constat: '' };
  const cmp = (have, unit, label) => {
    if (c.seuil == null) { out.constat = 'Seuil non chiffré dans le RC : à comparer à la main.'; return; }
    if (have == null) { out.constat = `${label} non renseigné dans votre profil (étape 3).`; return; }
    const ok = c.sens === 'max' ? have <= c.seuil : have >= c.seuil;
    out.statut = ok ? 'ok' : 'ko';
    out.constat = `Vous : ${unit === 'DH' ? fmtMoney(have) + ' DH' : have + (unit ? ' ' + unit : '')} — exigé : ${c.sens === 'max' ? '≤' : '≥'} ${unit === 'DH' ? fmtMoney(c.seuil) + ' DH' : c.seuil + (unit ? ' ' + unit : '')}.`;
  };
  switch (c.type) {
    case 'chiffre_affaires': cmp(num(co.chiffreAffaires), 'DH', "Chiffre d'affaires"); break;
    case 'effectif': cmp(num(co.effectif), 'personnes', 'Effectif'); break;
    case 'anciennete': {
      const y = num(co.anneeCreation);
      cmp(y ? new Date().getFullYear() - y : null, 'ans', "Année de création");
      break;
    }
    case 'references': {
      const refs = (co.references || []).filter(r => r.client || r.objet);
      cmp(refs.length, 'référence(s)', 'Références');
      if (out.statut !== 'ko') out.constat += ' Vérifiez nature, montant et date de chaque référence.';
      break;
    }
    case 'certification': case 'agrement': case 'qualification': {
      const pool = norm(`${co.certifications || ''} ${co.agrements || ''}`);
      const kws = keywords(c.libelle);
      const hit = kws.length && kws.every(k => pool.includes(k));
      out.statut = hit ? 'ok' : 'ko';
      out.constat = hit ? 'Présent dans votre profil (certifications / agréments).' : 'Non trouvé dans votre profil : à obtenir ou à renseigner (étape 3).';
      break;
    }
    default: out.constat = 'À vérifier manuellement.';
  }
  return out;
}

export function evaluate(ao, co) {
  const criteres = (ao.criteres || []).map(c => evalCritere(c, co || {}));
  const pieces = buildPieces(ao);
  const aObtenir = pieces.filter(p => p.mode === 'manuel' && p.dossier !== 'attributaire' && !p.optionnel);
  const attributaire = pieces.filter(p => p.dossier === 'attributaire');
  const bloquants = criteres.filter(c => c.statut === 'ko' && c.eliminatoire);
  const aVerifier = criteres.filter(c => c.statut === 'verifier');
  let niveau = 'go', texte = 'Vous remplissez les conditions de participation détectées. Réunissez les pièces ci-dessous puis déposez.';
  if (bloquants.length) { niveau = 'nogo'; texte = `${bloquants.length} condition(s) éliminatoire(s) non remplie(s) d'après votre profil : régularisez-les (ou renseignez-les si elles sont déjà acquises) avant de postuler.`; }
  else if (!criteres.length) { niveau = 'reserve'; texte = 'Aucune condition de participation chiffrée détectée : relisez l\'article « conditions de participation / qualification » du RC.'; }
  else if (aVerifier.length) { niveau = 'reserve'; texte = `Candidature possible sous réserve de vérifier ${aVerifier.length} point(s).`; }
  return { criteres, aObtenir, attributaire, bloquants, aVerifier, verdict: { niveau, texte } };
}
