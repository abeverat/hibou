/**
 * Déverrouillage biométrique : Touch ID (macOS) ou Windows Hello (Windows).
 *
 * Choix validé par l'utilisateur : le mot de passe EcoleDirecte est rangé chiffré
 * (safeStorage : clé dans le trousseau macOS / DPAPI Windows) et Hibou ne le déchiffre
 * qu'après une vérification biométrique réussie. Activation uniquement sur accord explicite.
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, safeStorage, systemPreferences } from 'electron';

export type NomBiometrie = 'Touch ID' | 'Windows Hello';

// ---------- Windows Hello (via PowerShell et l'API WinRT UserConsentVerifier) ----------

const SCRIPT_WINDOWS = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
})[0]
function Attendre($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
$dispo = Attendre ([Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()) ([Windows.Security.Credentials.UI.UserConsentVerifierAvailability])
if ($env:HIBOU_MODE -eq 'verifier') {
  if ("$dispo" -ne 'Available') { 'Indisponible'; exit }
  $r = Attendre ([Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync($env:HIBOU_RAISON)) ([Windows.Security.Credentials.UI.UserConsentVerificationResult])
  "$r"
} else { "$dispo" }
`;

function windowsHello(mode: 'disponible' | 'verifier', raison = ''): Promise<string> {
  return new Promise((resoudre) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT_WINDOWS],
      // La raison passe par une variable d'environnement : aucune injection possible dans le script.
      { env: { ...process.env, HIBOU_MODE: mode, HIBOU_RAISON: raison }, timeout: 120_000, windowsHide: true },
      (erreur, sortie) => resoudre(erreur ? '' : String(sortie).trim()),
    );
  });
}

let nomEnCache: NomBiometrie | null | undefined;

export async function nomBiometrie(): Promise<NomBiometrie | null> {
  if (nomEnCache !== undefined) return nomEnCache;
  if (!safeStorage.isEncryptionAvailable()) nomEnCache = null;
  else if (process.platform === 'darwin') nomEnCache = systemPreferences.canPromptTouchID() ? 'Touch ID' : null;
  else if (process.platform === 'win32') nomEnCache = (await windowsHello('disponible')) === 'Available' ? 'Windows Hello' : null;
  else nomEnCache = null;
  return nomEnCache;
}

/** Demande l'empreinte / le visage / le code Windows Hello. */
export async function verifierBiometrie(raison: string): Promise<boolean> {
  if (!(await nomBiometrie())) return false;
  if (process.platform === 'darwin') {
    try {
      await systemPreferences.promptTouchID(raison);
      return true;
    } catch {
      return false; // annulé ou échec
    }
  }
  return (await windowsHello('verifier', raison)) === 'Verified';
}

// ---------- Coffre des identifiants ----------

export interface Identifiants {
  identifiant: string;
  motdepasse: string;
}

const fichier = (demo: boolean) => join(app.getPath('userData'), demo ? 'identifiants-demo.bin' : 'identifiants.bin');

export const coffre = {
  existe: (demo: boolean) => existsSync(fichier(demo)),
  enregistrer(demo: boolean, id: Identifiants) {
    writeFileSync(fichier(demo), safeStorage.encryptString(JSON.stringify(id)), { mode: 0o600 });
  },
  /** À n'appeler qu'après `verifierBiometrie`. */
  lire(demo: boolean): Identifiants | null {
    try {
      return JSON.parse(safeStorage.decryptString(readFileSync(fichier(demo)))) as Identifiants;
    } catch {
      return null;
    }
  },
  effacer(demo: boolean) {
    rmSync(fichier(demo), { force: true });
  },
};
