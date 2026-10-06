// Extraction complémentaire par IA (optionnelle, API Anthropic). Active si ANTHROPIC_API_KEY est défini.
// Les valeurs trouvées par l'IA complètent / corrigent celles de l'extraction par règles. NON testée sans clé API.
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

export const llmAvailable = () => !!process.env.ANTHROPIC_API_KEY;

const PROMPT = `Tu analyses le Règlement de Consultation (RC) et le CPS d'un appel d'offres marocain.
Réponds UNIQUEMENT par un objet JSON (sans texte autour) avec ces clés (null si absent) :
{
 "numero": "15/2026", "objet": "...", "maitreOuvrage": {"nom":"","sigle":"","representant":"","adresse":"","ville":""},
 "reservePME": bool, "dateOuverture": "AAAA-MM-JJ", "heureOuverture": "HH:MM",
 "dateLimiteDocTech": "AAAA-MM-JJ", "heureLimiteDocTech": "HH:MM", "lieuDocTech": "",
 "cautionProvisoire": nombre, "cautionDefinitifPct": nombre, "retenueGarantiePct": nombre, "estimation": nombre, "estimationType": "TTC|HT",
 "validiteOffresJours": nombre, "delaiExecution": "", "delaiGarantie": "", "penalites": "",
 "exigences": {"tableauConformite":bool,"attestationConstructeur":bool,"documentationTechnique":bool,"echantillons":bool,"visiteLieux":bool},
 "items": [{"n":1,"designation":"","unite":"U","quantite":nombre,"specs":["une caractéristique technique par ligne"]}],
 "piecesExtra": [{"dossier":"administratif|technique|financier","titre":"","detail":""}]
}
"piecesExtra" = pièces exigées par le RC qui sortent de la liste standard (pouvoirs, déclaration sur l'honneur, caution, note moyens, références, CPS/RC paraphés, tableau de conformité, attestation constructeur, acte d'engagement, bordereau). N'invente rien.`;

export async function llmExtract(text, base) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, system: PROMPT, messages: [{ role: 'user', content: text.slice(0, 350000) }] }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const raw = data.content?.map(b => b.text || '').join('') || '';
  const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  const ao = structuredClone(base);
  for (const [k, v] of Object.entries(json)) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (k === 'maitreOuvrage' || k === 'exigences') ao[k] = { ...ao[k], ...Object.fromEntries(Object.entries(v).filter(([, x]) => x != null && x !== '')) };
    else ao[k] = v;
  }
  if (json.dateLimiteDocTech) ao.docTechSeparee = true;
  return ao;
}
