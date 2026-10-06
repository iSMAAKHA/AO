// Dossier technique : note moyens humains/techniques, modèles d'attestations, tableau de conformité (xlsx).
import ExcelJS from 'exceljs';
import { p, h2, title, fields, signature, note, table, makeDoc, toBuffer, bullet, pageBreak, AlignmentType } from './helpers.js';
import { fmtDate, fmtMoney } from '../util.js';
import { companyFullName } from '../company.js';

const sigleMO = ao => ao.maitreOuvrage.sigle || ao.maitreOuvrage.nom || "l'Administration";
const blank = (v, w = '………………………') => (v === '' || v == null ? w : v);

// ---------------------------------------------------------------- Note moyens humains et techniques
export async function noteMoyens(ao, c, opts = {}) {
  const r = [];
  r.push(title('NOTE INDIQUANT LES MOYENS HUMAINS ET TECHNIQUES', { size: 28, after: 100 }));
  r.push(p(`Appel d'offres ouvert N° **${ao.numero || '………'}** — ${ao.objet || ''}`, { align: AlignmentType.CENTER, after: 200 }));

  r.push(h2('1. Présentation du concurrent'));
  r.push(fields([
    ['Raison sociale', companyFullName(c)],
    ['Capital social', c.capital ? `${fmtMoney(c.capital)} DH` : ''],
    ['Siège social', c.adresseSiege],
    ['RC / ICE / CNSS', `RC ${c.rcVille} n° ${c.rcNumero} — ICE ${c.ice} — CNSS ${c.cnss}`],
    ['Représentant légal', `${c.representant.nom}, ${c.representant.qualite}`],
    ["Domaine d'activité", c.activite],
  ], 2600, 7300));

  r.push(h2('2. Moyens humains'));
  r.push(p("Équipe qui sera affectée à l'exécution du marché (livraison, installation, configuration, tests, garantie) :"));
  const hum = (c.moyensHumains?.length ? c.moyensHumains : [{}]).map(m => [blank(m.nom), blank(m.fonction), blank(m.formation), blank(m.experience)]);
  r.push(table(['Nom et prénom', 'Fonction / rôle dans le marché', 'Formation / diplôme', 'Expérience'], hum, [2400, 2900, 2600, 2000]));

  r.push(h2('3. Moyens techniques et logistiques'));
  (c.moyensTechniques?.length ? c.moyensTechniques : ['…………………………']).forEach(m => r.push(bullet(m)));

  r.push(h2('4. Organisation proposée pour ce marché'));
  const nb = ao.items.reduce((a, i) => a + (Number(i.quantite) || 0), 0);
  r.push(bullet(`**Livraison** : ${ao.items.length || '…'} type(s) d'équipement${nb ? `, ${nb} unités au total` : ''}, livrés sur site en présence des représentants de ${sigleMO(ao)}, avec bon de livraison mentionnant la référence du marché, la désignation et les quantités.`));
  r.push(bullet("**Installation et configuration** : déploiement des masters standards fournis par le maître d'ouvrage, installation des pilotes, tests de bon fonctionnement, configuration des périphériques."));
  r.push(bullet(`**Délai d'exécution** : ${ao.delaiExecution || '…………'} à compter de l'ordre de service.`));
  r.push(bullet(`**Garantie et service après-vente** : garantie constructeur conforme au CPS${ao.delaiGarantie ? ` ; délai de garantie de ${ao.delaiGarantie} à compter de la réception provisoire` : ''}. Interlocuteur dédié, intervention sur site, remplacement du matériel défectueux.`));

  r.push(h2('5. Références (prestations similaires exécutées)'));
  const refs = (c.references?.length ? c.references : [{}]).map(x => [blank(x.client), blank(x.objet), blank(x.annee), blank(x.montant), blank(x.contact)]);
  r.push(table(["Maître d'ouvrage / client", 'Nature des prestations', 'Année', 'Montant (DH)', 'Qualité de participation'], refs, [2400, 3000, 900, 1700, 1900]));
  r.push(p('Les attestations de référence correspondantes (certifiées conformes) sont jointes au dossier technique.', { before: 100, italics: true }));

  r.push(...signature(c.villeSignature, fmtDate(opts.dateSignature)));
  r.push(note("À compléter avant signature : noms, formations et années d'expérience de l'équipe, et références réelles. Saisissez-les une fois dans l'onglet « Entreprise » de l'application : elles seront reprises dans tous les prochains dossiers."));
  return toBuffer(makeDoc(r, { footer: `Moyens humains et techniques — AO N° ${ao.numero}` }));
}

// ---------------------------------------------------------------- Modèle d'attestation de référence
export async function modeleAttestationReference(ao, c) {
  const r = [];
  r.push(p("À FAIRE ÉTABLIR PAR LE CLIENT SUR SON PAPIER À EN-TÊTE, PUIS FAIRE CERTIFIER CONFORME À L'ORIGINAL", { size: 17, bold: true, color: '9A3412', align: AlignmentType.CENTER, after: 200 }));
  r.push(title('ATTESTATION DE RÉFÉRENCE', { size: 34, after: 300 }));
  r.push(p('Je soussigné(e) : ………………………………………………………………… (nom et prénom)'));
  r.push(p('Qualité : ………………………………………………………………… (fonction du signataire)'));
  r.push(p("Agissant au nom de : ………………………………………………………………… (maître d'ouvrage — public ou privé)"));
  r.push(p(`atteste que la société **${companyFullName(c)}**, dont le siège est situé ${c.adresseSiege}, a exécuté pour notre compte les prestations suivantes :`, { before: 120 }));
  r.push(fields([
    ['Nature des prestations', ''],
    ['Référence du marché / contrat / bon de commande', ''],
    ["Lieu d'exécution", ''],
    ['Montant (en DH, préciser HT ou TTC)', ''],
    ['Année de réalisation', ''],
    ['Qualité de participation (titulaire, sous-traitant, membre de groupement)', ''],
    ['Délais respectés', 'oui  /  non'],
  ], 5000, 4900));
  r.push(p('Appréciation (qualité de la prestation, respect des délais, satisfaction) :', { before: 140, bold: true }));
  r.push(p('………………………………………………………………………………………………………………………………………………………', { after: 60 }));
  r.push(p('………………………………………………………………………………………………………………………………………………………', { after: 60 }));
  r.push(p("La présente attestation est délivrée à l'intéressée pour servir et valoir ce que de droit.", { before: 140 }));
  r.push(...signature('………………………', '……………………', "Nom, qualité, signature et cachet du maître d'ouvrage"));
  r.push(note([
    '**Mentions obligatoires** (une attestation qui en omet une est écartée, quelle que soit son importance) :',
    '• nature des prestations • montant • année de réalisation • nom et qualité du signataire • appréciation.',
    "**Certification** : joindre une copie certifiée conforme à l'original (légalisation à la commune / l'arrondissement). Pour une soumission électronique, l'original n'est demandé qu'au concurrent classé premier.",
  ]));
  return toBuffer(makeDoc(r, { footer: "Modèle d'attestation de référence" }));
}

// ---------------------------------------------------------------- Demande d'attestation constructeur
export async function demandeAttestationConstructeur(ao, c, opts = {}) {
  const r = [];
  const mo = ao.maitreOuvrage.nom || sigleMO(ao);
  r.push(p(companyFullName(c).toUpperCase(), { bold: true, after: 20 }));
  r.push(p(c.adresseSiege, { after: 20 }));
  r.push(p(`Tél : ${c.telephone} — ${c.email}`, { after: 200 }));
  r.push(p("À l'attention de : ………………………………………… (constructeur / distributeur officiel — responsable partenaires)", { align: AlignmentType.RIGHT, after: 200 }));
  r.push(p(`Objet : demande d'attestation constructeur — Appel d'offres ouvert N° ${ao.numero || '………'}`, { bold: true, after: 160 }));
  r.push(p(`${c.villeSignature || 'Casablanca'}, le ${fmtDate(opts.dateSignature)}`, { align: AlignmentType.RIGHT, after: 160 }));
  r.push(p('Madame, Monsieur,'));
  r.push(p(`Dans le cadre de l'appel d'offres ouvert **N° ${ao.numero || '………'}** lancé par **${mo}**, relatif à « **${ao.objet || '…'}** »${ao.dateOuverture ? `, dont la séance d'ouverture des plis est fixée au ${fmtDate(ao.dateOuverture)}` : ''}, nous envisageons de proposer du matériel de votre marque.`));
  r.push(p("Le règlement de consultation exige une attestation, originale ou copie conforme, du constructeur justifiant les capacités du soumissionnaire pour l'installation et la configuration du matériel proposé, **avec mention du N° de l'appel d'offres dans l'attestation**."));
  r.push(p("Nous vous remercions de bien vouloir nous délivrer cette attestation, selon le modèle ci-après, pour les équipements suivants (supprimer les lignes non concernées) :", { before: 60 }));
  r.push(table(['N°', 'Équipement', 'Quantité', 'Référence / modèle proposé'], ao.items.map(i => [String(i.n), i.designation, String(i.quantite ?? ''), '']), [700, 5200, 1200, 2800]));
  r.push(p('', { after: 120 }));
  r.push(p("Dans l'attente, nous vous prions d'agréer, Madame, Monsieur, nos salutations distinguées."));
  r.push(...signature(c.villeSignature, fmtDate(opts.dateSignature), `${c.representant.nom}, ${c.representant.qualite}`));

  r.push(pageBreak());
  r.push(p("MODÈLE D'ATTESTATION À ÉTABLIR PAR LE CONSTRUCTEUR (sur son papier à en-tête)", { size: 17, bold: true, color: '9A3412', align: AlignmentType.CENTER, after: 200 }));
  r.push(title('ATTESTATION DU CONSTRUCTEUR', { size: 32, after: 240 }));
  r.push(p(`Nous soussignés, ………………………………………… (constructeur / distributeur officiel), attestons que la société **${companyFullName(c)}**, ${c.adresseSiege}, ICE ${c.ice}, est **revendeur / partenaire** de notre marque et dispose des capacités techniques et des compétences requises pour l'**installation et la configuration** du matériel de notre marque proposé dans le cadre de :`));
  r.push(p(`**Appel d'offres ouvert N° ${ao.numero || '………'}** — ${mo}`, { indent: 400 }));
  r.push(p(`Objet : **${ao.objet || '…'}**`, { indent: 400 }));
  r.push(p('Équipements concernés : ……………………………………………………………………………………………………………… (désignation et références)', { before: 80 }));
  r.push(p('La présente attestation est délivrée pour servir et valoir ce que de droit.'));
  r.push(...signature('………………………', '……………………', 'Nom, qualité, signature et cachet du constructeur'));
  return toBuffer(makeDoc(r, { footer: `Attestation constructeur — AO N° ${ao.numero}` }));
}

// ---------------------------------------------------------------- Tableau de conformité (xlsx)
export async function tableauConformiteXlsx(ao, c, opts = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Générateur de dossier AO';
  const ws = wb.addWorksheet('Tableau de conformité', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  });
  ws.columns = [{ width: 6 }, { width: 62 }, { width: 46 }, { width: 14 }, { width: 24 }, { width: 18 }];
  const thin = { style: 'thin', color: { argb: 'FF888888' } };
  const box = { top: thin, bottom: thin, left: thin, right: thin };
  const yellow = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
  const banner = (row, text, font) => {
    ws.mergeCells(`A${row}:F${row}`);
    const cl = ws.getCell(`A${row}`);
    cl.value = text; cl.font = font; cl.alignment = { horizontal: 'center', wrapText: true };
  };
  banner(1, `DOSSIER D'APPEL D'OFFRES OUVERT N° ${ao.numero || '…'}`, { bold: true, size: 13 });
  banner(2, (ao.objet || '').toUpperCase(), { bold: true, size: 11 });
  banner(3, 'ANNEXE : TABLEAU DE CONFORMITÉ', { bold: true, size: 14, color: { argb: 'FF1F4E79' } });
  banner(4, `Concurrent : ${companyFullName(c)}`, { italic: true, size: 10 });

  const H = 6;
  ['N°', 'Spécifications techniques demandées', 'Spécifications techniques proposées par le concurrent', 'Conformité', 'Écarts', 'Réf. documentation (page)'].forEach((h, i) => {
    const cl = ws.getCell(H, i + 1);
    cl.value = h; cl.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    cl.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cl.border = box;
  });
  ws.getRow(H).height = 34;
  ws.views = [{ state: 'frozen', ySplit: H }];

  let r = H + 1;
  let nSpecs = 0;
  for (const it of ao.items) {
    ws.mergeCells(r, 1, r, 6);
    const t = ws.getCell(r, 1);
    t.value = `${it.designation}${it.quantite ? ` — quantité : ${it.quantite}` : ''}`;
    t.font = { bold: true }; t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF5' } };
    for (let k = 1; k <= 6; k++) ws.getCell(r, k).border = box;
    r++;
    it.specs.forEach((s, i) => {
      ws.getCell(r, 1).value = `${it.n}.${i + 1}`;
      ws.getCell(r, 2).value = s;
      for (let k = 1; k <= 6; k++) {
        const cl = ws.getCell(r, k);
        cl.border = box;
        cl.alignment = { vertical: 'top', wrapText: true, horizontal: k === 1 || k === 4 ? 'center' : 'left' };
        if (k >= 3) cl.fill = yellow;
      }
      ws.getCell(r, 4).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Oui,Non"'] };
      nSpecs++;
      r++;
    });
  }
  const lastData = r - 1;
  r += 1;
  ws.mergeCells(r, 1, r, 6);
  ws.getCell(r, 1).value = `Fait à ${c.villeSignature || '……………'}, le ${fmtDate(opts.dateSignature)}`;
  ws.getCell(r, 1).alignment = { horizontal: 'right' };
  r++;
  ws.mergeCells(r, 1, r, 6);
  ws.getCell(r, 1).value = 'Signature et cachet du concurrent';
  ws.getCell(r, 1).font = { bold: true };
  ws.getCell(r, 1).alignment = { horizontal: 'right', vertical: 'top' };
  ws.getRow(r).height = 55;
  r += 2;
  ws.mergeCells(r, 1, r, 6);
  ws.getCell(r, 1).value = "Rappel RC : le tableau doit être basé sur la documentation technique jointe ; en cas de contradiction, la documentation technique prime. Une seule spécification non conforme rend l'offre non conforme. Indiquer marque, modèle et référence exacts dans la colonne « proposées » (cellules jaunes).";
  ws.getCell(r, 1).font = { italic: true, size: 9, color: { argb: 'FF666666' } };
  ws.getCell(r, 1).alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(r).height = 36;
  ws.pageSetup.printArea = `A1:F${r}`;

  // Contrôle (ne pas déposer)
  const cs = wb.addWorksheet('Contrôle (ne pas déposer)', { properties: { tabColor: { argb: 'FFC0392B' } } });
  cs.columns = [{ width: 46 }, { width: 26 }];
  cs.getCell('A1').value = 'CONTRÔLE INTERNE — NE PAS JOINDRE AU DOSSIER';
  cs.getCell('A1').font = { bold: true, color: { argb: 'FFC0392B' } };
  const rng = `'Tableau de conformité'!D${H + 1}:D${lastData}`;
  cs.getCell('A3').value = 'Spécifications à renseigner'; cs.getCell('B3').value = nSpecs;
  cs.getCell('A4').value = 'Conformes (Oui)'; cs.getCell('B4').value = { formula: `COUNTIF(${rng},"Oui")` };
  cs.getCell('A5').value = 'Non conformes (Non)'; cs.getCell('B5').value = { formula: `COUNTIF(${rng},"Non")` };
  cs.getCell('A6').value = 'Pas encore renseignées'; cs.getCell('B6').value = { formula: 'B3-B4-B5' };
  cs.getCell('A8').value = 'Verdict'; cs.getCell('A8').font = { bold: true };
  cs.getCell('B8').value = { formula: 'IF(B5>0,"OFFRE NON CONFORME",IF(B6>0,"À compléter","Prêt"))' };
  cs.getCell('B8').font = { bold: true };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
