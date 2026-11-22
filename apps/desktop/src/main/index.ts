import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { DemoBackend, ErreurEd, HibouService, METHODES_API, ReelBackend, type Http } from '@hibou/core';
import { CANAL_IPC, METHODES_BUREAU, type ReponseIpc } from '../preload/ipc';
import { appareil } from './appareil';

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

const reel = DEMO
  ? null
  : new ReelBackend({
      http: httpNode,
      journal: DEBUG ? (m) => console.log(`[ecoledirecte] ${m}`) : undefined,
      onDoubleAuth: (fa) => (faEnAttente = { identifiant: identifiantCourant, fa }),
    });

// Le service (et donc le token EcoleDirecte) vit uniquement dans le processus principal :
// la fenêtre n'y accède que par les méthodes listées ci-dessous.
const service = new HibouService(reel ?? new DemoBackend());

const bureau = {
  async connexion(identifiant: string, motdepasse: string) {
    identifiantCourant = identifiant;
    faEnAttente = null;
    reel?.definirDoubleAuth(appareil.lire(identifiant));
    return service.connexion(identifiant, motdepasse);
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
    faEnAttente = null;
    return service.deconnexion();
  },
};

const methodes = new Set<string>([...METHODES_API, ...METHODES_BUREAU]);

ipcMain.handle(CANAL_IPC, async (_evt, methode: string, args: unknown[]): Promise<ReponseIpc> => {
  if (!methodes.has(methode) || !Array.isArray(args)) {
    return { ok: false, erreur: { type: 'inconnue', message: `Méthode inconnue : ${methode}` } };
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
    backgroundColor: '#111418',
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

app.whenReady().then(() => {
  creerFenetre();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) creerFenetre();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
