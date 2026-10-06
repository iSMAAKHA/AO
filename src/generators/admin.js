// Dossier administratif + enveloppes : déclaration sur l'honneur, demande de caution, état des pièces, pages de garde.
import { p, title, center, fields, signature, note, table, makeDoc, toBuffer, pageBreak, COLORS, AlignmentType } from './helpers.js';
import { Table, TableRow, TableCell, WidthType, BorderStyle, TableLayoutType } from 'docx';
import { fmtDate, fmtDateLong, fmtHeure, fmtMoney, moneyToWords } from '../util.js';
import { companyFullName } from '../company.js';
import { buildPieces } from '../pieces.js';

const art = (ao, k, d) => (ao.articles && ao.articles[k]) || d;
const sigleMO = ao => ao.maitreOuvrage.sigle || ao.maitreOuvrage.nom || "l'Administration";
const isPhysique = c => /physique|auto/i.test(c.formeJuridique || '');
const heureTxt = h => (h ? ` à ${fmtHeure(h)}` : '');

// ---------------------------------------------------------------- Déclaration sur l'honneur
export async function declarationHonneur(ao, c, opts = {}) {
  const mo = sigleMO(ao);
  const r = [];
  r.push(title("Déclaration sur l'honneur", { size: 34, after: 120 }));
  r.push(p(`Appel d'offres ouvert N° **${ao.numero || '………'}**${ao.dateOuverture ? ` du **${fmtDate(ao.dateOuverture)}**${heureTxt(ao.heureOuverture)}` : ''}`));
  r.push(p(`Objet du marché : **${ao.objet || '…………'}**`));
  r.push(p(`Je soussigné : **${c.representant.nom}**${isPhysique(c) ? ', agissant en mon nom personnel et pour mon propre compte.' : `, ${c.representant.qualite}`}`, { before: 100 }));
  const f = [];
  if (!isPhysique(c)) f.push(['Agissant au nom et pour le compte de', companyFullName(c)], ['Au capital social de', c.capital ? `${fmtMoney(c.capital)} Dirhams` : '']);
  f.push(
    ['Numéro de téléphone', c.telephone], ['Numéro du fax', c.fax], ['Adresse électronique', c.email],
    [isPhysique(c) ? 'Adresse du domicile' : 'Adresse du siège social de la société', c.adresseSiege],
    ['Adresse du domicile élu', c.adresseDomicile],
    ['Affiliée à la CNSS, sous le numéro', c.cnss],
    ['Inscrite au registre du commerce de', `${c.rcVille}, sous le numéro : ${c.rcNumero}`],
    ['Inscrite à la taxe professionnelle sous le numéro', c.taxeProfessionnelle],
    ["Numéro de l'identifiant commun de l'entreprise", c.ice],
    ["Relevé d'identité bancaire (RIB)", `${c.banque.nom}${c.banque.agence ? ', ' + c.banque.agence : ''} — N° ${c.banque.rib}`],
  );
  r.push(fields(f));
  r.push(p('En vertu des pouvoirs qui me sont conférés ;', { before: 80 }));
  r.push(p("Déclare sur l'honneur :", { bold: true, before: 60 }));

  const a27 = art(ao, 'conditions', '27'), a152 = art(ao, 'sanctions', '152');
  const items = [
    `que je remplis les conditions prévues à l'article ${a27} du règlement de passation des marchés de ${mo} ;`,
    "m'engage à couvrir, dans les conditions fixées dans le cahier des charges, par une police d'assurance, les risques découlant de mon activité professionnelle ;",
    `m'engage, si j'envisage de recourir à la sous-traitance :\n– à veiller à ce que celle-ci ne dépasse pas cinquante pour cent (50 %) du montant du marché et qu'elle ne porte pas sur le lot ou le corps d'état principal du marché ;\n– à m'assurer que les sous-traitants auxquels je recours remplissent les conditions prévues à l'article ${a27} du règlement de passation des marchés de ${mo} ;`,
    "atteste que je dispose des autorisations requises pour l'exécution des prestations telles que prévues par la législation et la réglementation en vigueur ;",
    'atteste que je ne suis pas en liquidation judiciaire ou en redressement judiciaire ;',
    "m'engage à ne pas recourir par moi-même ou par personne interposée à des pratiques de fraude ou de corruption des personnes qui interviennent, à quelque titre que ce soit, dans les procédures de passation, de gestion et d'exécution du marché ;",
    "m'engage à ne pas faire, par moi-même ou par personne interposée, de promesses, de dons ou de présents, en vue d'influer sur la procédure de conclusion du marché et de son exécution ;",
    "atteste que je ne suis pas en situation de conflit d'intérêts ;",
    "atteste que je n'ai pas participé à la préparation du dossier de l'appel d'offres considéré ;",
  ];
  if (ao.reservePME) items.push("atteste que je remplis les conditions prévues par l'article 1er du dahir n° 1-02-188 du 12 joumada I 1423 (23 juillet 2002) portant promulgation de la loi n° 53-00 formant charte de la petite et moyenne entreprise ;");
  items.forEach((t, i) => t.split('\n').forEach((line, k) => r.push(p(k === 0 ? `${i + 1} - ${line}` : line, { indent: k === 0 ? 300 : 600, hanging: k === 0 ? 300 : 0, after: 70 }))));

  r.push(p(`Je certifie l'exactitude des renseignements contenus dans la présente déclaration sur l'honneur et dans les pièces fournies dans mon dossier de candidature, sous peine de l'application des mesures coercitives prévues à l'article ${a152} du règlement de passation des marchés de ${mo}.`, { before: 100 }));
  r.push(...signature(c.villeSignature, fmtDate(opts.dateSignature)));
  r.push(note(`Conseil : une seule déclaration, en un exemplaire (une par membre en cas de groupement). Le dernier point (loi 53-00, PME) n'est repris que si le marché est réservé à la PME. Vérifiez les numéros d'articles (${a27} et ${a152}) avec le modèle annexé au règlement de consultation.`));
  return toBuffer(makeDoc(r, { footer: `Déclaration sur l'honneur — AO N° ${ao.numero}` }));
}

// ---------------------------------------------------------------- Demande de caution provisoire
export async function demandeCaution(ao, c, opts = {}) {
  const r = [];
  const montant = ao.cautionProvisoire;
  const banque = c.banque.nom || 'LA BANQUE';
  r.push(p(`Société : **${companyFullName(c).toUpperCase()}**`, { after: 20 }));
  r.push(p(`RIB : ${c.banque.rib}`, { after: 20 }));
  r.push(p(`Adresse : ${c.adresseSiege}`, { after: 160 }));
  r.push(p(`À  **${banque}**${c.banque.agence ? ' — ' + c.banque.agence : ''}`, { align: AlignmentType.RIGHT, after: 200 }));
  r.push(p(`Objet : demande d'émission d'une caution provisoire — Appel d'offres ouvert N° ${ao.numero || '………'}`, { bold: true, after: 200 }));
  r.push(p(`Par la présente, nous vous demandons de bien vouloir émettre pour notre compte et sous notre entière responsabilité une caution bancaire provisoire de **${montant != null ? fmtMoney(montant) : '………'} DH** (${montant != null ? moneyToWords(montant) : '………………'}),`));
  r.push(p(`pour garantir **${(ao.maitreOuvrage.nom || '………').toUpperCase()}** le paiement de tout montant que nous pourrions lui devoir au titre de l'appel d'offres ouvert **N° ${ao.numero || '………'}**${ao.dateOuverture ? ` (séance d'ouverture des plis du ${fmtDate(ao.dateOuverture)})` : ''}, relatif à : **${ao.objet || '…………'}**,`));
  r.push(p(`dont notre société pourrait être débitrice vis-à-vis de ${banque}.`));
  r.push(p("Nous vous prions d'établir cette garantie bancaire dans les termes ci-après :", { before: 60 }));
  r.push(p("Cet engagement constituant pour vous un cautionnement solidaire en notre faveur, nous vous donnons par la présente notre contre-garantie solidaire dans les mêmes termes.", { before: 60 }));
  r.push(p("En conséquence, nous nous reconnaissons débiteurs vis-à-vis de votre établissement de tout montant que vous serez appelés à payer pour quelque cause que ce soit, au titre de votre engagement de caution susvisé, nous engageant à ne contester en aucun cas le bien-fondé des paiements que vous auriez ainsi été amenés à effectuer, le montant de ces paiements constituant pour nous des dettes liquides et exigibles vis-à-vis de votre établissement ; à cet effet, nous vous autorisons d'ores et déjà à débiter notre compte de toute somme que vous serez amenés à payer en vertu de votre engagement ci-dessus, la présente valant ordre de paiement irrévocable."));
  r.push(p("Par ailleurs, nous vous autorisons, dès que vous le jugerez opportun, à débiter notre compte pour constituer une provision destinée à couvrir totalement le montant de votre engagement en vertu de cette caution."));
  r.push(p("Il est entendu que si la situation de notre compte ne permettait pas d'effectuer les paiements que vous serez amenés à faire en votre qualité de caution, nous nous engageons à vous en verser le montant immédiatement et sur votre première demande."));
  r.push(p("La présente contre-garantie restera valable et gardera tous ses effets tant que vous n'aurez pas obtenu mainlevée définitive de votre engagement de caution, ou restitution de l'original de votre engagement ; de même, dans le cas où vous auriez décidé de constituer une provision en couverture de votre engagement susvisé, nous renonçons à la restitution de cette provision tant que vous n'aurez pas obtenu mainlevée définitive de votre cautionnement."));
  r.push(p('Veuillez agréer, Messieurs, nos salutations distinguées.', { before: 60 }));
  r.push(...signature(c.villeSignature, fmtDate(opts.dateSignature), `${c.representant.nom}, ${c.representant.qualite}`));
  r.push(note([
    '**Mentions à vérifier sur la caution délivrée par la banque** (sous peine d\'élimination) :',
    `• Bénéficiaire : ${ao.maitreOuvrage.nom || '…'} — Marché : AO N° ${ao.numero || '…'} — Objet exact : « ${ao.objet || '…'} ».`,
    `• Montant : ${montant != null ? fmtMoney(montant) + ' DH' : '…'}.`,
    "• Aucune réserve ni restriction concernant le délai de validité, l'engagement ou la responsabilité de la banque (caution personnelle et solidaire).",
    ...(ao.soumissionElectronique ? ['• Soumission électronique : la caution est à constituer de manière dématérialisée via le portail des marchés publics.'] : []),
    "• Prévoir l'original dans l'enveloppe n° 1 (dossier administratif).",
  ]));
  return toBuffer(makeDoc(r, { footer: `Demande de caution provisoire — AO N° ${ao.numero}` }));
}

// ---------------------------------------------------------------- État des pièces
export async function etatDesPieces(ao, c, opts = {}) {
  const r = [];
  const pieces = buildPieces(ao).filter(x => x.dossier !== 'attributaire');
  const groups = [
    ['administratif', 'ÉTAT DES PIÈCES DU DOSSIER ADMINISTRATIF'],
    ['technique', 'ÉTAT DES PIÈCES DU DOSSIER TECHNIQUE'],
    ['financier', "ÉTAT DES PIÈCES DE L'OFFRE FINANCIÈRE"],
  ];
  let first = true;
  for (const [key, label] of groups) {
    const list = pieces.filter(x => x.dossier === key && !x.optionnel);
    if (!list.length) continue;
    if (!first) r.push(pageBreak());
    first = false;
    r.push(title(label, { size: 26, after: 160 }));
    r.push(fields([
      ["Appel d'offres ouvert N°", `${ao.numero || ''}${ao.dateOuverture ? ' du ' + fmtDate(ao.dateOuverture) : ''}`],
      ['Objet', ao.objet],
      ['Concurrent', companyFullName(c)],
    ], 2400, 7500));
    r.push(p('', { after: 100 }));
    r.push(table(['N°', 'Désignation de la pièce', 'Forme', 'Nb de pages'], list.map((x, i) => [String(i + 1), x.titre, x.forme, '']), [700, 5600, 2500, 1100]));
    r.push(...signature(c.villeSignature, fmtDate(opts.dateSignature)));
  }
  return toBuffer(makeDoc(r, { footer: `États des pièces — AO N° ${ao.numero}` }));
}

// ---------------------------------------------------------------- Pages de garde / enveloppes
const frameBorders = ['top', 'bottom', 'left', 'right'].reduce((a, k) => ({ ...a, [k]: { style: BorderStyle.DOUBLE, size: 12, color: COLORS.accent } }), {});
const frame = children => new Table({
  width: { size: 9900, type: WidthType.DXA }, columnWidths: [9900], layout: TableLayoutType.FIXED,
  rows: [new TableRow({ children: [new TableCell({ width: { size: 9900, type: WidthType.DXA }, margins: { top: 300, bottom: 300, left: 300, right: 300 }, borders: frameBorders, children })] })],
});

function envelope(ao, c, { header, sub, destinataire, adresseDest, avertissement, deadline }) {
  const mo = ao.maitreOuvrage;
  const out = [];
  out.push(center(header, { size: 34, bold: true, color: COLORS.accent, after: 160 }));
  if (sub) out.push(center(sub, { size: 22, italics: true, after: 200 }));
  out.push(p('EXPÉDITEUR (concurrent) :', { bold: true, size: 20, after: 40 }));
  out.push(p(companyFullName(c).toUpperCase(), { bold: true, size: 26, after: 20 }));
  out.push(p(c.adresseSiege, { size: 22, after: 20 }));
  out.push(p(`Tél : ${c.telephone}   —   ${c.email}`, { size: 20, after: 240 }));
  out.push(p('DESTINATAIRE :', { bold: true, size: 20, after: 40 }));
  out.push(p((destinataire || mo.nom || '').toUpperCase(), { bold: true, size: 26, after: 20 }));
  out.push(p(adresseDest || [mo.adresse, mo.ville].filter(Boolean).join(', '), { size: 22, after: 240 }));
  out.push(p(`APPEL D'OFFRES OUVERT N° ${ao.numero || '………'}`, { bold: true, size: 30, align: AlignmentType.CENTER, after: 80 }));
  out.push(p((ao.objet || '').toUpperCase(), { bold: true, size: 26, align: AlignmentType.CENTER, after: 120 }));
  out.push(p(deadline ?? `Séance d'ouverture des plis : ${ao.dateOuverture ? fmtDateLong(ao.dateOuverture) : '……………'}${heureTxt(ao.heureOuverture)}`, { size: 24, align: AlignmentType.CENTER, bold: true, after: 240 }));
  out.push(p(avertissement, { size: 21, italics: true, align: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 6, color: COLORS.muted, space: 6 } } }));
  return frame(out);
}

export async function pagesDeGarde(ao, c) {
  const warn = "« Le pli ne doit être ouvert que par le président de la commission d'appel d'offres lors de la séance publique d'ouverture des plis »";
  const label = t => p(t, { size: 18, color: COLORS.muted, after: 100 });
  const r = [];
  r.push(label('1 / PLI EXTÉRIEUR — à coller sur le grand pli qui contient les deux enveloppes'));
  r.push(envelope(ao, c, { header: 'PLI DE CANDIDATURE', sub: 'Contient : enveloppe n° 1 (dossiers administratif, technique, CPS et RC) + enveloppe n° 2 (offre financière)', avertissement: warn }));
  r.push(pageBreak());
  r.push(label('2 / ENVELOPPE N° 1'));
  r.push(envelope(ao, c, { header: 'DOSSIERS ADMINISTRATIF, TECHNIQUE, CPS ET RÈGLEMENT DE CONSULTATION', sub: 'Enveloppe n° 1', avertissement: warn }));
  r.push(pageBreak());
  r.push(label('3 / ENVELOPPE N° 2'));
  r.push(envelope(ao, c, { header: 'OFFRE FINANCIÈRE', sub: 'Enveloppe n° 2', avertissement: warn }));
  if (ao.docTechSeparee || ao.exigences.documentationTechnique) {
    const parts = (ao.lieuDocTech || '').split(',').map(s => s.trim());
    r.push(pageBreak());
    r.push(label('4 / PLI DE LA DOCUMENTATION TECHNIQUE — à déposer séparément, avant la date limite'));
    r.push(envelope(ao, c, {
      header: 'PROSPECTUS, NOTICES ET DOCUMENTS TECHNIQUE', sub: '« Documentation technique »',
      destinataire: parts[0] || undefined,
      adresseDest: parts.length > 1 ? parts.slice(1).join(', ') : undefined,
      deadline: ao.dateLimiteDocTech ? `À déposer au plus tard le ${fmtDateLong(ao.dateLimiteDocTech)} à ${fmtHeure(ao.heureLimiteDocTech)}` : "À déposer avant la date limite fixée par l'avis",
      avertissement: "« Le pli de la documentation technique ne doit être ouvert que par le président de la commission d'ouverture des plis lors de la séance d'ouverture des plis »",
    }));
  }
  return toBuffer(makeDoc(r, { footer: `Enveloppes — AO N° ${ao.numero}` }));
}
