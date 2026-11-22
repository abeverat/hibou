import { contextBridge, ipcRenderer } from 'electron';
import { METHODES_API } from '@hibou/core/src/service';
import { CANAL_IPC, type ReponseIpc } from './ipc';

/** Erreur reçue du processus principal, reconstruite côté fenêtre. */
const appeler = (methode: string) => async (...args: unknown[]) => {
  const r = (await ipcRenderer.invoke(CANAL_IPC, methode, args)) as ReponseIpc;
  if (r.ok) return r.valeur;
  // contextBridge ne transmet que le message d'une Error : on encode le type dedans.
  throw new Error(JSON.stringify(r.erreur));
};

contextBridge.exposeInMainWorld(
  'hibou',
  Object.fromEntries(METHODES_API.map((m) => [m, appeler(m)])),
);
