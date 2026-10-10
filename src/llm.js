// Lecture IA du dossier d'appel d'offres complet (API Anthropic). Active si ANTHROPIC_API_KEY est défini.
//  - llmAnalyze  : lit TOUT le DCE (avis, RC, CPS, CCAG, annexes…) et en déduit les données, la liste exacte des
//                  pièces à fournir et les conditions de participation propres à CET appel d'offres.
//  - llmDraft    : rédige un document spécifique demandé par le RC (engagement, attestation, méthodologie…)
//                  en suivant le modèle annexé au dossier s'il existe.
// Les valeurs de l'IA complètent / remplacent celles de l'extraction par règles ; l'utilisateur vérifie tout avant génération.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const MAX_CHARS = 600000;

export const llmAvailable = () => !!process.env.ANTHROPIC_API_KEY;

export const PIECE_TYPES = [
  'pouvoirs', 'declaration_honneur', 'caution_provisoire', 'note_moyens', 'attestation_reference', 'cps_rc',
  'documentation_technique', 'tableau_conformite', 'attestation_constructeur', 'echantillons', 'visite_lieux',
  'acte_engagement', 'bordereau_prix', 'groupement', 'attestation_fiscale', 'attestation_cnss', 'registre_commerce',
  'autre_a_rediger', 'autre_a_obtenir',
];

const PROMPT_ANALYSE = `Tu es un expert des marchés publics marocains (décret n° 2-22-431, règlement de consultation, CPS, CCAG).
On te donne le dossier d'appel d'offres COMPLET (plusieurs documents, séparés par des lignes "=== DOCUMENT : nom ===").
Lis-le intégralement, comme un chargé d'appels d'offres expérimenté, et réponds UNIQUEMENT par un objet JSON (sans texte autour).
Ne déduis rien qui ne soit pas dans le dossier ; mets null / [] si l'information est absente. Dates au format AAAA-MM-JJ, heures HH:MM.

{
 "numero": "15/2026", "objet": "...", "modePassation": "Appel d'offres ouvert sur offres de prix", "lots": "Lot unique",
 "maitreOuvrage": {"nom":"","sigle":"","representant":"","adresse":"","ville":""},
 "reservePME": bool, "soumissionElectronique": bool,
 "dateOuverture": "", "heureOuverture": "", "lieuOuverture": "",
 "dateLimiteDocTech": "", "heureLimiteDocTech": "", "lieuDocTech": "",
 "cautionProvisoire": nombre, "cautionDefinitifPct": nombre, "retenueGarantiePct": nombre,
 "estimation": nombre, "estimationType": "TTC|HT", "validiteOffresJours": nombre, "tauxTVA": nombre,
 "delaiExecution": "", "delaiGarantie": "", "penalites": "", "seuilExcessifPct": nombre, "seuilBasPct": nombre,
 "articles": {"pieces": "n° de l'article du RC listant les pièces", "conditions": "n° article conditions de participation", "sanctions": "n° article sanctions"},
 "items": [{"n":1,"designation":"","unite":"U","quantite":nombre,"specs":["une caractéristique technique par entrée"]}],
 "piecesIA": [  // TOUTES les pièces à fournir pour répondre, telles que le RC les exige, dans l'ordre du RC
   {"dossier":"administratif|technique|financier|attributaire",
    "type":"${PIECE_TYPES.join('|')}",
    "titre":"intitulé exact utilisé par le RC", "detail":"ce que la pièce doit contenir / mentions obligatoires / qui la délivre / validité",
    "forme":"original, copie certifiée conforme, signé et cacheté…", "quand":"dépôt du pli | sur demande du MO si attributaire | date précise",
    "source":"référence (ex. RC art. 5 §2)", "optionnel": bool, "modele_dans_dce": bool, "ancrage":"3 à 6 mots du titre du modèle annexé, tel qu'écrit dans le DCE, sinon null"}
 ],
 "criteres": [  // CONDITIONS de participation / de qualification : chiffre d'affaires minimum, références similaires (nombre, montant, nature), effectif, certifications (ISO…), agréments, qualification-classification, ancienneté, moyens matériels/humains exigés, etc.
   {"type":"chiffre_affaires|references|effectif|certification|agrement|qualification|anciennete|moyens|autre",
    "libelle":"", "seuil": nombre ou null, "unite":"DH|nb|ans|personnes", "sens":"min|max", "detail":"", "source":"", "eliminatoire": bool}
 ],
 "jugement": {"methode":"moins-disant | mieux-disant | note technique…", "criteres":["critères et pondérations d'évaluation si le RC en définit"], "causesElimination":["causes d'élimination explicites du RC"]},
 "pointsVigilance": ["pièges ou exigences inhabituelles propres à cet AO (visite obligatoire, échantillons, langue, format, délai court…)"]
}

Règles pour "piecesIA" :
- Utilise le type le plus précis. "autre_a_rediger" = document que le soumissionnaire doit rédiger lui-même et qui n'a pas de type dédié (engagement de non-sous-traitance, planning, méthodologie, plan qualité, CV d'équipe, programme d'exécution, lettre de soumission…). "autre_a_obtenir" = document délivré par un tiers (administration, banque, constructeur, client, organisme de certification).
- Les attestations fiscale/CNSS, le modèle 9 du RC (type registre_commerce), les agréments ou certificats demandés à l'attributaire pressenti vont dans dossier "attributaire".
- L'acte d'engagement et le bordereau des prix / détail estimatif / décomposition du prix global sont de dossier "financier".
- N'invente aucune pièce ; ne fusionne pas deux pièces distinctes ; ne reprends pas deux fois la même pièce.`;

async function callClaude(system, user, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}${body ? ' — ' + body.slice(0, 160) : ''}`);
  }
  const data = await res.json();
  return data.content?.map(b => b.text || '').join('') || '';
}

function parseJson(raw) {
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('réponse IA sans JSON');
  return JSON.parse(raw.slice(a, b + 1).replace(/^\s*\/\/.*$/gm, ''));
}

const isEmpty = v => v == null || v === '' || (Array.isArray(v) && !v.length);

/** Fusionne la réponse de l'IA dans l'AO extrait par règles (l'IA prime quand elle a une valeur). */
export function mergeAnalysis(base, json) {
  const ao = structuredClone(base);
  for (const [k, v] of Object.entries(json)) {
    if (isEmpty(v)) continue;
    if (k === 'maitreOuvrage' || k === 'articles') ao[k] = { ...ao[k], ...Object.fromEntries(Object.entries(v).filter(([, x]) => !isEmpty(x))) };
    else if (k === 'piecesIA') {
      ao.piecesIA = v.filter(x => x && x.titre).map((x, i) => ({
        id: `P${i + 1}`,
        dossier: ['administratif', 'technique', 'financier', 'attributaire'].includes(x.dossier) ? x.dossier : 'technique',
        type: PIECE_TYPES.includes(x.type) ? x.type : 'autre_a_obtenir',
        titre: String(x.titre), detail: x.detail || '', forme: x.forme || '', quand: x.quand || 'Dépôt du pli',
        source: x.source || '', optionnel: !!x.optionnel, modeleDansDCE: !!x.modele_dans_dce, ancrage: x.ancrage || null,
      }));
    } else if (k === 'criteres') {
      ao.criteres = v.filter(x => x && x.libelle).map(x => ({
        type: x.type || 'autre', libelle: String(x.libelle), seuil: x.seuil == null || x.seuil === '' ? null : Number(x.seuil),
        unite: x.unite || '', sens: x.sens === 'max' ? 'max' : 'min', detail: x.detail || '', source: x.source || '', eliminatoire: x.eliminatoire !== false,
      }));
    } else ao[k] = v;
  }
  if (ao.dateLimiteDocTech) ao.docTechSeparee = true;
  const types = new Set((ao.piecesIA || []).map(p => p.type));
  if (types.size) {
    ao.exigences = {
      ...ao.exigences,
      tableauConformite: types.has('tableau_conformite'),
      attestationConstructeur: types.has('attestation_constructeur'),
      documentationTechnique: types.has('documentation_technique'),
      echantillons: types.has('echantillons'),
      visiteLieux: types.has('visite_lieux'),
      groupementPossible: types.has('groupement') || ao.exigences.groupementPossible,
    };
  }
  return ao;
}

/** Lit le DCE complet et renvoie l'AO enrichi (données + pièces exactes + conditions de participation). */
export async function llmAnalyze(text, base) {
  const raw = await callClaude(PROMPT_ANALYSE, text.slice(0, MAX_CHARS), 16000);
  return mergeAnalysis(base, parseJson(raw));
}

const PROMPT_DRAFT = `Tu rédiges, pour un soumissionnaire à un marché public marocain, UN document précis demandé par le règlement de consultation.
Si un modèle de ce document figure dans les extraits du dossier fournis, suis-le fidèlement (structure, rubriques, formules). Sinon, rédige-le selon les usages marocains.
Utilise les informations du soumissionnaire fournies ; pour ce qui manque, laisse des pointillés "………". N'invente aucun chiffre, aucune référence, aucun nom.
Réponds UNIQUEMENT par un objet JSON :
{"titre":"", "reference":"phrase d'en-tête rappelant l'AO (numéro, objet)", "sections":[{"titre":"(optionnel)", "paragraphes":["..."], "puces":["..."]}],
 "tableau":{"entetes":["..."],"lignes":[["..."]]} ou null, "formuleFin":"formule d'engagement avant signature (optionnel)"}`;

/** Rédige un document spécifique ; `extrait` = passages du DCE autour du modèle éventuel. */
export async function llmDraft(piece, ao, company, extrait) {
  const ctx = {
    ao: { numero: ao.numero, objet: ao.objet, maitreOuvrage: ao.maitreOuvrage, dateOuverture: ao.dateOuverture, delaiExecution: ao.delaiExecution },
    soumissionnaire: {
      raisonSociale: company.raisonSociale, formeJuridique: company.formeJuridique, representant: company.representant, adresse: company.adresseSiege,
      activite: company.activite, moyensHumains: company.moyensHumains, moyensTechniques: company.moyensTechniques, references: company.references,
      certifications: company.certifications, effectif: company.effectif,
    },
    piece: { titre: piece.titre, detail: piece.detail, source: piece.source },
  };
  const user = `${JSON.stringify(ctx)}\n\n=== EXTRAITS DU DOSSIER D'APPEL D'OFFRES ===\n${(extrait || '').slice(0, 40000)}`;
  return parseJson(await callClaude(PROMPT_DRAFT, user, 6000));
}

/** Passages du DCE autour du modèle recherché (ancrage / titre), sinon début du texte. */
export function excerptFor(text, piece) {
  const keys = [piece.ancrage, piece.titre].filter(Boolean);
  const hay = text.toLowerCase();
  const out = [];
  for (const k of keys) {
    const needle = k.toLowerCase().slice(0, 60);
    let from = 0;
    for (let n = 0; n < 3; n++) {
      const i = hay.indexOf(needle, from);
      if (i < 0) break;
      out.push(text.slice(Math.max(0, i - 500), i + 6000));
      from = i + 6000;
    }
    if (out.length) break;
  }
  return out.length ? out.join('\n…\n') : text.slice(0, 20000);
}
