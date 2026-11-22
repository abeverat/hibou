import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { DemoBackend, ErreurEd, HibouService, METHODES_API, type EdBackend } from '@hibou/core';
import { CANAL_IPC, type ReponseIpc } from '../preload/ipc';

const DEMO = process.env.DEMO === '1';

/** Le backend réel (étape 4) remplacera celui-ci. */
const backendReelProvisoire: EdBackend = {
  demo: false,
  async connexion() {
    throw new ErreurEd('non-implemente', "La connexion à EcoleDirecte n'est pas encore branchée. Lancez « npm run dev:demo ».");
  },
  async repondreQcm() {
    throw new ErreurEd('non-implemente', 'Non disponible.');
  },
  async requete() {
    throw new ErreurEd('non-connecte', "Vous n'êtes pas connecté.");
  },
  deconnexion() {},
};

// Le service (et donc le token EcoleDirecte) vit uniquement dans le processus principal :
// la fenêtre n'y accède que par les méthodes listées dans METHODES_API.
const service = new HibouService(DEMO ? new DemoBackend() : backendReelProvisoire);
const methodes = new Set<string>(METHODES_API);

ipcMain.handle(CANAL_IPC, async (_evt, methode: string, args: unknown[]): Promise<ReponseIpc> => {
  if (!methodes.has(methode) || !Array.isArray(args)) {
    return { ok: false, erreur: { type: 'inconnue', message: `Méthode inconnue : ${methode}` } };
  }
  try {
    const fn = service[methode as keyof HibouService] as (...a: unknown[]) => Promise<unknown>;
    return { ok: true, valeur: await fn.apply(service, args) };
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
