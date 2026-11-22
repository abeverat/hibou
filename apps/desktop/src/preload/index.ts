import { contextBridge, ipcRenderer } from 'electron';
import { METHODES_API } from '@hibou/core/src/service';
import { CANAL_IPC, CANAL_REGLAGES, CANAL_VERROU, METHODES_BUREAU, type ReponseIpc } from './ipc';

/** Erreur reçue du processus principal, reconstruite côté fenêtre. */
const appeler = (methode: string) => async (...args: unknown[]) => {
  const r = (await ipcRenderer.invoke(CANAL_IPC, methode, args)) as ReponseIpc;
  if (r.ok) return r.valeur;
  // contextBridge ne transmet que le message d'une Error : on encode le type dedans.
  throw new Error(JSON.stringify(r.erreur));
};

contextBridge.exposeInMainWorld(
  'hibou',
  {
    ...Object.fromEntries([...METHODES_API, ...METHODES_BUREAU].map((m) => [m, appeler(m)])),
    onVerrouillage(rappel: () => void) {
      const ecoute = () => rappel();
      ipcRenderer.on(CANAL_VERROU, ecoute);
      return () => ipcRenderer.removeListener(CANAL_VERROU, ecoute);
    },
    onReglages(rappel: () => void) {
      const ecoute = () => rappel();
      ipcRenderer.on(CANAL_REGLAGES, ecoute);
      return () => ipcRenderer.removeListener(CANAL_REGLAGES, ecoute);
    },
  },
);
