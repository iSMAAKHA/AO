// Profil de l'entreprise soumissionnaire : stocké localement dans data/company.json.
// Profil vide par défaut ; en local, les valeurs enregistrées sont relues depuis ce fichier.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'company.json');

export const DEFAULT_COMPANY = {
  raisonSociale: '', formeJuridique: 'SARL', capital: 0,
  representant: { nom: '', qualite: 'Gérant' },
  adresseSiege: '', adresseDomicile: '', telephone: '', fax: '', email: '',
  cnss: '', rcNumero: '', rcVille: '', taxeProfessionnelle: '', ice: '',
  banque: { nom: '', agence: '', rib: '' },
  villeSignature: '', activite: '',
  // Capacités (comparées aux conditions de participation de chaque AO)
  chiffreAffaires: 0, effectif: 0, anneeCreation: 0, certifications: '', agrements: '',
  moyensHumains: [
    { nom: '', fonction: 'Gérant', formation: '', experience: '' },
    { nom: '', fonction: 'Responsable commercial / avant-vente', formation: '', experience: '' },
    { nom: '', fonction: 'Techniciens support / installation', formation: '', experience: '' },
  ],
  moyensTechniques: [
    'Atelier de configuration et de test du matériel',
    "Véhicules pour la livraison et l'installation sur site",
    'Stock de pièces et matériel de remplacement',
  ],
  references: [{ client: '', objet: '', annee: '', montant: '', contact: '' }],
};

// Mode public (PUBLIC=1) : aucune donnée d'entreprise n'est lue ni écrite sur le serveur ;
// chaque utilisateur garde son profil dans son propre navigateur (localStorage).
export const PUBLIC_MODE = process.env.PUBLIC === '1';

export async function loadCompany() {
  if (PUBLIC_MODE) return structuredClone(DEFAULT_COMPANY);
  try {
    const saved = JSON.parse(await readFile(FILE, 'utf8'));
    return {
      ...DEFAULT_COMPANY, ...saved,
      representant: { ...DEFAULT_COMPANY.representant, ...saved.representant },
      banque: { ...DEFAULT_COMPANY.banque, ...saved.banque },
    };
  } catch {
    return structuredClone(DEFAULT_COMPANY);
  }
}

export async function saveCompany(c) {
  if (PUBLIC_MODE) return;
  await mkdir(dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(c, null, 2), 'utf8');
}

/** « Data Swing Services SARL » */
export const companyFullName = c => [c.raisonSociale, c.formeJuridique].filter(Boolean).join(' ');
