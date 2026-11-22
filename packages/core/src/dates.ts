/** Utilitaires de dates sur des chaînes `YYYY-MM-DD`, sans dépendre du fuseau horaire. */
import type { DateISO } from './types';

const JOUR_MS = 86_400_000;

const versUtc = (iso: DateISO): number => {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a!, m! - 1, j!);
};
const depuisUtc = (ms: number): DateISO => new Date(ms).toISOString().slice(0, 10);

/** Date locale du jour (ou de `d`) au format ISO. */
export function dateLocale(d: Date = new Date()): DateISO {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function ajouterJours(iso: DateISO, n: number): DateISO {
  return depuisUtc(versUtc(iso) + n * JOUR_MS);
}

export function ecartJours(de: DateISO, a: DateISO): number {
  return Math.round((versUtc(a) - versUtc(de)) / JOUR_MS);
}

/** 1 = lundi … 7 = dimanche. */
export function jourSemaine(iso: DateISO): number {
  const j = new Date(versUtc(iso)).getUTCDay();
  return j === 0 ? 7 : j;
}

export function lundiDeLaSemaine(iso: DateISO): DateISO {
  return ajouterJours(iso, 1 - jourSemaine(iso));
}
