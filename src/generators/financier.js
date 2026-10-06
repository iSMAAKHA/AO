// Offre financière : acte d'engagement (docx) et bordereau des prix – détail estimatif (xlsx, avec formules).
import ExcelJS from 'exceljs';
import { p, h2, title, fields, signature, note, makeDoc, toBuffer } from './helpers.js';
import { fmtDate, fmtMoney, moneyToWords } from '../util.js';
import { companyFullName } from '../company.js';
import { tenderLimits } from '../pieces.js';

export function totals(ao) {
  const lignes = ao.items.map(i => {
    const q = Number(i.quantite);
    const pu = i.prixUnitaire === '' || i.prixUnitaire == null ? null : Number(i.prixUnitaire);
    return { ...i, total: pu != null && Number.isFinite(q) && Number.isFinite(pu) ? Math.round(q * pu * 100) / 100 : null };
  });
  const complet = lignes.length > 0 && lignes.every(l => l.total != null);
  const ht = complet ? Math.round(lignes.reduce((a, l) => a + l.total, 0) * 100) / 100 : null;
  const taux = Number(ao.tauxTVA ?? 20);
  const tva = ht != null ? Math.round(ht * taux) / 100 : null;
  const ttc = ht != null ? Math.round((ht + tva) * 100) / 100 : null;
  return { lignes, complet, ht, taux, tva, ttc };
}

const isPhysique = c => /physique|auto/i.test(c.formeJuridique || '');
const heure = h => (h ? ` à ${h.replace(':', 'H')}` : '');

export async function acteEngagement(ao, c, opts = {}) {
  const t = totals(ao);
  const mo = ao.maitreOuvrage.sigle || ao.maitreOuvrage.nom || "l'Administration";
  const rows = [];

  rows.push(title("ACTE D'ENGAGEMENT", { size: 34, after: 120 }));
  rows.push(h2("A – Partie réservée à l'Administration"));
  rows.push(p(`Appel d'offres ouvert N° **${ao.numero || '………'}** ${ao.dateOuverture ? `du **${fmtDate(ao.dateOuverture)}**${heure(ao.heureOuverture)}` : 'du ……………'}`));
  rows.push(p(`Objet du marché : **${ao.objet || '…………'}**`));
  rows.push(p(`Passé en application des dispositions du règlement des marchés de ${mo}.`));

  rows.push(h2(isPhysique(c) ? 'B – Partie réservée au concurrent agissant à titre individuel' : 'B – Partie réservée au concurrent (personne morale)'));
  if (isPhysique(c)) {
    rows.push(p(`Je soussigné : **${c.representant.nom}**, agissant en mon nom personnel et pour mon propre compte,`));
    rows.push(fields([
      ['Adresse du domicile élu', c.adresseDomicile],
      ['Affilié à la CNSS sous le numéro', c.cnss],
      ['Inscrit au registre du commerce de', `${c.rcVille} sous le numéro : ${c.rcNumero}`],
      ['Inscrit à la taxe professionnelle sous le numéro', c.taxeProfessionnelle],
      ["Numéro de l'identifiant commun de l'entreprise", c.ice],
    ]));
  } else {
    rows.push(p(`Je soussigné : **${c.representant.nom}**, ${c.representant.qualite}`));
    rows.push(p(`Agissant au nom et pour le compte de : **${companyFullName(c)}**`));
    rows.push(fields([
      ['Au capital social de', c.capital ? `${fmtMoney(c.capital)} Dirhams` : ''],
      ['Adresse du siège social', c.adresseSiege],
      ['Adresse du domicile élu', c.adresseDomicile],
      ['Affiliée à la CNSS sous le numéro', c.cnss],
      ['Inscrite au registre du commerce de', `${c.rcVille} sous le numéro : ${c.rcNumero}`],
      ['Inscrite à la taxe professionnelle sous le numéro', c.taxeProfessionnelle],
      ["Numéro de l'identifiant commun de l'entreprise", c.ice],
    ]));
  }
  rows.push(p('En vertu des pouvoirs qui me sont conférés ;', { before: 80 }));

  rows.push(h2('D – Partie commune à tous les concurrents'));
  rows.push(p("Après avoir pris connaissance du dossier d'appel d'offres, concernant les prestations précisées en objet de la partie A ci-dessus."));
  rows.push(p('Après avoir apprécié à mon point de vue et sous ma responsabilité la nature et les difficultés que comportent ces prestations :'));
  rows.push(p("1) remets, revêtu de ma signature, un bordereau de prix, conformément aux modèles figurant au dossier ;", { indent: 300 }));
  rows.push(p("2) m'engage à exécuter lesdites prestations conformément au cahier des prescriptions spéciales et moyennant les prix que j'ai établis moi-même, lesquels font ressortir :", { indent: 300 }));

  const montant = n => (n == null ? '……………………………………… (en lettres et en chiffres)' : `${moneyToWords(n)} (${fmtMoney(n)} DH)`);
  rows.push(p(/unique/i.test(ao.lots || 'unique') ? 'Lorsque le marché est en lot unique :' : 'Lot(s) : …………………………………………', { before: 60, bold: true }));
  rows.push(fields([
    ['– Montant hors TVA', montant(t.ht)],
    ['– Taux de la TVA', `${t.taux} %`],
    ['– Montant de la TVA', montant(t.tva)],
    ['– Montant TVA comprise', montant(t.ttc)],
  ], 3000, 6900));

  rows.push(p(`${mo} se libérera des sommes dues par lui en faisant donner crédit au compte bancaire ouvert au nom de ${companyFullName(c)} à ${c.banque.nom}${c.banque.agence ? ' – ' + c.banque.agence : ''}, sous le relevé d'identification bancaire (RIB) numéro : **${c.banque.rib}**.`, { before: 120 }));
  rows.push(...signature(c.villeSignature, fmtDate(opts.dateSignature)));
  rows.push(note([
    "Notes : le RIB comporte 24 positions. Montant en lettres et en chiffres, rabais éventuel déduit : en cas de discordance, le montant en lettres prévaut. En cas de discordance avec le bordereau des prix, le montant du bordereau est tenu pour bon.",
    ...(t.complet ? [] : ["Les montants sont à compléter après saisie des prix unitaires (dans l'application, ou dans Bordereau_des_prix.xlsx)."]),
  ]));
  return toBuffer(makeDoc(rows, { footer: `Acte d'engagement — AO N° ${ao.numero}` }));
}

export async function bordereauXlsx(ao, c, opts = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Générateur de dossier AO';
  const ws = wb.addWorksheet('Bordereau des prix', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
  });
  ws.columns = [{ width: 9 }, { width: 52 }, { width: 9 }, { width: 11 }, { width: 18 }, { width: 20 }];
  const thin = { style: 'thin', color: { argb: 'FF888888' } };
  const box = { top: thin, bottom: thin, left: thin, right: thin };
  const money = '#,##0.00';
  const banner = (row, text, font, wrap = false) => {
    ws.mergeCells(`A${row}:F${row}`);
    const cl = ws.getCell(`A${row}`);
    cl.value = text; cl.font = font; cl.alignment = { horizontal: 'center', wrapText: wrap };
  };
  banner(1, 'BORDEREAU DES PRIX – DÉTAIL ESTIMATIF', { bold: true, size: 15, color: { argb: 'FF1F4E79' } });
  banner(2, `APPEL D'OFFRES OUVERT N° ${ao.numero || '…'}`, { bold: true, size: 12 });
  banner(3, (ao.objet || '').toUpperCase(), { bold: true, size: 11 }, true);
  banner(4, `Concurrent : ${c.raisonSociale} ${c.formeJuridique || ''} — ICE ${c.ice || ''}`, { italic: true, size: 10 });

  const H = 6;
  ['N° Prix', 'Désignations', 'Unité', 'Quantité', 'Prix unitaire en DH HT', 'Prix total en DH HT'].forEach((h, i) => {
    const cl = ws.getCell(H, i + 1);
    cl.value = h; cl.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    cl.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cl.border = box;
  });
  ws.getRow(H).height = 32;

  const first = H + 1;
  ao.items.forEach((it, idx) => {
    const r = first + idx;
    ws.getCell(r, 1).value = it.n;
    ws.getCell(r, 2).value = it.designation;
    ws.getCell(r, 3).value = it.unite || 'U';
    ws.getCell(r, 4).value = it.quantite == null || it.quantite === '' ? null : Number(it.quantite);
    ws.getCell(r, 5).value = it.prixUnitaire === '' || it.prixUnitaire == null ? null : Number(it.prixUnitaire);
    ws.getCell(r, 6).value = { formula: `IF(OR(D${r}="",E${r}=""),"",ROUND(D${r}*E${r},2))` };
    for (let k = 1; k <= 6; k++) {
      const cl = ws.getCell(r, k);
      cl.border = box;
      cl.alignment = { vertical: 'middle', horizontal: k === 2 ? 'left' : 'center', wrapText: k === 2 };
      if (k >= 5) { cl.numFmt = money; cl.alignment = { vertical: 'middle', horizontal: 'right' }; }
    }
    ws.getCell(r, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } }; // cellule à saisir
    ws.getRow(r).height = 26;
  });
  const last = first + ao.items.length - 1;
  const tr = last + 1;
  const tot = (r, label, formula, bold = true) => {
    ws.mergeCells(r, 1, r, 5);
    const l = ws.getCell(r, 1);
    l.value = label; l.font = { bold }; l.alignment = { horizontal: 'right' };
    for (let k = 1; k <= 5; k++) ws.getCell(r, k).border = box;
    const v = ws.getCell(r, 6);
    v.value = { formula }; v.numFmt = money; v.font = { bold }; v.border = box; v.alignment = { horizontal: 'right' };
  };
  tot(tr, 'Montant total en DH HT', `IF(COUNT(F${first}:F${last})=${ao.items.length},SUM(F${first}:F${last}),"")`);
  tot(tr + 1, `Montant de la TVA en DH (taux TVA = ${ao.tauxTVA ?? 20} %)`, `IF(F${tr}="","",ROUND(F${tr}*${(ao.tauxTVA ?? 20) / 100},2))`, false);
  tot(tr + 2, 'Montant total en DH TTC', `IF(F${tr}="","",F${tr}+F${tr + 1})`);

  ws.mergeCells(tr + 4, 1, tr + 4, 6);
  ws.getCell(tr + 4, 1).value = `Fait à ${c.villeSignature || '……………'}, le ${fmtDate(opts.dateSignature)}`;
  ws.getCell(tr + 4, 1).alignment = { horizontal: 'right' };
  ws.mergeCells(tr + 5, 1, tr + 5, 6);
  ws.getCell(tr + 5, 1).value = 'Signature et cachet du concurrent';
  ws.getCell(tr + 5, 1).font = { bold: true };
  ws.getCell(tr + 5, 1).alignment = { horizontal: 'right', vertical: 'top' };
  ws.getRow(tr + 5).height = 60;
  ws.mergeCells(tr + 7, 1, tr + 7, 6);
  ws.getCell(tr + 7, 1).value = "Cellules jaunes = prix unitaires à saisir (DH HT). Les totaux se calculent seuls. Libellés, unités et quantités : à laisser identiques au dossier d'appel d'offres (toute différence entraîne l'élimination).";
  ws.getCell(tr + 7, 1).font = { italic: true, size: 9, color: { argb: 'FF666666' } };
  ws.getCell(tr + 7, 1).alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(tr + 7).height = 30;
  ws.pageSetup.printArea = `A1:F${tr + 7}`;

  // ---- Feuille de contrôle (NE PAS DÉPOSER) ----
  const cs = wb.addWorksheet('Contrôle (ne pas déposer)', { properties: { tabColor: { argb: 'FFC0392B' } } });
  cs.columns = [{ width: 52 }, { width: 26 }, { width: 40 }];
  cs.getCell('A1').value = 'CONTRÔLE INTERNE — NE PAS JOINDRE AU DOSSIER';
  cs.getCell('A1').font = { bold: true, size: 13, color: { argb: 'FFC0392B' } };
  const lim = tenderLimits(ao);
  const hi = lim?.hi ?? 20, lo = lim?.lo ?? 25;
  const set = (r, label, v, fmt) => {
    cs.getCell(`A${r}`).value = label; cs.getCell(`B${r}`).value = v;
    if (fmt) cs.getCell(`B${r}`).numFmt = fmt;
    cs.getCell(`A${r}`).border = box; cs.getCell(`B${r}`).border = box;
  };
  set(3, `Estimation du maître d'ouvrage (${lim?.type || 'TTC'}) — à saisir si vide`, lim ? lim.estimation : null, money);
  set(4, `Seuil « offre excessive » (+${hi} %)`, { formula: `IF(B3="","",B3*${1 + hi / 100})` }, money);
  set(5, `Seuil « offre anormalement basse » (−${lo} %)`, { formula: `IF(B3="","",B3*${1 - lo / 100})` }, money);
  set(7, `Votre offre (${lim?.type || 'TTC'})`, { formula: lim?.type === 'HT' ? `'Bordereau des prix'!F${tr}` : `'Bordereau des prix'!F${tr + 2}` }, money);
  set(8, "Écart par rapport à l'estimation", { formula: 'IF(OR(B3="",B7=""),"",B7/B3-1)' }, '0.0%');
  set(9, 'Verdict', { formula: 'IF(OR(B3="",B7=""),"Saisir les prix",IF(B7>B4,"EXCESSIVE → écartée",IF(B7<B5,"ANORMALEMENT BASSE → écartée","Dans la fourchette")))' });
  cs.getCell('B3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
  cs.getCell('A9').font = { bold: true }; cs.getCell('B9').font = { bold: true };
  cs.mergeCells('A11:C14');
  cs.getCell('A11').value = "Règle du RC : le prix de référence est la moyenne de l'estimation et de la moyenne des offres retenues (hors excessives / anormalement basses) ; l'offre la mieux-disante est la plus proche du prix de référence par défaut. Le prix de référence dépend des concurrents : il ne peut pas être calculé à l'avance.";
  cs.getCell('A11').alignment = { wrapText: true, vertical: 'top' };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
