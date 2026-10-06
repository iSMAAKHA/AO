// Extraction heuristique des données d'un appel d'offres (RC, CPS, Avis) à partir du texte brut.
// Le résultat est un objet `ao` que l'utilisateur vérifie/corrige dans l'interface avant génération.
import { monthIndex, parseMoney, toISO } from './util.js';

const MONTHS_RE = '(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)';
const DAYS_RE = '(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)';

export function emptyAO() {
  return {
    numero: '', objet: '', lots: 'Lot unique',
    maitreOuvrage: { nom: '', sigle: '', representant: '', adresse: '', ville: '' },
    modePassation: "Appel d'offres ouvert sur offres de prix",
    reservePME: false,
    dateOuverture: '', heureOuverture: '',
    lieuOuverture: '',
    dateLimiteDocTech: '', heureLimiteDocTech: '', lieuDocTech: '',
    docTechSeparee: false,
    portail: 'www.marchespublics.gov.ma',
    soumissionElectronique: false,
    cautionProvisoire: null, cautionDefinitifPct: null, retenueGarantiePct: null,
    estimation: null, estimationType: 'TTC',
    tauxTVA: 20,
    validiteOffresJours: null,
    delaiExecution: '', delaiGarantie: '', penalites: '',
    seuilExcessifPct: null, seuilBasPct: null,
    exigences: { tableauConformite: false, attestationConstructeur: false, documentationTechnique: false, echantillons: false, visiteLieux: false, groupementPossible: true },
    items: [],
    articles: {},
    piecesExtra: [],
    piecesDesactivees: [],
    alertes: [],
    sources: {},
  };
}

const clean = s => (s || '').replace(/\s+/g, ' ').trim();
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function find(re, text, group = 1) {
  const m = re.exec(text);
  return m ? m[group] : null;
}

function mode(arr) {
  const c = new Map();
  for (const a of arr) c.set(a, (c.get(a) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function parseDateFr(day, month, year) {
  const mi = monthIndex(month);
  return mi < 0 ? '' : toISO(new Date(Date.UTC(+year, mi, +day)));
}

const parseHeure = (h, m) => `${String(h).padStart(2, '0')}:${String(m || '00').padStart(2, '0')}`;

/** Première date « <jour> JJ mois AAAA à HHhMM » dont le contexte proche (avant/après) correspond à ctxRe. */
function dateNear(text, ctxRe, { before = 80, after = 220 } = {}) {
  const re = new RegExp(String.raw`(?:${DAYS_RE}\s+)?(\d{1,2})\s*(?:er)?\s+${MONTHS_RE}\s+(20\d{2})[^\d]{0,12}?(\d{1,2})\s*[hH:]\s*(\d{2})?`, 'gi');
  for (const d of text.matchAll(re)) {
    const ctx = text.slice(Math.max(0, d.index - before), d.index + d[0].length + after);
    if (ctxRe.test(ctx)) return { date: parseDateFr(d[1], d[2], d[3]), heure: parseHeure(d[4], d[5]) };
  }
  return null;
}

const SIGLES = { ssd: 'SSD', ssp: 'SSD', pc: 'PC', hdd: 'HDD', usb: 'USB', ups: 'UPS', led: 'LED', reseau: 'réseau', memoire: 'mémoire' };

function extractItems(text) {
  let start = text.search(/D[ée]finition des prix/i);
  if (start < 0) start = text.search(/^PRIXs*(?:NW{0,3})?1s*[:;]/im);
  const body = start >= 0 ? text.slice(start) : text;
  const end = body.search(/INSTALLATION ET D[ÉE]PLOIEMENT|BORDEREAU DES PRIX/i);
  const zone = end > 0 ? body.slice(0, end) : body;

  const items = [];
  let cur = null;
  const titleRe = /^PRIX\s*(?:N\s*[°ºo"“®*]?\s*)?(\d{1,2})\s*[:;.\-]\s*(.+)$/i;
  for (const raw of zone.split('\n').map(l => l.trim()).filter(Boolean)) {
    const t = titleRe.exec(raw);
    if (t) {
      const des = cap(clean(t[2]).replace(/[:;.\s|]+$/, '').toLowerCase()).replace(/\b\w+\b/g, w => SIGLES[w.toLowerCase()] || w);
      cur = { n: +t[1], designation: des, unite: 'U', quantite: null, specs: [] };
      items.push(cur);
      continue;
    }
    if (!cur) continue;
    if (/^Prix pay[ée]/i.test(raw)) {
      const u = /à l['’]?\s*(unit[ée]|m[èe]tre|forfait|lot)/i.exec(raw);
      if (u) cur.unite = /unit/i.test(u[1]) ? 'U' : cap(u[1]);
      cur = null;
      continue;
    }
    if (/^Les caract[ée]ristiques techniques|sp[ée]cifications suivantes|^[-–■•;:|\s]*$/i.test(raw) || /^\d{1,2}$/.test(raw)) continue;
    const bullet = /^[■•«>\u25aa\u25cf\-–]\s*(.+)$/.exec(raw);
    if (bullet) { cur.specs.push(clean(bullet[1]).replace(/[;:■•\s]+$/, '')); continue; }
    const line = clean(raw).replace(/^[;:|\s]+|[;:|■•\s]+$/g, '');
    if (!line) continue;
    const last = cur.specs.length - 1;
    // continuation de la puce précédente (minuscule / chiffre / parenthèse)
    if (last >= 0 && /^[a-zà-ÿ(,0-9]/.test(line)) cur.specs[last] += ' ' + line;
    else cur.specs.push(line);
  }
  return items.filter(i => i.specs.length || i.designation);
}

/**
 * Retrouve les quantités dans le tableau « Bordereau des prix » du CPS.
 * Le texte PDF de ce tableau est souvent désordonné : une ligne type est « 100 Poste de travail U 1 »
 * (quantité d'abord, n° de prix à la fin), ou « 1 Poste de travail U 100 » en lecture normale.
 */
function fillQuantities(text, items) {
  const heads = [...text.matchAll(/D[ée]signations?/gi)].filter(m => /Quantit/i.test(text.slice(m.index, m.index + 250)));
  if (!heads.length) return;
  const h = heads[heads.length - 1].index;
  const end = text.slice(h).search(/Montant total/i);
  const seg = text.slice(h, end > 0 ? h + end : h + 1500);
  for (const it of items) {
    const qtyFirst = new RegExp(String.raw`(?:^|\n)[^\n]*?\b(\d{1,5})\b[^\n\d]*?\bU\s+${it.n}\s*(?=\n|$)`, 'i').exec(seg);
    if (qtyFirst) { it.quantite = +qtyFirst[1]; continue; }
    const qtyLast = new RegExp(String.raw`(?:^|\n)\s*${it.n}\b[^\n]*?\bU\b\s*[|]?\s*(\d{1,5})\s*(?=\n|$)`, 'i').exec(seg);
    if (qtyLast) it.quantite = +qtyLast[1];
  }
}

export function extractAO(rawText) {
  const ao = emptyAO();
  const text = rawText.replace(/[’‘`´]/g, "'").replace(/[\u00a0\u202f]/g, ' ').replace(/[ \t]+/g, ' ');
  const flat = text.replace(/\s+/g, ' ');

  // N° de l'AO : valeur la plus fréquente de "N° 15/2026" dans le document
  const nums = [...flat.matchAll(/(?:A\.?O\.?O\.?|appel d'offres(?: ouvert)?)\s*(?:N\s*[°ºo"®^*]?\s*)?[°ºo"®^*]?\s*(\d{1,3})\s*\/\s*(20\d{2})/gi)].map(m => `${+m[1]}/${m[2]}`);
  ao.numero = mode(nums) || '';

  const objet = find(/appel d'offres[^.]{0,40}?ayant pour objet\s+(?:la |le |l'|les )?(?:«\s*)?(.+?)(?:»|\.\s|\.$)/i, flat);
  const objetAvis = find(/ayant pour objet\s*«\s*(.+?)\s*»/i, flat);
  ao.objet = objetAvis ? cap(clean(objetAvis)) : objet ? cap(clean(objet)) : '';

  const mo = /Ma[iî]tre d'Ouvrage[^.]{0,120}? est\s+(.+?),?\s+repr[ée]sent[ée]e?\s+par\s+(.+?)\.\s/i.exec(flat);
  if (mo) {
    ao.maitreOuvrage.nom = cap(clean(mo[1]).replace(/^l'/i, ''));
    ao.maitreOuvrage.representant = cap(clean(mo[2]));
  }
  const sigles = [...flat.matchAll(/march[ée]s (?:de |du |de l'|d')\s*(?:l')?([A-Z]{2,8})\b/g)].map(m => m[1]);
  ao.maitreOuvrage.sigle = mode(sigles) || '';
  const adr = /\bsis(?:e)?\s+(?:au\s+)?(\d+[^,.]*?(?:rue|avenue|boulevard|bd)[^,.]*?)\s+(?:à|a)\s+([A-ZÉ][A-Za-zéèêîôûç\-]{2,25})/i.exec(flat);
  if (adr) { ao.maitreOuvrage.adresse = clean(adr[1]).replace(/^(\d+)\s*,?\s*/, '$1, '); ao.maitreOuvrage.ville = clean(adr[2]); }

  ao.reservePME = /R[ÉE]SERV[ÉE]E? (?:À|A) LA TR[ÈE]S PETITE|PETITE ET MOYENNE ENTREPRISE NATIONALE/i.test(flat);
  ao.soumissionElectronique = /soumission(?:s)? [ée]lectronique|par voie [ée]lectronique/i.test(flat);

  // Dates (Avis)
  const ouv = dateNear(flat, /il sera proc[ée]d[ée]|ouverture des plis/i);
  if (ouv) { ao.dateOuverture = ouv.date; ao.heureOuverture = ouv.heure; }
  const lieu = /dans les bureaux de\s+(.+?),?\s+sis\s+(.+?)\s+à\s+(\w+)/i.exec(flat);
  if (lieu) ao.lieuOuverture = clean(`${lieu[1]}, ${lieu[2]}, ${lieu[3]}`);
  const dt = dateNear(flat, /au plus tard le/i, { before: 25, after: 0 });
  if (dt) { ao.dateLimiteDocTech = dt.date; ao.heureLimiteDocTech = dt.heure; ao.docTechSeparee = true; }
  if (/prospectus, notices et documentation/i.test(flat) && /format papier/i.test(flat)) ao.docTechSeparee = true;
  const dtLieu = /(Direction[^,.]{3,60}?(?: de l'\w+)?),?\s*sise?\s+(?:au\s+)?(.+?)\s+à\s+(\w+)/i.exec(flat);
  if (dtLieu) ao.lieuDocTech = clean(`${dtLieu[1]}, ${dtLieu[2]}, ${dtLieu[3]}`);

  // Montants
  const cp = find(/cautionnement provisoire[^()]{0,160}?\(\s*([\d\s.,]+)\s*(?:DH|dirhams)/i, flat) || find(/cautionnement provisoire[^.]{0,80}?(\d[\d\s.,]{2,12})\s*(?:DH|dirhams)/i, flat);
  ao.cautionProvisoire = parseMoney(cp);
  const est = /estimation[^()]{0,200}?\(\s*([\d\s.,]+)\s*(?:DH|dirhams)\s*(TTC|HT)?/i.exec(flat);
  if (est) { ao.estimation = parseMoney(est[1]); ao.estimationType = (est[2] || 'TTC').toUpperCase(); }
  const cd = find(/cautionnement d[ée]finitif[^.]{0,120}?\(\s*(\d+(?:[.,]\d+)?)\s*%/i, flat);
  ao.cautionDefinitifPct = cd ? parseFloat(cd.replace(',', '.')) : null;
  const rg = find(/retenue de garantie cesse de cro[iî]tre lorsqu'elle atteint[^()]{0,60}\(\s*(\d+(?:[.,]\d+)?)\s*%/i, flat);
  ao.retenueGarantiePct = rg ? parseFloat(rg.replace(',', '.')) : null;
  const tva = find(/taux\s*(?:de la)?\s*TVA\s*=?\s*(\d{1,2})\s*%/i, flat);
  if (tva) ao.tauxTVA = +tva;

  const val = find(/engag[ée]s? par leurs offres pendant un d[ée]lai de\s+[\wéèû\- ]+?\(\s*(\d+)\s*\)\s*jours/i, flat);
  ao.validiteOffresJours = val ? +val : null;
  ao.delaiExecution = clean(find(/d[ée]lai d'ex[ée]cution du march[ée] est fix[ée] [àa]\s+(.+?)\./i, flat));
  ao.delaiGarantie = clean(find(/d[ée]lai de garantie[^.]{0,80}? est de\s+(.+?)\./i, flat));
  const pen = /p[ée]nalit[ée][^.]{0,80}?de\s+([\d.,]+\s*(?:%|‰)\s*\(?[^)]{0,20}\)?)\s*du montant/i.exec(flat);
  if (pen) ao.penalites = clean(pen[1]);
  const exc = find(/sup[ée]rieure de plus de\s+[\wéèû\- ]+?\(?\s*(\d+)\s*%/i, flat);
  const bas = find(/inf[ée]rieure de plus de\s+[\wéèû\- ]+?\(?\s*(\d+)\s*%/i, flat);
  ao.seuilExcessifPct = exc ? +exc : null;
  ao.seuilBasPct = bas ? +bas : null;

  // Exigences
  const ex = ao.exigences;
  ex.tableauConformite = /tableau de conformit[ée]/i.test(flat);
  ex.attestationConstructeur = /attestation[^.]{0,80}constructeur/i.test(flat);
  ex.documentationTechnique = /documentation technique|prospectus/i.test(flat);
  ex.echantillons = /[ée]chantillon/i.test(flat);
  ex.visiteLieux = /visite des lieux|visite de site/i.test(flat);
  ex.groupementPossible = !/groupement[^.]{0,30}(?:n'est pas|ne sont pas) (?:autoris|admis)/i.test(flat);

  const artPieces = find(/ARTICLE\s+(\d+)\s*:\s*LISTE DES PI[ÈE]CES/i, flat);
  if (artPieces) ao.articles.pieces = artPieces;
  const artCond = find(/remplis les conditions pr[ée]vues [àa] l'article\s+(\d+)/i, flat);
  if (artCond) ao.articles.conditions = artCond;
  const artSanc = find(/mesures coercitives pr[ée]vues [àa] l'article\s+(\d+)/i, flat);
  if (artSanc) ao.articles.sanctions = artSanc;

  ao.items = extractItems(text);
  fillQuantities(text, ao.items);

  // Alertes : points à vérifier à la main
  const al = ao.alertes;
  const ctx = (re, label) => {
    const m = re.exec(flat);
    if (m) al.push({ type: 'info', texte: `${label} : « …${clean(flat.slice(Math.max(0, m.index - 60), m.index + 160))}… »` });
  };
  if (!ao.numero) al.push({ type: 'warn', texte: "N° de l'appel d'offres non détecté — à saisir." });
  if (!ao.dateOuverture) al.push({ type: 'warn', texte: "Date/heure de la séance d'ouverture des plis introuvable (elle figure dans l'AVIS d'appel d'offres, pas dans le RC/CPS) — à saisir ou joindre l'Avis." });
  if (ao.docTechSeparee && !ao.dateLimiteDocTech) al.push({ type: 'warn', texte: "Une documentation technique en pli séparé est exigée : sa date limite de dépôt figure dans l'Avis — à saisir." });
  if (ao.estimation == null) al.push({ type: 'info', texte: "Estimation du maître d'ouvrage non trouvée (elle figure dans l'Avis) — nécessaire pour le contrôle « offre excessive / anormalement basse »." });
  const sansQte = ao.items.filter(i => i.quantite == null).length;
  if (sansQte) al.push({ type: 'warn', texte: `Quantités non détectées pour ${sansQte} article(s) — à reprendre dans le bordereau des prix du CPS.` });
  if (!ao.items.length) al.push({ type: 'warn', texte: "Aucun article (« PRIX N°… ») détecté dans le cahier des prescriptions techniques — saisir le bordereau à la main." });
  if (ex.echantillons) ctx(/[ée]chantillon/i, 'Échantillons mentionnés');
  if (ex.visiteLieux) ctx(/visite des lieux|visite de site/i, 'Visite des lieux mentionnée');
  ctx(/qualification|classification|agr[ée]ment|certificat ISO|ISO ?\d{4,5}/i, 'Qualification / certification mentionnée');
  ctx(/main[- ]d'[œo]euvre locale/i, 'Emploi local');

  return ao;
}
