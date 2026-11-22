# API EcoleDirecte — notes de référence

API non officielle. Sources vérifiées le 2026-11-22 :

- **Référence principale :** intégration Home Assistant `hacf-fr/hass-ecoledirecte`
  (mise à jour le 2026-11-07, fonctionne chez nous) et sa bibliothèque Python
  `ecoledirecte==0.4.2` (PyPI, fichier `ecoledirecte_api/client.py`).
- Doc communautaire `EduWireApps/ecoledirecte-api-docs` (dernière mise à jour avril 2025)
  pour les formats de réponse.
- `pawdirecte` : dépôt introuvable sous `LiterateInk/pawdirecte`, non utilisé.

## Généralités

- Base : `https://api.ecoledirecte.com/v3`
- Paramètre de version : `v=4.104.3` (valeur de `ecoledirecte==0.4.2`).
  Code `517` = version refusée → mettre à jour.
- Toutes les requêtes en `POST`, verbe réel dans `?verbe=get|put|post`.
- Corps : `data={...json...}`, `content-type: application/x-www-form-urlencoded`.
- En-têtes copiés de la bibliothèque : `origin: https://www.ecoledirecte.com`,
  `referer: https://www.ecoledirecte.com/`, user-agent Chrome/Windows.
  **Le même user-agent doit être utilisé pendant toute la durée de vie d'un token.**
- Réponse : `{ host, code, token, message, data }`. Le statut HTTP vaut presque toujours 200,
  le vrai statut est `code`.
- Token : lu dans l'**en-tête de réponse `x-token`**, renvoyé dans l'en-tête `X-Token`.
  Mettre à jour le token à chaque réponse qui en contient un.

| code | sens |
|---|---|
| 200 | OK |
| 210 | OK, pas de données |
| 250 | QCM de double authentification requis |
| 505 | identifiant ou mot de passe invalide |
| 517 | version d'API invalide |
| 520 / 525 | token invalide / expiré → se reconnecter |
| 535 | établissement indisponible (vacances…) |

## Connexion

1. `GET login.awp?gtk=1&v=…` → cookie `GTK`. Le renvoyer en en-tête `X-Gtk`
   (et garder les cookies de la session).
2. `POST login.awp?v=…` avec
   `data={"identifiant":"<enc>", "motdepasse":"<enc>", "isReLogin": false, "uuid": ""}`.
   `<enc>` = `quote(s, safe="~()*!.'%\\")` puis `\` → `\\` (équivalent JS :
   `encodeURIComponent` en gardant `~()*!.'`).
   Lire le token dans `x-token`. Un en-tête `2FA-Token` peut être présent : le renvoyer tel quel.
3. Si `code == 250` :
   - `POST connexion/doubleauth.awp?verbe=get&v=…` avec `data={}` →
     `data.question` et `data.propositions[]` en base64 (nouveau token dans `x-token`) ;
   - `POST connexion/doubleauth.awp?verbe=post&v=…` avec `data={"choix":"<proposition base64>"}`
     → `data.cn`, `data.cv` ;
   - refaire GTK puis login en ajoutant `"cn", "cv"` **et** `"fa": [{"cn":…, "cv":…}]`.
   - `cn`/`cv` sont réutilisables : les mémoriser (keychain) évite le QCM.
4. Comptes : `data.accounts[]`, prendre celui avec `main: true`.
   - `typeCompte == "E"` : élève, `id` = id élève, classe dans `profile.classe.libelle`.
   - `typeCompte == "1"` : famille, enfants dans `profile.eleves[]` (`id`, `prenom`, `nom`,
     `classe.libelle`).
   - Parent rattaché à plusieurs établissements : `POST renewtoken.awp?verbe=post` avec
     `data={"idUser": <idLogin>, "uuid": ""}` pour changer de compte.

## Routes de données

| Donnée | Route | Corps |
|---|---|---|
| Emploi du temps | `E/{id}/emploidutemps.awp?verbe=get` | `{"dateDebut","dateFin","avecTrous":false}` |
| Devoirs à venir | `Eleves/{id}/cahierdetexte.awp?verbe=get` | `{}` |
| Devoirs d'un jour | `Eleves/{id}/cahierdetexte/{YYYY-MM-DD}.awp?verbe=get` | `{}` |
| Cocher un devoir | `Eleves/{id}/cahierdetexte.awp?verbe=put` | `{"idDevoirsEffectues":[…],"idDevoirsNonEffectues":[…]}` |
| Notes | `eleves/{id}/notes.awp?verbe=get` | `{"anneeScolaire":""}` |

Les formats des réponses sont reproduits dans `packages/core/src/ed/fixtures/`.
