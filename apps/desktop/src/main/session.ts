/**
 * « Rester connecté » : jeton de reconnexion EcoleDirecte (jamais le mot de passe),
 * enregistré seulement si l'utilisateur coche la case, chiffré par safeStorage
 * (trousseau macOS, DPAPI Windows). Effacé à la déconnexion ou quand EcoleDirecte le refuse.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, safeStorage } from 'electron';
import type { JetonConnexion } from '@hibou/core';

const fichier = (demo: boolean) => join(app.getPath('userData'), demo ? 'session-demo.bin' : 'session.bin');

export const sessionEnregistree = {
  disponible: () => safeStorage.isEncryptionAvailable(),
  existe: (demo: boolean) => existsSync(fichier(demo)),
  enregistrer(demo: boolean, jeton: JetonConnexion) {
    if (!safeStorage.isEncryptionAvailable()) return;
    writeFileSync(fichier(demo), safeStorage.encryptString(JSON.stringify(jeton)), { mode: 0o600 });
  },
  lire(demo: boolean): JetonConnexion | null {
    try {
      const j = JSON.parse(safeStorage.decryptString(readFileSync(fichier(demo)))) as JetonConnexion;
      return j?.accessToken && j.identifiant && j.uuid ? j : null;
    } catch {
      return null;
    }
  },
  effacer(demo: boolean) {
    rmSync(fichier(demo), { force: true });
  },
};
