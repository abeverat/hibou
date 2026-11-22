# Hibou

Client alternatif pour EcoleDirecte : emploi du temps, devoirs, contrôles et notes.
Application de bureau (macOS, Windows), puis mobile (iPhone, Android).
**Non affilié à EcoleDirecte.** L'API utilisée n'est pas officielle et peut changer.

## Lancer

```sh
conda env create -f environment.yml   # une seule fois
conda activate hibou
npm install                           # une seule fois
npm run dev:demo                      # mode démo (fixtures, sans identifiants)
npm run dev                           # vraie connexion (étape 4, pas encore branchée)
npm test
```

En mode démo :
- n'importe quel mot de passe fonctionne ;
- l'identifiant `qcm` affiche la question de sécurité (la bonne réponse est « Avril ») ;
- le mot de passe `faux` déclenche l'erreur d'identifiants.

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
