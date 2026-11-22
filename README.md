# Hibou

Client alternatif pour EcoleDirecte : emploi du temps, devoirs, contrôles et notes.
Application de bureau (macOS, Windows), puis mobile (iPhone, Android).
**Non affilié à EcoleDirecte.** L'API utilisée n'est pas officielle et peut changer.

> ⚠️ **Projet expérimental.** Les installeurs ne sont pas encore signés : macOS et Windows affichent un avertissement à la première ouverture.

## Installer

Télécharger le fichier de la dernière version dans [Releases](https://github.com/abeverat/hibou/releases) :

- **macOS** (Intel et Apple Silicon) : `Hibou-x.y.z-mac.dmg`. Ouvrir le .dmg, glisser Hibou dans Applications.
  Première ouverture : macOS refuse l'appli (non signée). Aller dans **Réglages Système → Confidentialité et sécurité**,
  tout en bas, cliquer **Ouvrir quand même** à côté de « Hibou », puis confirmer.
- **Windows** (64 bits) : `Hibou-x.y.z-windows-setup.exe`. Si SmartScreen affiche « Windows a protégé votre ordinateur »,
  cliquer **Informations complémentaires → Exécuter quand même**. L'installation se fait pour l'utilisateur courant, sans droits administrateur.

## Lancer depuis les sources

```sh
conda env create -f environment.yml   # une seule fois
conda activate hibou
npm install                           # une seule fois
npm run dev:demo                      # mode démo (fixtures, sans identifiants)
npm run dev                           # vraie connexion à EcoleDirecte
npm test
```

En mode démo :
- n'importe quel mot de passe fonctionne ;
- l'identifiant `qcm` affiche la question de sécurité (la bonne réponse est « Avril ») ;
- le mot de passe `faux` déclenche l'erreur d'identifiants.

Diagnostic de connexion : `HIBOU_DEBUG=1 npm run dev` affiche dans le terminal les routes appelées
et les codes de réponse d'EcoleDirecte (jamais d'identifiant, de token ni de données).

### Fabriquer les installeurs

```sh
npm run dist        # installeur pour la plateforme courante, dans apps/desktop/release/
```

Pour publier une version : mettre à jour `version` dans `apps/desktop/package.json`, puis
`git tag v0.1.0 && git push origin v0.1.0`. GitHub Actions fabrique le .dmg (macOS) et le .exe (Windows)
et les publie dans une préversion.

## Organisation

| Dossier | Rôle |
|---|---|
| `packages/core/src/types.ts` | modèle de données interne (`Cours`, `Devoir`, `Note`, `Periode`, `Matiere`) |
| `packages/core/src/ed/` | **seule** couche qui connaît le format EcoleDirecte : backend, parseurs, mode démo, fixtures |
| `packages/core/src/service.ts` | ce que l'interface appelle (session, enfant choisi, cache 5 min) |
| `apps/desktop/src/main/` | processus principal Electron : le service et le token vivent ici |
| `apps/desktop/src/preload/` | pont limité entre la fenêtre et le service (liste blanche `METHODES_API`) |
| `apps/desktop/src/renderer/` | interface React |
| `docs/ecoledirecte-api.md` | notes sur l'API (connexion, QCM, routes) |

## Sécurité

- Le mot de passe n'est jamais écrit sur disque ni dans les logs.
- Le token EcoleDirecte reste en mémoire dans le processus principal ; la fenêtre ne le voit pas.
- Aucune donnée n'est envoyée ailleurs qu'à EcoleDirecte.
- Après une question de sécurité réussie, Hibou propose de mémoriser l'ordinateur : seuls les codes
  `cn`/`cv` fournis par EcoleDirecte sont gardés, chiffrés par le trousseau du système
  (`appareil.bin` dans le dossier de données de l'appli). « Oublier cet ordinateur » les efface.

## Licence

[MIT](LICENSE). Hibou n'est ni affilié à EcoleDirecte ni approuvé par Aplim.
