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
- Paramètre de version : `v=7.0.1`, avec le user-agent `Android EDMOBILE v7.0.1` (profil « appli mobile »,
  d'après pawDirecte). Hibou utilisait auparavant le profil « site web » (`v=4.104.3`, user-agent Chrome,
  en-têtes `origin`/`referer`, valeurs de `ecoledirecte==0.4.2`) : ce profil ne reçoit pas d'`accessToken`.
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

## Connexion « se souvenir de moi » (jeton, type mobile)

Source : documentation communautaire de l'API (`ecoledirecte-api-docs`), « Authentification type mobile ».

1. Connexion par mot de passe avec en plus `"sesouvenirdemoi": true` et un `uuid` (v4) généré par l'appli,
   à garder avec le jeton. Soumise au QCM comme une connexion normale.
2. La réponse contient `accessToken` dans l'objet compte (`data.accounts[0]`) — Hibou accepte aussi `access_token`.
3. Reconnexion sans mot de passe : `POST login.awp` avec
   `{"identifiant", "motdepasse": "???", "isReLogin": true, "uuid", "typeCompte", "accesstoken"}` (+ `fa` si connus).
   La doc communautaire indique `motdepasse` vide ; pawDirecte et Papillon-ED-Core envoient `"???"`, repris par Hibou.
4. **Le jeton n'est renvoyé qu'au profil « appli mobile »** (user-agent `Android EDMOBILE …`). Constaté le
   22/11/2026 : avec le profil « site web », le compte ne contient pas d'`accessToken` (seulement `socketToken`, `uid`…).
   La réponse est celle d'un login normal, avec un nouveau token de session (et éventuellement un nouvel `accessToken`).

Hibou : jeton enregistré seulement si « Rester connecté » est coché (chiffré, `session.bin`), effacé à la
déconnexion ou s'il est refusé. Dès le jeton reçu, le mot de passe est effacé de la mémoire.
Durée de validité du jeton : inconnue.

## Références

Hibou n'inclut le code d'aucun de ces projets. Seuls des faits de protocole en sont repris (routes, noms de
champs, en-têtes, valeurs attendues par EcoleDirecte), réimplémentés indépendamment. Merci à leurs auteurs.

| Projet | Licence | Version consultée | Ce que Hibou en reprend |
|---|---|---|---|
| [hass-ecoledirecte](https://github.com/hacf-fr/hass-ecoledirecte) (HACF) | MIT | branche `main`, novembre 2026 | intégration de référence : flux de connexion qui fonctionne en pratique |
| bibliothèque [`ecoledirecte`](https://pypi.org/project/ecoledirecte/) (Giga77), utilisée par hass-ecoledirecte | LGPL-3.0-or-later | 0.4.2 (`src/ecoledirecte_api/client.py`) | GTK, login, QCM (`doubleauth.awp`), cn/cv, encodage des identifiants, codes d'erreur, ancien profil « site web » |
| [EduWireApps/ecoledirecte-api-docs](https://github.com/EduWireApps/ecoledirecte-api-docs) | aucune indiquée | commit `39e3a156e35d` (2025-04-01) | description de la connexion « type mobile » (`sesouvenirdemoi`, `uuid`, `isReLogin`, `accesstoken`), routes |
| [Lecloow/pawDirecte](https://github.com/Lecloow/pawDirecte) | GPL-3.0 | commit `c74455ff8616` (2025-10-29), `src/core/request.ts`, `src/api/login.ts`, `src/definitions/login.ts` | user-agent `Android EDMOBILE v7.0.1`, `v=7.0.1`, `motdepasse: "???"` en reconnexion, `fa[].uniq: false`, champ `accessToken` du compte |
| [PapillonApp/Papillon-ED-Core](https://github.com/PapillonApp/Papillon-ED-Core) | GPL-3.0 | commit `17e18a7048c0` (2024-04-25), `src/auth.ts` | confirmation du flux `sesouvenirdemoi` / `renewToken` (`isReLogin`, `accesstoken`, `motdepasse: "???"`) |

