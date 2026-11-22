import { useEffect, useState } from 'react';
import { ajouterJours, jourSemaine, lundiDeLaSemaine } from '@hibou/core';
import { lireErreur } from './api';

export const minutes = (dt: string) => Number(dt.slice(11, 13)) * 60 + Number(dt.slice(14, 16));
export const heure = (dt: string) => dt.slice(11, 16).replace(':', 'h');
export const fmt = (d: string, o: Intl.DateTimeFormatOptions) =>
  new Date(`${d.slice(0, 10)}T12:00`).toLocaleDateString('fr-FR', o);

/** 13.8 → « 13,80 » ; null → « — ». */
export const moy = (x: number | null | undefined, decimales = 2) =>
  x == null ? '—' : x.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
export const nombre = (x: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/** Pendant le week-end, on montre directement la semaine qui vient. */
export function lundiParDefaut(aujourdHui: string) {
  const lundi = lundiDeLaSemaine(aujourdHui);
  return jourSemaine(aujourdHui) >= 6 ? ajouterJours(lundi, 7) : lundi;
}

export function dansNJours(n: number) {
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'demain';
  if (n === 2) return 'après-demain';
  return `dans ${n} jours`;
}

/** Charge des données ; relance quand `deps` change. */
export function useCharge<T>(charger: () => Promise<T>, deps: unknown[]) {
  const [etat, setEtat] = useState<{ donnees: T | null; erreur: string }>({ donnees: null, erreur: '' });
  useEffect(() => {
    let annule = false;
    setEtat({ donnees: null, erreur: '' });
    charger()
      .then((donnees) => !annule && setEtat({ donnees, erreur: '' }))
      .catch((e) => !annule && setEtat({ donnees: null, erreur: lireErreur(e).message }));
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [etat, setEtat] as const;
}
