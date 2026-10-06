// Orchestration : produit tous les fichiers du dossier de réponse, et l'archive ZIP.
import JSZip from 'jszip';
import { elementsDossier } from './elements.js';
import { declarationHonneur, demandeCaution, etatDesPieces, pagesDeGarde } from './admin.js';
import { noteMoyens, modeleAttestationReference, demandeAttestationConstructeur, tableauConformiteXlsx } from './technique.js';
import { acteEngagement, bordereauXlsx } from './financier.js';
import { slug } from '../util.js';

/** Normalise l'objet AO reçu du navigateur (types, valeurs manquantes). */
export function normalizeAO(raw) {
  const ao = structuredClone(raw || {});
  ao.maitreOuvrage = { nom: '', sigle: '', representant: '', adresse: '', ville: '', ...(ao.maitreOuvrage || {}) };
  ao.exigences = { tableauConformite: false, attestationConstructeur: false, documentationTechnique: false, echantillons: false, visiteLieux: false, groupementPossible: true, ...(ao.exigences || {}) };
  ao.items = (ao.items || []).map((i, k) => ({
    n: Number(i.n) || k + 1,
    designation: String(i.designation || '').trim(),
    unite: i.unite || 'U',
    quantite: i.quantite === '' || i.quantite == null ? null : Number(i.quantite),
    prixUnitaire: i.prixUnitaire === '' || i.prixUnitaire == null ? null : Number(i.prixUnitaire),
    specs: (Array.isArray(i.specs) ? i.specs : String(i.specs || '').split('\n')).map(s => String(s).trim()).filter(Boolean),
  }));
  for (const k of ['cautionProvisoire', 'cautionDefinitifPct', 'retenueGarantiePct', 'estimation', 'validiteOffresJours', 'seuilExcessifPct', 'seuilBasPct', 'tauxTVA']) {
    ao[k] = ao[k] === '' || ao[k] == null ? null : Number(ao[k]);
  }
  ao.articles ||= {};
  ao.piecesExtra ||= [];
  ao.piecesDesactivees ||= [];
  ao.alertes ||= [];
  return ao;
}

export async function buildAll(rawAO, company, opts = {}) {
  const ao = normalizeAO(rawAO);
  const o = { dateSignature: opts.dateSignature || '', today: opts.today };
  const files = [];
  const add = async (path, promise) => files.push({ path, buffer: await promise });

  await add('00_Elements_du_dossier_AO.docx', elementsDossier(ao, company, o));
  await add('01_Dossier_administratif/Declaration_sur_l_honneur.docx', declarationHonneur(ao, company, o));
  await add('01_Dossier_administratif/Demande_caution_provisoire.docx', demandeCaution(ao, company, o));
  await add('02_Dossier_technique/Note_moyens_humains_et_techniques.docx', noteMoyens(ao, company, o));
  await add('02_Dossier_technique/Modele_attestation_de_reference.docx', modeleAttestationReference(ao, company, o));
  if (ao.exigences.attestationConstructeur) await add('02_Dossier_technique/Demande_attestation_constructeur.docx', demandeAttestationConstructeur(ao, company, o));
  if (ao.exigences.tableauConformite) await add('02_Dossier_technique/Tableau_de_conformite.xlsx', tableauConformiteXlsx(ao, company, o));
  await add('03_Offre_financiere/Acte_d_engagement.docx', acteEngagement(ao, company, o));
  await add('03_Offre_financiere/Bordereau_des_prix.xlsx', bordereauXlsx(ao, company, o));
  await add('04_Enveloppes_et_pages_de_garde/Pages_de_garde_et_enveloppes.docx', pagesDeGarde(ao, company, o));
  await add('04_Enveloppes_et_pages_de_garde/Etats_des_pieces.docx', etatDesPieces(ao, company, o));
  return files;
}

export async function buildZip(files, ao) {
  const zip = new JSZip();
  const root = `Dossier_AO_${slug(ao.numero || 'sans_numero')}`;
  for (const f of files) zip.file(`${root}/${f.path}`, f.buffer);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
