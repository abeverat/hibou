/**
 * Mémorisation de l'appareil (cn/cv du QCM EcoleDirecte), seulement si l'utilisateur l'accepte.
 * Chiffré avec safeStorage (trousseau macOS, DPAPI Windows). Jamais le mot de passe.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, safeStorage } from 'electron';

type Fa = { cn: string; cv: string };
const fichier = () => join(app.getPath('userData'), 'appareil.bin');
const cle = (identifiant: string) => identifiant.trim().toLowerCase();

function lire(): Record<string, Fa> {
  try {
    if (!existsSync(fichier()) || !safeStorage.isEncryptionAvailable()) return {};
    return JSON.parse(safeStorage.decryptString(readFileSync(fichier()))) as Record<string, Fa>;
  } catch {
    return {}; // fichier illisible (autre machine, trousseau réinitialisé) : on repassera le QCM
  }
}

function ecrire(donnees: Record<string, Fa>) {
  if (Object.keys(donnees).length === 0) {
    rmSync(fichier(), { force: true });
    return;
  }
  writeFileSync(fichier(), safeStorage.encryptString(JSON.stringify(donnees)), { mode: 0o600 });
}

export const appareil = {
  chiffrementDisponible: () => safeStorage.isEncryptionAvailable(),
  lire: (identifiant: string): Fa | null => lire()[cle(identifiant)] ?? null,
  memoriser(identifiant: string, fa: Fa) {
    ecrire({ ...lire(), [cle(identifiant)]: fa });
  },
  oublier(identifiant?: string) {
    if (!identifiant) return ecrire({});
    const d = lire();
    delete d[cle(identifiant)];
    ecrire(d);
  },
  estMemorise: () => Object.keys(lire()).length > 0,
};
