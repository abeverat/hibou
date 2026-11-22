import type { HibouApi, TypeErreur } from '@hibou/core';

declare global {
  interface Window {
    hibou: HibouApi;
  }
}

export const api: HibouApi = window.hibou;

export interface ErreurAffichable {
  type: TypeErreur;
  message: string;
}

/** Reconstruit l'erreur typée transmise par le processus principal. */
export function lireErreur(e: unknown): ErreurAffichable {
  const brut = e instanceof Error ? e.message : String(e);
  const json = brut.slice(brut.indexOf('{'));
  try {
    const x = JSON.parse(json) as ErreurAffichable;
    if (x && typeof x.message === 'string') return x;
  } catch {
    /* message non structuré */
  }
  return { type: 'inconnue', message: 'Erreur inattendue.' };
}
