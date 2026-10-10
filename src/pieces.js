// Catalogue des pièces d'un dossier de candidature (marchés publics marocains) + calendrier de préparation.
// La liste est construite à partir de l'AO extrait (options PME, groupement, documentation technique, etc.).
// Structure standard : dossier administratif, dossier technique, offre financière,
// + pièces demandées à l'attributaire pressenti.
import { addDays, fmtDate, fmtDateLong, fmtHeure, fmtMoney, daysUntil } from './util.js';

const art = (ao, key, fallback) => (ao.articles && ao.articles[key]) || fallback;

/**
 * Retourne la liste des pièces. Chaque pièce :
 * { id, dossier, titre, detail, forme, quand, source, fichier, mode }
 *  - mode : 'genere' (fichier produit par l'application), 'modele' (modèle à faire remplir par un tiers),
 *           'manuel' (pièce à obtenir / fournir par l'entreprise)
 */
export function buildPieces(ao) {
  if (ao.piecesIA?.length) return buildPiecesIA(ao);
  const P = [];
  const rc = `RC art. ${art(ao, 'pieces', '5')}`;
  const caution = ao.cautionProvisoire != null ? `${fmtMoney(ao.cautionProvisoire)} DH` : "montant fixé par l'avis";
  const elec = ao.soumissionElectronique;

  // ---------------- Dossier administratif ----------------
  P.push({
    id: 'A1', dossier: 'administratif', titre: 'Pièces justifiant le pouvoir de signature',
    detail: "Selon la forme juridique : SARL/SA → extrait des statuts et/ou PV de l'organe compétent nommant le gérant / le représentant (copie certifiée conforme) ; procuration légalisée si le signataire n'est pas le gérant ; acte de délégation de pouvoir le cas échéant. Personne physique ou auto-entrepreneur agissant pour son compte : aucune pièce.",
    forme: 'Copie certifiée conforme', quand: 'Dépôt du pli', source: `${rc} — I.1.1.a`, fichier: null, mode: 'manuel',
  });
  if (ao.reservePME) {
    P.push({
      id: 'A1b', dossier: 'administratif', titre: 'Mention PME dans les pièces de pouvoir',
      detail: "Marché réservé à la TPE/PME : les pièces de pouvoir doivent mentionner que la société est gérée/administrée directement par ses propriétaires, copropriétaires ou actionnaires, et qu'elle n'est pas détenue à plus de 25 % du capital ou des droits de vote par des entreprises ne répondant pas à la définition de la PME.",
      forme: 'Mention dans les statuts / PV / attestation', quand: 'Dépôt du pli', source: `${rc} — I.1.1.a`, fichier: null, mode: 'manuel',
    });
  }
  P.push({
    id: 'A2', dossier: 'administratif', titre: "Déclaration sur l'honneur",
    detail: "Un seul exemplaire, selon le modèle annexé au dossier d'appel d'offres, signée et cachetée par le représentant légal (en cas de groupement : une par membre).",
    forme: 'Original signé + cachet', quand: 'Dépôt du pli', source: `${rc} — I.1.1.b`, fichier: '01_Dossier_administratif/Declaration_sur_l_honneur.docx', mode: 'genere',
  });
  P.push({
    id: 'A3', dossier: 'administratif', titre: `Cautionnement provisoire — ${caution}`,
    detail: `Récépissé du cautionnement provisoire OU attestation de caution personnelle et solidaire délivrée par une banque agréée. Montant : ${caution}. L'attestation ne doit comporter AUCUNE réserve ni restriction (délai de validité, engagement, responsabilité de la banque) sous peine d'élimination. Elle doit viser le N° ${ao.numero || '…'} et l'objet du marché.${elec ? ' Soumission électronique : caution à constituer de manière dématérialisée via le portail des marchés publics.' : ''}`,
    forme: 'Original délivré par la banque', quand: 'Dépôt du pli — à demander à la banque 3 à 5 jours avant', source: `${rc} — I.1.1.c / CPS art. 7`, fichier: '01_Dossier_administratif/Demande_caution_provisoire.docx', mode: 'genere',
  });
  if (ao.exigences.groupementPossible) {
    P.push({
      id: 'A4', dossier: 'administratif', titre: 'Convention constitutive du groupement (si groupement)',
      detail: "Uniquement si vous répondez en groupement : convention + note précisant l'objet, la nature du groupement, le mandataire, la durée et la répartition des prestations. Sans objet pour une candidature individuelle.",
      forme: 'Original ou copie certifiée conforme', quand: 'Dépôt du pli (si applicable)', source: `${rc} — I.1.1.d`, fichier: null, mode: 'manuel', optionnel: true,
    });
  }

  // ---------------- Dossier technique ----------------
  P.push({
    id: 'T1', dossier: 'technique', titre: 'Note indiquant les moyens humains et techniques',
    detail: "Moyens humains et techniques du concurrent ; le cas échéant : lieu, date, nature et importance des prestations déjà exécutées, avec précision de la qualité de participation.",
    forme: 'Note signée + cachet', quand: 'Dépôt du pli', source: `${rc} — I.2.a`, fichier: '02_Dossier_technique/Note_moyens_humains_et_techniques.docx', mode: 'genere',
  });
  P.push({
    id: 'T2', dossier: 'technique', titre: 'Attestations de référence (certifiées conformes)',
    detail: "Délivrées par les maîtres d'ouvrage publics/privés. Chacune doit préciser : nature des prestations, montant, année de réalisation, nom et qualité du signataire, appréciation. Toute attestation sans ces mentions ou non certifiée conforme est écartée, quelle que soit son importance.",
    forme: "Copies certifiées conformes à l'original", quand: 'Dépôt du pli', source: `${rc} — I.2.b`, fichier: '02_Dossier_technique/Modele_attestation_de_reference.docx', mode: 'modele',
  });
  P.push({
    id: 'T3', dossier: 'technique', titre: 'CPS et Règlement de consultation — « lu et accepté »',
    detail: "Toutes les pages paraphées, la dernière page signée, cachetée et portant la mention manuscrite « lu et accepté ».",
    forme: 'Original paraphé + signé + cachet', quand: 'Dépôt du pli', source: `${rc} — I.3`, fichier: null, mode: 'manuel',
  });
  if (ao.exigences.documentationTechnique) {
    const dl = ao.dateLimiteDocTech ? `À déposer au plus tard le ${fmtDateLong(ao.dateLimiteDocTech)} à ${fmtHeure(ao.heureLimiteDocTech)}${ao.lieuDocTech ? ' — ' + ao.lieuDocTech : ''}.` : '';
    P.push({
      id: 'T4', dossier: 'technique', titre: 'Documentation technique (prospectus, notices)',
      detail: `Notices, prospectus et documents techniques du matériel proposé, en français ou en anglais, format papier, dans un pli ou emballage fermé portant la mention « PROSPECTUS, NOTICES ET DOCUMENTS TECHNIQUE », le N° et l'objet de l'AO, et l'avertissement que le pli ne doit être ouvert que par le président de la commission lors de la séance d'ouverture. ${dl}`.trim(),
      forme: 'Papier, pli fermé séparé', quand: ao.dateLimiteDocTech ? `AVANT le ${fmtDate(ao.dateLimiteDocTech)} ${fmtHeure(ao.heureLimiteDocTech)}` : "Date limite de l'Avis", source: 'RC — Dépôt des prospectus, notices et documents techniques', fichier: '04_Enveloppes_et_pages_de_garde/Pages_de_garde_et_enveloppes.docx', mode: 'genere',
    });
  }
  if (ao.exigences.tableauConformite) {
    P.push({
      id: 'T5', dossier: 'technique', titre: 'Tableau de conformité',
      detail: "Annexe du dossier d'appel d'offres, dûment renseignée (colonne « spécifications proposées », conformité, écarts) et signée. Il doit être basé sur la documentation technique : en cas de contradiction, la documentation technique prime. Une seule spécification non conforme rend l'offre non conforme.",
      forme: 'Signé + cachet', quand: ao.docTechSeparee ? 'Avec la documentation technique' : 'Dépôt du pli', source: 'RC — Documentation technique / examen', fichier: '02_Dossier_technique/Tableau_de_conformite.xlsx', mode: 'genere',
    });
  }
  if (ao.exigences.attestationConstructeur) {
    P.push({
      id: 'T6', dossier: 'technique', titre: 'Attestation(s) du constructeur',
      detail: `Attestation originale ou copie conforme du constructeur justifiant les capacités du soumissionnaire pour l'installation et la configuration du matériel proposé, en précisant le N° de l'AO (${ao.numero || '…'}) dans le texte de l'attestation. Une par marque concernée.`,
      forme: 'Original ou copie conforme', quand: ao.docTechSeparee ? 'Avec la documentation technique' : 'Dépôt du pli', source: 'RC — Documentation technique', fichier: '02_Dossier_technique/Demande_attestation_constructeur.docx', mode: 'modele',
    });
  }
  if (ao.exigences.echantillons) {
    P.push({ id: 'T7', dossier: 'technique', titre: 'Échantillons', detail: 'Le RC/CPS mentionne des échantillons : vérifier dans le RC les modalités (nombre, lieu, date limite, étiquetage).', forme: 'Selon RC', quand: 'Voir RC', source: 'RC', fichier: null, mode: 'manuel' });
  }
  if (ao.exigences.visiteLieux) {
    P.push({ id: 'T8', dossier: 'technique', titre: 'Attestation de visite des lieux', detail: 'Le RC/CPS mentionne une visite des lieux : vérifier la date et les modalités.', forme: 'Selon RC', quand: 'Voir RC', source: 'RC', fichier: null, mode: 'manuel' });
  }

  // ---------------- Offre financière ----------------
  P.push({
    id: 'F1', dossier: 'financier', titre: "Acte d'engagement",
    detail: "Un seul exemplaire, selon le modèle annexé. Signé par le représentant habilité, avec toutes les indications requises dont le RIB (24 positions). Montant total en chiffres ET en toutes lettres (HT, TVA, TTC), en tenant compte du rabais éventuel ; en cas de discordance, le montant en lettres prévaut.",
    forme: 'Original signé + cachet', quand: 'Dépôt du pli', source: 'RC — Offre financière (a)', fichier: '03_Offre_financiere/Acte_d_engagement.docx', mode: 'genere',
  });
  P.push({
    id: 'F2', dossier: 'financier', titre: 'Bordereau des prix — détail estimatif',
    detail: "Selon le modèle du dossier : prix unitaires et montants totaux en chiffres, mêmes libellés, unités et quantités que le modèle (toute différence entraîne l'élimination). En cas de discordance avec l'acte d'engagement, le montant du bordereau est tenu pour bon.",
    forme: 'Original signé + cachet', quand: 'Dépôt du pli', source: 'RC — Offre financière (b)', fichier: '03_Offre_financiere/Bordereau_des_prix.xlsx', mode: 'genere',
  });

  // ---------------- Attributaire pressenti ----------------
  const att = (id, titre, detail, extra = {}) => P.push({ id, dossier: 'attributaire', titre, detail, forme: 'Original ou copie certifiée conforme', quand: 'Sur demande de complément (si classé 1er)', source: `${rc} — I.1.2`, fichier: null, mode: 'manuel', ...extra });
  att('C1', 'Attestation fiscale (régularité)', "Délivrée depuis moins d'un an par le percepteur du lieu d'imposition, mentionnant l'activité au titre de laquelle le concurrent est imposé.");
  att('C2', 'Attestation CNSS (régularité)', "Délivrée depuis moins d'un an par la CNSS (ou autre organisme de prévoyance sociale).");
  att('C3', "Certificat d'immatriculation au registre du commerce (modèle 9)", 'Copie du modèle 9 (RC).', { forme: 'Copie' });
  att('C4', 'Attestations / autorisations requises pour les prestations', "Le cas échéant (copie certifiée conforme) : autorisations ou agréments exigés par la réglementation pour l'activité.");
  if (ao.reservePME) {
    att('C5', 'Attestation CNSS — effectif ≤ 200 personnes', "Marché réservé PME : justifie que l'effectif employé ne dépasse pas 200 personnes.");
    att('C6', "Attestation du chiffre d'affaires / du bilan", "Attestation (ou copie certifiée) des 2 dernières années mentionnant un chiffre d'affaires annuel HT ≤ 75 000 000 DH, OU attestation du bilan annuel délivrée par la DGI (2 dernières années) ≤ 50 000 000 DH.");
  }
  att('C7', 'Originaux des pièces de la soumission', elec ? "Soumission électronique : produire l'original de l'ensemble des documents déposés lors de la soumission, dans le délai fixé par le maître d'ouvrage, sous peine de voir l'offre écartée." : "Présenter les originaux des documents exigés par le RC et ayant fait l'objet de la soumission, dans le délai fixé par le maître d'ouvrage.", { forme: 'Originaux' });

  for (const e of ao.piecesExtra || []) {
    P.push({ id: `X${P.length}`, dossier: e.dossier || 'technique', titre: e.titre, detail: e.detail || '', forme: e.forme || '', quand: e.quand || 'Dépôt du pli', source: 'Ajout manuel', fichier: null, mode: 'manuel' });
  }
  const off = new Set(ao.piecesDesactivees || []);
  return P.filter(p => !off.has(p.id));
}

export const DOSSIERS = {
  administratif: 'Dossier administratif',
  technique: 'Dossier technique',
  financier: 'Offre financière',
  attributaire: "Pièces demandées à l'attributaire pressenti",
};

/** Calendrier de préparation (rétroplanning) calculé à partir des dates de l'AO. */
export function buildCalendar(ao, today = new Date()) {
  const rows = [];
  const add = (date, heure, action, note, tone = 'normal') => {
    if (date) rows.push({ date, heure: heure || '', action, note: note || '', tone, jours: daysUntil(date, today) });
  };
  const ouv = ao.dateOuverture;
  if (ouv) {
    add(addDays(ouv, -10), '', "Dernier jour conseillé pour poser une question au maître d'ouvrage", "Le RC fixe la limite à 7 jours avant l'ouverture ; une demande reçue entre J-10 et J-7 reçoit réponse au plus tard 3 jours avant l'ouverture.", 'soft');
    add(addDays(ouv, -7), '', "DATE LIMITE des demandes d'éclaircissements écrites", "Lettre transmise par un moyen donnant date certaine, au moins 7 jours avant la séance d'ouverture.");
    add(addDays(ouv, -6), '', 'Demander la caution bancaire à la banque', "Prévoir 2 à 3 jours ouvrés ; vérifier N° AO, montant, absence de réserve.", 'soft');
    add(addDays(ouv, -3), '', 'Compléter, relire, faire signer et parapher toutes les pièces', 'CPS/RC paraphés + « lu et accepté », tableau de conformité, bordereau des prix.', 'soft');
  }
  if (ao.docTechSeparee && ao.dateLimiteDocTech) {
    add(ao.dateLimiteDocTech, ao.heureLimiteDocTech, 'DÉPÔT de la documentation technique (pli séparé, papier)', ao.lieuDocTech || 'Selon Avis', 'critical');
  }
  if (ouv) {
    add(ouv, ao.heureOuverture, "SÉANCE D'OUVERTURE DES PLIS — date limite de dépôt du pli de candidature", ao.lieuOuverture || '', 'critical');
    if (ao.validiteOffresJours) add(addDays(ouv, ao.validiteOffresJours), '', `Fin de validité de l'offre (${ao.validiteOffresJours} jours à compter de l'ouverture)`, "Le maître d'ouvrage peut demander une prorogation avant cette date.", 'soft');
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.heure.localeCompare(b.heure));
}

/** Bornes « offre excessive / anormalement basse » par rapport à l'estimation du maître d'ouvrage. */
export function tenderLimits(ao) {
  if (ao.estimation == null) return null;
  const hi = ao.seuilExcessifPct ?? 20, lo = ao.seuilBasPct ?? 25;
  return { estimation: ao.estimation, type: ao.estimationType || 'TTC', max: ao.estimation * (1 + hi / 100), min: ao.estimation * (1 - lo / 100), hi, lo };
}

// ---------------------------------------------------------------------------------------------
// Mode IA : la liste des pièces est celle que l'IA a lue dans le RC de CET appel d'offres.
// `type` choisit le générateur ; les pièces sans générateur restent « à obtenir » ou « modèle à faire remplir ».
const SLUG = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'document';

const GEN_FILES = {
  declaration_honneur: ['01_Dossier_administratif/Declaration_sur_l_honneur.docx', 'genere'],
  caution_provisoire: ['01_Dossier_administratif/Demande_caution_provisoire.docx', 'genere'],
  note_moyens: ['02_Dossier_technique/Note_moyens_humains_et_techniques.docx', 'genere'],
  attestation_reference: ['02_Dossier_technique/Modele_attestation_de_reference.docx', 'modele'],
  attestation_constructeur: ['02_Dossier_technique/Demande_attestation_constructeur.docx', 'modele'],
  tableau_conformite: ['02_Dossier_technique/Tableau_de_conformite.xlsx', 'genere'],
  documentation_technique: ['04_Enveloppes_et_pages_de_garde/Pages_de_garde_et_enveloppes.docx', 'genere'],
  acte_engagement: ['03_Offre_financiere/Acte_d_engagement.docx', 'genere'],
  bordereau_prix: ['03_Offre_financiere/Bordereau_des_prix.xlsx', 'genere'],
};

/** Chemin du fichier produit pour une pièce IA (null si pièce à obtenir). */
export function pieceFile(piece) {
  if (GEN_FILES[piece.type]) return GEN_FILES[piece.type][0];
  if (piece.type === 'autre_a_rediger') {
    const dir = piece.dossier === 'financier' ? '03_Offre_financiere' : piece.dossier === 'administratif' ? '01_Dossier_administratif' : '02_Dossier_technique';
    return `${dir}/${SLUG(piece.titre)}.docx`;
  }
  return null;
}

function buildPiecesIA(ao) {
  const off = new Set(ao.piecesDesactivees || []);
  const P = ao.piecesIA.map(x => {
    const fichier = pieceFile(x);
    const mode = fichier ? (GEN_FILES[x.type]?.[1] || 'genere') : 'manuel';
    return { id: x.id, dossier: x.dossier, titre: x.titre, detail: x.detail, forme: x.forme, quand: x.quand, source: x.source || 'RC', fichier, mode, optionnel: x.optionnel, type: x.type, ancrage: x.ancrage, extrait: x.extrait };
  });
  (ao.piecesExtra || []).forEach((e, i) => P.push({ id: `X${i + 1}`, dossier: e.dossier || 'technique', titre: e.titre, detail: e.detail || '', forme: e.forme || '', quand: e.quand || 'Dépôt du pli', source: 'Ajout manuel', fichier: null, mode: 'manuel' }));
  return P.filter(p => !off.has(p.id));
}
