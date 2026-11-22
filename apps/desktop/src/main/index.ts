import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, Menu, powerMonitor, shell } from 'electron';
import { DemoBackend, ErreurEd, HibouService, METHODES_API, ReelBackend, type Http, type ResultatConnexion } from '@hibou/core';
import { CANAL_IPC, CANAL_REGLAGES, CANAL_VERROU, METHODES_BUREAU, type EtatBiometrie, type EtatReglages, type ReponseIpc } from '../preload/ipc';
import { libellesSysteme } from './langue';
import { sessionEnregistree } from './session';
import { appareil } from './appareil';
import { BIOMETRIE_ACTIVEE, coffre, nomBiometrie, verifierBiometrie, type Identifiants } from './biometrie';

// En développement (npm run dev), Hibou se présente comme « Hibou Dev » : trousseau
// (« Hibou Dev Safe Storage ») et dossier de données séparés de l'appli installée, sinon
// macOS redemanderait l'accès au trousseau en passant de l'une à l'autre.
if (!app.isPackaged) {
  app.setName('Hibou Dev');
  app.setPath('userData', join(app.getPath('appData'), 'Hibou Dev'));
}

const DEMO = process.env.DEMO === '1';
/** HIBOU_DEBUG=1 : journalise les routes et codes EcoleDirecte (jamais d'identifiants ni de données). */
const DEBUG = process.env.HIBOU_DEBUG === '1';

/** HTTP via le fetch de Node : pas de CORS, en-têtes de navigateur autorisés. */
const httpNode: Http = async (r) => {
  const reponse = await fetch(r.url, {
    method: r.methode,
    headers: r.enTetes,
    body: r.corps,
    signal: AbortSignal.timeout(30_000),
  });
  const enTetes: Record<string, string> = {};
  reponse.headers.forEach((v, k) => (enTetes[k] = v));
  return { statut: reponse.status, enTetes, cookies: reponse.headers.getSetCookie(), texte: await reponse.text() };
};

/** cn/cv reçus après un QCM réussi, en attente de l'accord de l'utilisateur pour les mémoriser. */
let faEnAttente: { identifiant: string; fa: { cn: string; cv: string } } | null = null;
let identifiantCourant = '';
/** Identifiants de la dernière connexion par mot de passe, gardés en mémoire le temps de
 *  proposer la biométrie (effacés dès que l'utilisateur a répondu). */
let identifiantsEnAttente: Identifiants | null = null;
/** « Rester connecté » coché pour la session en cours : le jeton est enregistré (et renouvelé). */
let garderConnexion = false;
/** Appli verrouillée (veille, écran verrouillé) : seules quelques méthodes restent permises. */
let verrouille = false;
const PERMIS_VERROUILLE = new Set(['etat', 'estVerrouille', 'deverrouillerSession', 'deconnexion', 'biometrie']);

const reel = DEMO
  ? null
  : new ReelBackend({
      http: httpNode,
      journal: DEBUG ? (m) => console.log(`[ecoledirecte] ${m}`) : undefined,
      onDoubleAuth: (fa) => (faEnAttente = { identifiant: identifiantCourant, fa }),
      // Jeton renouvelé par EcoleDirecte (reconnexion silencieuse) : on garde le plus récent.
      onJeton: (jeton) => garderConnexion && sessionEnregistree.enregistrer(DEMO, jeton),
    });

// Le service (et donc le token EcoleDirecte) vit uniquement dans le processus principal :
// la fenêtre n'y accède que par les méthodes listées ci-dessous.
const service = new HibouService(reel ?? new DemoBackend());

async function connecter(identifiant: string, motdepasse: string) {
  identifiantCourant = identifiant;
  faEnAttente = null;
  verrouille = false;
  reel?.definirDoubleAuth(DEMO ? null : appareil.lire(identifiant));
  return service.connexion(identifiant, motdepasse);
}

/** Après une connexion réussie : enregistre le jeton si « Rester connecté » est coché. */
function memoriserSession(r: ResultatConnexion) {
  if (r.etat !== 'connecte') return;
  const jeton = service.jetonActuel();
  if (garderConnexion && jeton) sessionEnregistree.enregistrer(DEMO, jeton);
  else sessionEnregistree.effacer(DEMO);
}

const bureau = {
  async connexion(identifiant: string, motdepasse: string, garder?: unknown) {
    garderConnexion = garder === true && sessionEnregistree.disponible();
    if (BIOMETRIE_ACTIVEE) identifiantsEnAttente = { identifiant, motdepasse };
    try {
      const r = await connecter(identifiant, motdepasse);
      memoriserSession(r);
      return r;
    } catch (e) {
      identifiantsEnAttente = null;
      throw e;
    }
  },
  async repondreQcm(choix: string) {
    const r = await service.repondreQcm(choix);
    memoriserSession(r);
    return r;
  },
  /** Au lancement : reconnexion avec le jeton enregistré, ou null s'il n'y en a pas. */
  async reprendreSession(): Promise<ResultatConnexion | null> {
    if (!sessionEnregistree.existe(DEMO)) return null;
    const jeton = sessionEnregistree.lire(DEMO);
    if (!jeton) {
      sessionEnregistree.effacer(DEMO);
      return null;
    }
    identifiantCourant = jeton.identifiant;
    faEnAttente = null;
    verrouille = false;
    reel?.definirDoubleAuth(DEMO ? null : appareil.lire(jeton.identifiant));
    try {
      garderConnexion = true;
      const r = await service.reprendre(jeton);
      memoriserSession(r);
      return r;
    } catch (e) {
      // Jeton refusé : on l'efface ; erreur réseau : on le garde pour la prochaine fois.
      if (e instanceof ErreurEd && e.type !== 'indisponible') {
        garderConnexion = false;
        sessionEnregistree.effacer(DEMO);
      }
      throw e;
    }
  },
  async biometrie(): Promise<EtatBiometrie> {
    const nom = await nomBiometrie();
    const active = nom !== null && coffre.existe(DEMO);
    const connecte = (await service.etat()).compte !== null;
    return { nom, active, proposer: nom !== null && !active && connecte && identifiantsEnAttente !== null };
  },
  async activerBiometrie(motdepasse?: unknown) {
    // Depuis les réglages : le mot de passe est ressaisi pour le compte déjà connecté.
    const depuisReglages = typeof motdepasse === 'string' && motdepasse !== '' && identifiantCourant !== '' && (await service.etat()).compte !== null;
    const id = depuisReglages ? { identifiant: identifiantCourant, motdepasse: motdepasse as string } : identifiantsEnAttente;
    if (!id) return false;
    const nom = await nomBiometrie();
    if (!nom || !(await verifierBiometrie('activer le déverrouillage de Hibou'))) return false;
    coffre.enregistrer(DEMO, id);
    identifiantsEnAttente = null;
    return true;
  },
  async ignorerBiometrie() {
    identifiantsEnAttente = null;
  },
  async reglages(): Promise<EtatReglages> {
    return {
      biometrie: await bureau.biometrie(),
      identifiant: identifiantCourant,
      appareilMemorise: !DEMO && appareil.estMemorise(),
      libelles: libellesSysteme(),
    };
  },
  async desactiverBiometrie() {
    coffre.effacer(DEMO);
  },
  async deverrouiller() {
    if (!(await verifierBiometrie('ouvrir Hibou'))) {
      throw new ErreurEd('biometrie', 'Vérification annulée. Réessayez ou connectez-vous avec votre mot de passe.');
    }
    const id = coffre.lire(DEMO);
    if (!id) {
      coffre.effacer(DEMO);
      throw new ErreurEd('biometrie', 'Identifiants enregistrés illisibles : connectez-vous avec votre mot de passe.');
    }
    try {
      return await connecter(id.identifiant, id.motdepasse);
    } catch (e) {
      if (e instanceof ErreurEd && e.type === 'identifiants') {
        coffre.effacer(DEMO); // mot de passe changé entre-temps
        throw new ErreurEd('identifiants', "Le mot de passe enregistré n'est plus accepté par EcoleDirecte. Connectez-vous à nouveau.");
      }
      throw e;
    }
  },
  async verrouiller() {
    if ((await service.etat()).compte) verrouille = true;
  },
  async deverrouillerSession() {
    if (!verrouille) return true;
    if (await verifierBiometrie('déverrouiller Hibou')) verrouille = false;
    return !verrouille;
  },
  async estVerrouille() {
    return verrouille;
  },
  async appareilEnAttente() {
    return faEnAttente !== null && appareil.chiffrementDisponible();
  },
  async memoriserAppareil() {
    if (!faEnAttente || !appareil.chiffrementDisponible()) return false;
    appareil.memoriser(faEnAttente.identifiant, faEnAttente.fa);
    faEnAttente = null;
    return true;
  },
  async oublierAppareil() {
    appareil.oublier();
    reel?.definirDoubleAuth(null);
  },
  async appareilMemorise() {
    return !DEMO && appareil.estMemorise();
  },
  async deconnexion() {
    garderConnexion = false;
    sessionEnregistree.effacer(DEMO);
    faEnAttente = null;
    identifiantsEnAttente = null;
    verrouille = false;
    return service.deconnexion();
  },
};

const methodes = new Set<string>([...METHODES_API, ...METHODES_BUREAU]);

ipcMain.handle(CANAL_IPC, async (_evt, methode: string, args: unknown[]): Promise<ReponseIpc> => {
  if (!methodes.has(methode) || !Array.isArray(args)) {
    return { ok: false, erreur: { type: 'inconnue', message: `Méthode inconnue : ${methode}` } };
  }
  if (verrouille && !PERMIS_VERROUILLE.has(methode)) {
    return { ok: false, erreur: { type: 'verrouille', message: 'Hibou est verrouillé.' } };
  }
  try {
    const cible = (methode in bureau ? bureau : service) as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
    return { ok: true, valeur: await cible[methode]!.apply(cible, args) };
  } catch (e) {
    if (e instanceof ErreurEd) return { ok: false, erreur: { type: e.type, message: e.message } };
    // Pas de détails techniques dans la fenêtre (ni dans les logs : ils pourraient contenir des données).
    console.error('[hibou] erreur interne', e instanceof Error ? e.name : typeof e);
    return { ok: false, erreur: { type: 'inconnue', message: 'Erreur inattendue.' } };
  }
});

function creerFenetre() {
  const fenetre = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 360,
    minHeight: 500,
    title: DEMO ? 'Hibou — démo' : 'Hibou',
    // macOS : matériau translucide natif derrière la fenêtre (look « verre »), barre de titre
    // fondue dans l'en-tête de Hibou. Ailleurs : fond opaque.
    ...(process.platform === 'darwin'
      ? {
          vibrancy: 'under-window' as const,
          visualEffectState: 'followWindow' as const,
          backgroundColor: '#00000000',
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 18, y: 20 },
        }
      : { backgroundColor: '#111418' }),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  fenetre.once('ready-to-show', () => fenetre.show());

  // Les liens externes s'ouvrent dans le navigateur, jamais dans l'appli.
  fenetre.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  fenetre.webContents.on('will-navigate', (evt, url) => {
    if (url !== fenetre.webContents.getURL()) evt.preventDefault();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void fenetre.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void fenetre.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

/** Verrouille l'appli à la mise en veille ou au verrouillage de l'écran, si la biométrie est active. */
function verrouillageAutomatique() {
  const verrouillerSiActive = async () => {
    if (!coffre.existe(DEMO) || !(await nomBiometrie()) || !(await service.etat()).compte) return;
    verrouille = true;
    for (const f of BrowserWindow.getAllWindows()) f.webContents.send(CANAL_VERROU);
  };
  powerMonitor.on('lock-screen', verrouillerSiActive);
  powerMonitor.on('suspend', verrouillerSiActive);
}

/** Menu natif avec « Réglages… » (macOS) / « Paramètres » (Windows), dans la langue du système. */
function menuApplication() {
  const l = libellesSysteme();
  const ouvrirReglages = () => BrowserWindow.getFocusedWindow()?.webContents.send(CANAL_REGLAGES);
  const reglages = { label: l.reglagesMenu, accelerator: 'CmdOrCtrl+,', click: ouvrirReglages };
  const modele: Electron.MenuItemConstructorOptions[] =
    process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' }, { type: 'separator' }, reglages, { type: 'separator' },
              { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
              { type: 'separator' }, { role: 'quit' },
            ],
          },
          { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
        ]
      : [{ label: l.fichier, submenu: [reglages, { type: 'separator' }, { role: 'quit' }] }, { role: 'editMenu' }, { role: 'viewMenu' }];
  Menu.setApplicationMenu(Menu.buildFromTemplate(modele));
}

app.whenReady().then(() => {
  if (!BIOMETRIE_ACTIVEE) {
    // Aucun mot de passe enregistré ne doit rester sur le disque tant que la biométrie est coupée.
    coffre.effacer(false);
    coffre.effacer(true);
  }
  menuApplication();
  verrouillageAutomatique();
  creerFenetre();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
