# Hibou

Client alternatif pour EcoleDirecte : emploi du temps, devoirs, contrôles et notes.
Application de bureau (macOS, Windows), puis mobile (iPhone, Android).
**Non affilié à EcoleDirecte.** L'API utilisée n'est pas officielle et peut changer.

> ⚠️ **Projet expérimental.** Les installeurs ne sont pas encore signés : macOS et Windows affichent un avertissement à la première ouverture.

## Installer Hibou (pas à pas)

Pas besoin de connaissances techniques. Il suffit de télécharger un fichier et de suivre les étapes de votre ordinateur.

### Sur Mac

1. **Savoir quel Mac vous avez** : menu  (en haut à gauche) → **À propos de ce Mac**.
   La ligne **Puce** ou **Processeur** indique « Apple M1, M2, M3… » ou « Intel ».
2. **Télécharger** le fichier correspondant (environ 110 Mo) :
   - Mac à puce Apple (M1, M2, M3…) : [Hibou-mac-arm64.dmg](https://github.com/abeverat/hibou/releases/latest/download/Hibou-mac-arm64.dmg)
   - Mac Intel : [Hibou-mac-x64.dmg](https://github.com/abeverat/hibou/releases/latest/download/Hibou-mac-x64.dmg)
3. **Ouvrir le fichier téléchargé** : il se trouve dans le dossier **Téléchargements**. Double-cliquez dessus.
   Une fenêtre s'ouvre avec l'icône du hibou et un dossier **Applications**.
4. **Glisser le hibou sur le dossier Applications.** Hibou est installé. Vous pouvez fermer la fenêtre,
   puis mettre le fichier `.dmg` à la corbeille.
5. **Première ouverture** : ouvrez le dossier **Applications** (dans le Finder) et double-cliquez sur **Hibou**.
   macOS affiche un message du type *« Apple n'a pas pu vérifier… »* : c'est normal, Hibou n'est pas encore
   enregistré auprès d'Apple. Cliquez sur **Terminé** (ou **OK**), puis :
   - ouvrez le menu  → **Réglages Système** → **Confidentialité et sécurité** ;
   - descendez tout en bas : une ligne indique que « Hibou » a été bloqué. Cliquez sur **Ouvrir quand même** ;
   - confirmez avec votre mot de passe du Mac ou Touch ID, puis cliquez **Ouvrir**.

   Ces étapes ne sont à faire **qu'une seule fois**. Ensuite, Hibou s'ouvre normalement, depuis le Launchpad ou le Dock.
6. Si macOS demande l'accès au **trousseau** (« Hibou Safe Storage »), cliquez **Toujours autoriser** :
   c'est ce qui permet de garder vos réglages chiffrés.

### Sur Windows

1. **Télécharger** [Hibou-windows-setup.exe](https://github.com/abeverat/hibou/releases/latest/download/Hibou-windows-setup.exe)
   (environ 115 Mo, Windows 10 ou 11, 64 bits).
2. **Ouvrir le fichier téléchargé** (dossier **Téléchargements**).
3. Si un écran bleu *« Windows a protégé votre ordinateur »* apparaît : cliquez sur **Informations complémentaires**,
   puis sur **Exécuter quand même**. C'est normal, Hibou n'est pas encore enregistré auprès de Microsoft.
4. Suivez l'installation (**Suivant**, puis **Installer**). Aucun mot de passe administrateur n'est demandé.
   Hibou apparaît ensuite dans le menu Démarrer.

### Premiers pas

1. Connectez-vous avec **vos identifiants EcoleDirecte habituels** (ceux du site ou de l'appli officielle),
   compte parent ou compte élève.
2. La première fois, EcoleDirecte pose une **question de sécurité** (par exemple votre mois de naissance) :
   c'est EcoleDirecte qui la pose, Hibou ne fait que l'afficher. Hibou propose ensuite de **mémoriser cet ordinateur**
   pour ne plus la reposer.
3. Sur un Mac avec Touch ID ou un PC avec Windows Hello, Hibou propose d'**ouvrir l'appli avec votre empreinte**
   (ou votre visage). Vous pouvez dire « Plus tard » et l'activer quand vous voulez dans les **Réglages**
   (bouton ⚙︎ en haut à droite, ou ⌘, sur Mac / Ctrl+, sur Windows).

### Mettre à jour, désinstaller

- **Mettre à jour** : Hibou ne se met pas à jour tout seul. Téléchargez la dernière version sur la page
  [Releases](https://github.com/abeverat/hibou/releases) et réinstallez par-dessus : vos réglages sont conservés.
- **Désinstaller** : sur Mac, glissez Hibou du dossier Applications vers la corbeille. Sur Windows,
  **Paramètres → Applications → Hibou → Désinstaller**.

### En cas de problème

- *« Identifiant ou mot de passe incorrect »* : vérifiez-les d'abord sur le site d'EcoleDirecte.
- *« Établissement indisponible »* ou *« EcoleDirecte a changé de version »* : EcoleDirecte a peut-être évolué.
  Vérifiez s'il existe une nouvelle version de Hibou, ou signalez-le dans [Issues](https://github.com/abeverat/hibou/issues).

---

## Pour les développeurs

### Lancer depuis les sources

Prérequis : [Miniforge](https://github.com/conda-forge/miniforge) (conda) et git.

```sh
git clone https://github.com/abeverat/hibou.git && cd hibou
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
`git tag vX.Y.Z && git push origin vX.Y.Z`. GitHub Actions fabrique les .dmg (macOS arm64 et x64) et le .exe (Windows)
et les publie ; les liens de téléchargement ci-dessus pointent toujours vers la dernière version.

### Organisation

| Dossier | Rôle |
|---|---|
| `packages/core/src/types.ts` | modèle de données interne (`Cours`, `Devoir`, `Note`, `Periode`, `Matiere`) |
| `packages/core/src/ed/` | **seule** couche qui connaît le format EcoleDirecte : backend, parseurs, mode démo, fixtures |
| `packages/core/src/service.ts` | ce que l'interface appelle (session, enfant choisi, cache 5 min) |
| `apps/desktop/src/main/` | processus principal Electron : le service et le token vivent ici |
| `apps/desktop/src/preload/` | pont limité entre la fenêtre et le service (liste blanche `METHODES_API`) |
| `apps/desktop/src/renderer/` | interface React |
| `docs/ecoledirecte-api.md` | notes sur l'API (connexion, QCM, routes) |

### Sécurité

- Le mot de passe n'est jamais écrit dans les logs, ni sur disque en clair. Seule exception, sur accord explicite :
  le déverrouillage par Touch ID / Windows Hello range le mot de passe chiffré par le trousseau du système
  (`identifiants.bin`), et Hibou ne le déchiffre qu'après la vérification biométrique. Désactivable dans les Réglages.
- Hibou se verrouille à la mise en veille et au verrouillage de l'écran quand la biométrie est active.
- Le token EcoleDirecte reste en mémoire dans le processus principal ; la fenêtre ne le voit pas.
- « Rester connecté » (case à cocher, décochée par défaut) : Hibou garde le jeton de reconnexion fourni par
  EcoleDirecte, jamais le mot de passe, chiffré par le trousseau du système (`session.bin`). « Déconnexion » l'efface.
  Le mot de passe est effacé de la mémoire dès que le jeton est reçu.
- Aucune donnée n'est envoyée ailleurs qu'à EcoleDirecte.
- Après une question de sécurité réussie, Hibou propose de mémoriser l'ordinateur : seuls les codes
  `cn`/`cv` fournis par EcoleDirecte sont gardés, chiffrés par le trousseau du système
  (`appareil.bin` dans le dossier de données de l'appli). « Oublier cet ordinateur » les efface.

## Références et remerciements

Hibou s'appuie sur le travail de la communauté qui documente l'API EcoleDirecte : l'intégration Home Assistant
[hass-ecoledirecte](https://github.com/hacf-fr/hass-ecoledirecte), la documentation
[ecoledirecte-api-docs](https://github.com/EduWireApps/ecoledirecte-api-docs), et les bibliothèques
[pawDirecte](https://github.com/Lecloow/pawDirecte) et [Papillon-ED-Core](https://github.com/PapillonApp/Papillon-ED-Core)
(projet [Papillon](https://github.com/PapillonApp)). Aucun code n'en est copié : seuls des faits de protocole sont
repris. Détail (versions consultées, ce qui est repris) : [docs/ecoledirecte-api.md](docs/ecoledirecte-api.md#références).

## Licence

[MIT](LICENSE). Hibou n'est ni affilié à EcoleDirecte ni approuvé par Aplim.

L'icône utilise le hibou de [Noto Emoji](https://github.com/googlefonts/noto-emoji) (Google), sous licence
[Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) ; voir [NOTICE](NOTICE).
