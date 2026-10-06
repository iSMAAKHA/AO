// « Les éléments du dossier d'appel d'offres » — document de synthèse détaillé : fiche AO, calendrier, pièces
// à fournir par dossier (avec forme, échéance, source, modèle fourni), contrôles et check-list finale.
import { p, h1, h2, title, center, table, note, bullet, makeDoc, toBuffer, COLORS, AlignmentType } from './helpers.js';
import { buildPieces, buildCalendar, tenderLimits, DOSSIERS } from '../pieces.js';
import { addDays, fmtDate, fmtDateLong, fmtHeure, fmtMoney, weekday } from '../util.js';
import { totals } from './financier.js';
import { companyFullName } from '../company.js';

const BOX = '☐';
const dash = v => (v == null || v === '' ? '— (à saisir)' : v);

function jours(n) {
  if (n == null) return '';
  if (n < 0) return `passé (${-n} j)`;
  return n === 0 ? "AUJOURD'HUI" : `J-${n}`;
}

export async function elementsDossier(ao, c, opts = {}) {
  const today = opts.today ?? new Date();
  const mo = ao.maitreOuvrage;
  const pieces = buildPieces(ao);
  const cal = buildCalendar(ao, today);
  const lim = tenderLimits(ao);
  const r = [];

  // ------------------------------------------------------------ En-tête
  r.push(center("Les éléments du dossier d'appel d'offres", { size: 22, color: COLORS.muted, after: 40 }));
  r.push(title(`${ao.modePassation || "Appel d'offres ouvert"} N° ${ao.numero || '………'}`, { size: 34, after: 60 }));
  r.push(center(ao.objet || '', { size: 26, bold: true, after: 60 }));
  r.push(center(ao.dateOuverture ? `Séance d'ouverture des plis : ${fmtDateLong(ao.dateOuverture)} à ${fmtHeure(ao.heureOuverture)}` : "Séance d'ouverture des plis : date à saisir", { size: 24, bold: true, color: 'B91C1C', after: 60 }));
  r.push(center(`Soumissionnaire : ${companyFullName(c)}  —  document établi le ${fmtDate(today.toISOString().slice(0, 10))}`, { size: 18, color: COLORS.muted, after: 200 }));

  // ------------------------------------------------------------ 1. Fiche
  r.push(h1("1. Fiche de l'appel d'offres"));
  const fiche = [
    ["Maître d'ouvrage", `${dash(mo.nom)}${mo.representant ? `, représenté par ${mo.representant}` : ''}`],
    ['Adresse', [mo.adresse, mo.ville].filter(Boolean).join(', ') || '— (à saisir)'],
    ['Mode de passation', ao.modePassation],
    ['Objet / consistance', `${dash(ao.objet)} — ${ao.lots || 'lot unique'}`],
    ['Public visé', ao.reservePME ? "Marché RÉSERVÉ à la très petite, petite et moyenne entreprise nationale, aux coopératives, unions de coopératives et auto-entrepreneurs" : 'Ouvert à tous les concurrents remplissant les conditions du règlement de consultation'],
    ["Séance d'ouverture des plis", ao.dateOuverture ? `${fmtDateLong(ao.dateOuverture)} à ${fmtHeure(ao.heureOuverture)}${ao.lieuOuverture ? ' — ' + ao.lieuOuverture : ''}` : "— (à saisir : figure dans l'Avis)"],
    ...(ao.docTechSeparee ? [['Dépôt de la documentation technique (pli séparé)', ao.dateLimiteDocTech ? `AU PLUS TARD le ${fmtDateLong(ao.dateLimiteDocTech)} à ${fmtHeure(ao.heureLimiteDocTech)}${ao.lieuDocTech ? ' — ' + ao.lieuDocTech : ''}` : "— (à saisir : figure dans l'Avis)"]] : []),
    ['Retrait du dossier', `Téléchargement sur le portail des marchés publics : ${ao.portail}`],
    ['Cautionnement provisoire', ao.cautionProvisoire != null ? `${fmtMoney(ao.cautionProvisoire)} DH` : '— (à saisir)'],
    ['Cautionnement définitif', ao.cautionDefinitifPct != null ? `${ao.cautionDefinitifPct} % du montant initial du marché (dans les 20 jours suivant la notification de l'approbation)` : '—'],
    ['Retenue de garantie', ao.retenueGarantiePct != null ? `1/10 de chaque acompte, plafonnée à ${ao.retenueGarantiePct} % du montant initial (remplaçable par une caution)` : '—'],
    ["Estimation du maître d'ouvrage", ao.estimation != null ? `${fmtMoney(ao.estimation)} DH ${ao.estimationType}` : "— (à saisir : figure dans l'Avis)"],
    ["Validité de l'offre", ao.validiteOffresJours ? `${ao.validiteOffresJours} jours à compter de la date d'ouverture des plis${ao.dateOuverture ? ` (jusqu'au ${fmtDate(addDays(ao.dateOuverture, ao.validiteOffresJours))})` : ''}` : '—'],
    ["Délai d'exécution", dash(ao.delaiExecution)],
    ['Délai de garantie', dash(ao.delaiGarantie)],
    ['Pénalités de retard', dash(ao.penalites)],
    ['Monnaie / TVA', `Dirham marocain — TVA ${ao.tauxTVA ?? 20} %`],
    ['Soumission électronique', ao.soumissionElectronique ? 'Possible via le portail (signature électronique, caution dématérialisée, originaux à produire si classé 1er)' : 'Non mentionnée'],
  ];
  r.push(table(null, fiche.map(([k, v]) => [{ text: k, bold: true, fill: COLORS.head }, v]), [3000, 6900]));

  // ------------------------------------------------------------ 2. Calendrier
  r.push(h1('2. Dates clés et calendrier de préparation'));
  if (cal.length) {
    r.push(table(['Date', 'Heure', 'Échéance', 'Délai', 'Précision'],
      cal.map(x => {
        const fill = x.tone === 'critical' ? COLORS.warn : x.tone === 'soft' ? undefined : COLORS.note;
        return [{ text: `${weekday(x.date)} ${fmtDate(x.date)}`, fill, bold: x.tone !== 'soft' }, { text: x.heure ? fmtHeure(x.heure) : '', fill }, { text: x.action, fill, bold: x.tone === 'critical' }, { text: jours(x.jours), fill, bold: true }, { text: x.note, fill }];
      }), [1700, 800, 3300, 900, 3200]));
    r.push(p('', { after: 60 }));
    r.push(note("Les échéances « J-n » se calculent à partir de la date d'ouverture des plis. Les lignes rouges sont éliminatoires : un pli reçu après l'heure limite n'est pas admis (les plis électroniques tardifs sont automatiquement rejetés par le portail)."));
  } else {
    r.push(note("Aucune date saisie : renseignez la date d'ouverture des plis (et, le cas échéant, la date limite de la documentation technique) pour générer le calendrier."));
  }

  // ------------------------------------------------------------ 3. Structure du dépôt
  r.push(h1('3. Structure du dépôt (comment présenter les plis)'));
  const mentions = "Nom et adresse du concurrent ; objet de l'appel d'offres ; date et heure de la séance d'ouverture ; avertissement « le pli ne doit être ouvert que par le président de la commission d'appel d'offres lors de la séance publique d'ouverture des plis »";
  const plis = [
    ['PLI EXTÉRIEUR (unique)', 'Enveloppe n° 1 + enveloppe n° 2', mentions, 'Déposé / envoyé / remis (voir modes de dépôt)'],
    ['ENVELOPPE N° 1 — « Dossiers administratif, technique, CPS et Règlement de consultation »', "Dossier administratif + dossier technique + CPS + RC (paraphés, signés, « lu et accepté »), chaque dossier accompagné de son état des pièces", "Mêmes mentions que le pli + intitulé de l'enveloppe", 'Fermée'],
    ['ENVELOPPE N° 2 — « Offre financière »', "Acte d'engagement + bordereau des prix – détail estimatif (signés)", 'Mêmes mentions que le pli + « Offre financière »', 'Fermée'],
  ];
  if (ao.docTechSeparee || ao.exigences.documentationTechnique) {
    plis.push([
      'PLI SÉPARÉ — « Prospectus, notices et documents technique »',
      `Documentation technique (papier)${ao.exigences.tableauConformite ? ' + tableau de conformité' : ''}${ao.exigences.attestationConstructeur ? ' + attestation(s) constructeur' : ''}`,
      "Mention « PROSPECTUS, NOTICES ET DOCUMENTS TECHNIQUE », N° et objet de l'AO, avertissement d'ouverture réservée au président de la commission. Langue : français ou anglais.",
      ao.dateLimiteDocTech ? `À déposer AVANT le ${fmtDate(ao.dateLimiteDocTech)} à ${fmtHeure(ao.heureLimiteDocTech)}${ao.lieuDocTech ? ' — ' + ao.lieuDocTech : ''}` : "À déposer avant la date limite de l'Avis",
    ]);
  }
  r.push(table(['Contenant', 'Contenu', 'Mentions à porter', 'Remise'], plis, [2300, 3000, 2900, 1700], { size: 18 }));
  r.push(p('Modes de dépôt possibles (un seul à choisir) :', { bold: true, before: 140 }));
  [
    `Dépôt contre récépissé au bureau d'ordre${mo.adresse ? ' — ' + mo.adresse + (mo.ville ? ', ' + mo.ville : '') : ''}`,
    'Envoi par courrier recommandé avec accusé de réception',
    "Remise au président de la commission au début de la séance, avant l'ouverture des plis",
    `Dépôt électronique via le portail ${ao.portail} (fichiers bien classés, checklist, signature électronique du représentant habilité)`,
  ].forEach(t => r.push(bullet(t)));

  // ------------------------------------------------------------ 4. Pièces
  r.push(h1('4. Détail des pièces à fournir'));
  r.push(p("Légende — « Modèle fourni » : fichier généré par l'application dans le dossier de sortie ; « à obtenir » : pièce à réunir par l'entreprise (administration, banque, client…) ; « modèle à faire remplir » : document à faire établir par un tiers.", { size: 18, color: COLORS.muted }));
  for (const [key, label] of Object.entries(DOSSIERS)) {
    const list = pieces.filter(x => x.dossier === key);
    if (!list.length) continue;
    r.push(h2(label + (key === 'attributaire' ? " (après l'ouverture des plis, si votre offre est classée première)" : '')));
    r.push(table([BOX, 'Pièce et contenu exigé', 'Forme — Quand', 'Source', 'Modèle fourni'], list.map(x => {
      const nom = x.fichier ? x.fichier.split('/').pop() : '';
      const modele = x.mode === 'genere' ? { text: `✔ ${nom}`, fill: COLORS.ok }
        : x.mode === 'modele' ? { text: `✔ ${nom} (modèle à faire remplir)`, fill: COLORS.ok }
          : { text: 'à obtenir', fill: COLORS.note };
      return [
        { text: BOX, align: AlignmentType.CENTER },
        [p(`**${x.id} — ${x.titre}**${x.optionnel ? ' (si applicable)' : ''}`, { size: 19, after: 40 }), p(x.detail, { size: 17, after: 20, color: COLORS.ink })],
        `${x.forme} — ${x.quand}`, x.source, modele,
      ];
    }), [450, 4700, 1900, 1300, 1550], { size: 17, cantSplit: false }));
  }

  // ------------------------------------------------------------ 5. Fournitures
  if (ao.items.length) {
    r.push(h1('5. Prestations / fournitures demandées'));
    r.push(table(['N° prix', 'Désignation', 'Unité', 'Quantité', 'Spécifications (lignes)'], ao.items.map(i => [String(i.n), i.designation, i.unite || 'U', i.quantite == null ? '—' : String(i.quantite), String(i.specs.length)]), [900, 5000, 900, 1100, 2000]));
    r.push(p("Les libellés, unités et quantités du bordereau des prix doivent rester identiques à ceux du dossier. Le détail des spécifications est repris ligne par ligne dans le tableau de conformité.", { size: 18, before: 80, color: COLORS.muted }));
  }

  // ------------------------------------------------------------ 6. Offre financière
  r.push(h1("6. Contrôle de l'offre financière"));
  if (lim) {
    r.push(table(['Repère', `Montant (DH ${lim.type})`, 'Règle'], [
      ["Estimation du maître d'ouvrage", fmtMoney(lim.estimation), 'Base de comparaison'],
      [{ text: `Plafond « offre excessive » (+${lim.hi} %)`, fill: COLORS.warn }, { text: fmtMoney(lim.max), fill: COLORS.warn }, 'Au-dessus : offre écartée'],
      [{ text: `Plancher « anormalement basse » (−${lim.lo} %)`, fill: COLORS.warn }, { text: fmtMoney(lim.min), fill: COLORS.warn }, 'En dessous : offre écartée'],
    ], [4000, 2400, 3500]));
  } else {
    r.push(note("Estimation non renseignée : saisissez-la pour obtenir les bornes d'acceptabilité de votre offre."));
  }
  const t = totals(ao);
  if (t.complet) {
    const ref = lim ? (lim.type === 'TTC' ? t.ttc : t.ht) : null;
    const ecart = ref != null ? ` — ${ref / lim.estimation - 1 >= 0 ? '+' : ''}${((ref / lim.estimation - 1) * 100).toFixed(1)} % par rapport à l'estimation` : '';
    r.push(p(`Offre saisie : **${fmtMoney(t.ht)} DH HT** — **${fmtMoney(t.ttc)} DH TTC**${ecart}.`, { before: 100 }));
  }
  r.push(p("Attribution : prix de référence = moyenne de l'estimation et de la moyenne des offres retenues (hors excessives et anormalement basses) ; l'offre la mieux-disante est la plus proche du prix de référence par défaut (à défaut d'offre inférieure, la plus proche par excès). Tous les prix unitaires du bordereau sont aussi contrôlés (prix unitaires excessifs ou anormalement bas).", { before: 100, size: 19 }));

  // ------------------------------------------------------------ 7. Vigilance
  r.push(h1("7. Causes d'élimination — points de vigilance"));
  [
    "**Caution provisoire** : toute réserve ou restriction (validité, engagement, responsabilité de la banque) ⇒ élimination. Vérifier montant, N° d'AO, bénéficiaire et objet.",
    '**Attestations de référence** : sans les 5 mentions (nature, montant, année, nom et qualité du signataire, appréciation) ou non certifiées conformes ⇒ non prises en considération.',
    '**Tableau de conformité** : une seule spécification non conforme ⇒ offre non conforme ; en cas de contradiction avec la documentation technique, la documentation technique prime.',
    "**Offre financière** : non signée, signée par une personne non habilitée (au regard des pièces de pouvoir), avec réserves ou restrictions, ou avec des libellés / unités / quantités différents du bordereau ⇒ écartée.",
    "**Discordances** : montant en lettres ≠ chiffres → les lettres prévalent ; acte d'engagement ≠ bordereau → le bordereau prévaut.",
    '**CPS et RC** : toutes pages paraphées, dernière page signée + cachet + « lu et accepté » manuscrit.',
    '**Délais** : pli reçu après la date/heure limite non admis (documentation technique comprise).',
    "**Fausse déclaration** : la commission peut vérifier auprès des administrations ; toute fausse déclaration peut conduire à l'élimination.",
    ...(ao.reservePME ? ["**Marché réservé** : effectif ≤ 200 personnes (attestation CNSS) et chiffre d'affaires ≤ 75 M DH (ou bilan ≤ 50 M DH) ; société gérée par ses propriétaires et détenue à moins de 25 % par des entreprises non PME."] : []),
  ].forEach(x => r.push(bullet(x)));

  // ------------------------------------------------------------ 8. Après attribution
  r.push(h1('8. Après le dépôt — si vous êtes attributaire'));
  [
    "Demande de complément du dossier : produire les pièces de la section 4 (« pièces demandées à l'attributaire pressenti ») et les originaux, dans le délai fixé.",
    `Cautionnement définitif : ${ao.cautionDefinitifPct ?? '…'} % du montant initial, à constituer dans les 20 jours suivant la notification de l'approbation (sinon la caution provisoire reste acquise).`,
    "Ordre de service de commencement : au plus tard 30 jours après la notification de l'approbation.",
    `Exécution : ${ao.delaiExecution || '…'} ; pénalités de retard : ${ao.penalites || '…'} du montant initial par jour.`,
    `Garantie : ${ao.delaiGarantie || '…'} à compter de la réception provisoire ; réception définitive à l'expiration de la garantie.`,
    "Frais d'enregistrement du marché à la charge du prestataire.",
  ].forEach(x => r.push(bullet(x)));

  // ------------------------------------------------------------ 9. Alertes
  if (ao.alertes?.length) {
    r.push(h1('9. Points à vérifier dans le RC / CPS'));
    ao.alertes.forEach(a => r.push(bullet(a.texte)));
  }

  // ------------------------------------------------------------ 10. Check-list
  r.push(h1('10. Check-list finale avant dépôt'));
  [
    "Données de l'AO (numéro, objet, dates) vérifiées sur l'Avis publié",
    'Pièces de pouvoir à jour (statuts / PV / procuration légalisée)',
    'Caution provisoire reçue de la banque et contrôlée (aucune réserve)',
    "Déclaration sur l'honneur signée et cachetée",
    'Note moyens humains et techniques complétée et signée',
    'Attestations de référence certifiées conformes',
    'CPS et RC : toutes pages paraphées, dernière page signée, cachetée, « lu et accepté »',
    ...(ao.exigences.tableauConformite ? ['Tableau de conformité renseigné (marque / modèle / références) et signé'] : []),
    ...(ao.exigences.attestationConstructeur ? ["Attestation(s) constructeur avec mention du N° de l'AO"] : []),
    ...(ao.exigences.documentationTechnique ? ['Documentation technique imprimée, pli séparé fermé, déposé avant la date limite'] : []),
    "Acte d'engagement : montants en chiffres et en lettres, RIB, signature",
    'Bordereau des prix : mêmes libellés / unités / quantités, totaux vérifiés, signature',
    'Offre comprise entre le plancher et le plafond (section 6)',
    'États des pièces joints à chaque dossier',
    'Enveloppes n° 1 et n° 2 fermées, mentions apposées, glissées dans le pli extérieur',
    'Récépissé de dépôt (ou accusé de réception) conservé',
  ].forEach(x => r.push(p(`${BOX}  ${x}`, { after: 60, indent: 300, hanging: 300 })));

  return toBuffer(makeDoc(r, { footer: `Éléments du dossier — AO N° ${ao.numero}` }));
}
