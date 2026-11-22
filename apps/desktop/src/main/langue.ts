/**
 * Libellés natifs (menu, bouton Réglages) selon la langue du système,
 * avec le vocabulaire de chaque plateforme : « Réglages… » sur macOS, « Paramètres » sur Windows.
 */
import { app } from 'electron';

type Libelles = { mac: string; win: string; fichier: string };

const TRADUCTIONS: Record<string, Libelles> = {
  fr: { mac: 'Réglages…', win: 'Paramètres', fichier: 'Fichier' },
  en: { mac: 'Settings…', win: 'Settings', fichier: 'File' },
  de: { mac: 'Einstellungen …', win: 'Einstellungen', fichier: 'Datei' },
  es: { mac: 'Ajustes…', win: 'Configuración', fichier: 'Archivo' },
  it: { mac: 'Impostazioni…', win: 'Impostazioni', fichier: 'File' },
  pt: { mac: 'Ajustes…', win: 'Definições', fichier: 'Arquivo' },
  nl: { mac: 'Instellingen…', win: 'Instellingen', fichier: 'Bestand' },
  el: { mac: 'Ρυθμίσεις…', win: 'Ρυθμίσεις', fichier: 'Αρχείο' },
};

export function langueSysteme(): string {
  const l = app.getPreferredSystemLanguages()[0] ?? app.getLocale();
  return (l || 'fr').slice(0, 2).toLowerCase();
}

export function libellesSysteme() {
  const t = TRADUCTIONS[langueSysteme()] ?? TRADUCTIONS.en!;
  const menu = process.platform === 'darwin' ? t.mac : t.win;
  return { reglagesMenu: menu, reglages: menu.replace(/\s*…$/, ''), fichier: t.fichier };
}
