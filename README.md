---
title: Dossier AO
emoji: 📁
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Dossier AO — générateur de réponse aux appels d'offres (Maroc)

Vous déposez le **RC** et le **CPS** (PDF, + l'Avis si vous l'avez) ; l'application remplit un dossier complet :

| Dossier | Fichiers générés |
|---|---|
| `00_Elements_du_dossier_AO.docx` | Fiche AO, calendrier (J-n), structure des plis, **détail de chaque pièce** (forme, échéance, source), bornes « offre excessive / anormalement basse », causes d'élimination, check-list |
| `01_Dossier_administratif` | Déclaration sur l'honneur, demande de caution provisoire (+ mentions à vérifier) |
| `02_Dossier_technique` | Note moyens humains et techniques, modèle d'attestation de référence, demande + modèle d'attestation constructeur, tableau de conformité (xlsx, spécifications du CPS) |
| `03_Offre_financiere` | Acte d'engagement (montants en lettres), bordereau des prix (xlsx à formules + feuille de contrôle à ne pas déposer) |
| `04_Enveloppes_et_pages_de_garde` | Pli extérieur, enveloppes n°1 et n°2, pli documentation technique, états des pièces |

## Lancer

```
npm install
npm start
```
Puis ouvrir http://localhost:3000. Les infos de votre entreprise (onglet 3) sont enregistrées dans `data/company.json`.

## Limites à connaître
- Les **dates d'ouverture / de dépôt de la documentation technique et l'estimation** figurent dans l'**Avis**, pas dans le RC/CPS : ajoutez l'Avis ou saisissez-les.
- L'extraction se fait par règles (testée sur le DAO ONP N°15/2026). Un RC très différent peut laisser des champs vides : tout est modifiable avant génération. Avec `ANTHROPIC_API_KEY` défini, une case « Compléter avec l'IA » apparaît (non testée sans clé).
- PDF **scannés** : lus par OCR (tesseract.js, 1ʳᵉ utilisation = téléchargement du modèle français). Un scan très pâle reste illisible : préférez le PDF téléchargé depuis marchespublics.gov.ma.
- Les numéros d'articles et formulations suivent le modèle standard ; comparez toujours avec les annexes du dossier officiel avant de signer.

## Publier sur Internet (Render, gratuit)
1. Créez un dépôt GitHub (privé ou public) et poussez ce dossier : `git remote add origin <url>` puis `git push -u origin main`.
2. Sur https://render.com : *New* → *Blueprint* → choisissez le dépôt. Render lit `render.yaml` et construit le `Dockerfile`.
3. L'adresse publique est affichée à la fin du déploiement (`https://dossier-ao-xxxx.onrender.com`).

Mode public (`PUBLIC=1`, déjà positionné) : aucune donnée d'entreprise n'est conservée sur le serveur (profil gardé dans le navigateur de chaque utilisateur), IA désactivée, 15 analyses/heure/IP, fichiers ≤ 30 Mo, résultats supprimés après 30 min.
Offre gratuite Render : l'application se met en veille après inactivité (1er chargement ~30 s) et l'OCR de gros PDF peut être lent.

## Publier gratuitement sur Hugging Face Spaces (sans carte bancaire)
1. Compte gratuit sur https://huggingface.co, puis *New → Space* : SDK **Docker**, vide, visibilité **Public**.
2. `git remote add space https://huggingface.co/spaces/<utilisateur>/<nom-du-space>` puis `git push space main` (mot de passe = jeton d'accès *Write* créé dans Settings → Access Tokens).
3. L'adresse publique est `https://<utilisateur>-<nom-du-space>.hf.space`.
