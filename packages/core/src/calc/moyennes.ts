/**
 * Calcul des moyennes (module pur).
 * - chaque note est ramenée sur 20 : valeur / noteSur × 20 ;
 * - moyenne de matière pondérée par le coefficient de chaque note ;
 * - notes non numériques (Abs, Disp, NE…) et non significatives ignorées ;
 * - moyenne générale = moyenne des moyennes de matières, pondérée par le coefficient de matière.
 * Quand EcoleDirecte publie une moyenne officielle, c'est elle qu'on affiche ; la nôtre devient
 * une « estimation » si elles diffèrent.
 */
import type { Matiere, Note, Periode, Releve } from '../types';

/** Note ramenée sur 20, `null` si elle ne compte pas. */
export function noteSur20(n: Pick<Note, 'valeur' | 'noteSur' | 'nonSignificatif'>): number | null {
  if (n.valeur == null || n.nonSignificatif || !(n.noteSur > 0)) return null;
  return (n.valeur / n.noteSur) * 20;
}

export function moyennePonderee(elements: { valeur: number | null; coef: number }[]): number | null {
  let somme = 0;
  let poids = 0;
  for (const { valeur, coef } of elements) {
    if (valeur == null || !(coef > 0)) continue;
    somme += valeur * coef;
    poids += coef;
  }
  return poids > 0 ? somme / poids : null;
}

export function moyenneMatiere(notes: Pick<Note, 'valeur' | 'noteSur' | 'nonSignificatif' | 'coef'>[]): number | null {
  return moyennePonderee(notes.map((n) => ({ valeur: noteSur20(n), coef: n.coef })));
}

export function moyenneGenerale(matieres: { moyenne: number | null; coef: number }[]): number | null {
  return moyennePonderee(matieres.map((m) => ({ valeur: m.moyenne, coef: m.coef })));
}

/** Arrondi d'affichage (2 décimales) : deux moyennes « diffèrent » si leurs arrondis diffèrent. */
export const arrondi = (x: number) => Math.round(x * 100) / 100;
const differe = (calculee: number | null, officielle: number | null) =>
  calculee != null && officielle != null && arrondi(calculee) !== arrondi(officielle);

export interface MoyenneMatiere {
  code: string;
  nom: string;
  coef: number;
  professeurs: string[];
  notes: Note[];
  calculee: number | null;
  officielle: number | null;
  /** Moyenne à afficher : l'officielle si elle existe, sinon la calculée. */
  affichee: number | null;
  /** true si la moyenne affichée est la nôtre et que l'officielle existe mais diffère. */
  ecartAvecOfficielle: boolean;
  moyenneClasse: number | null;
  moyenneMin: number | null;
  moyenneMax: number | null;
}

export interface BilanPeriode {
  periode: Periode;
  matieres: MoyenneMatiere[];
  generale: {
    calculee: number | null;
    officielle: number | null;
    affichee: number | null;
    ecartAvecOfficielle: boolean;
    classe: number | null;
  };
}

/** Notes d'une période ; la période annuelle regroupe toutes les notes. */
export function notesDePeriode(releve: Releve, periode: Periode): Note[] {
  return periode.annuelle ? releve.notes : releve.notes.filter((n) => n.codePeriode === periode.code);
}

/**
 * Bilan d'une période. `notesFictives` (simulateur) s'ajoutent aux notes réelles : dans ce cas
 * on affiche la moyenne calculée, puisque l'officielle ne les connaît pas.
 */
export function bilanPeriode(releve: Releve, codePeriode: string, notesFictives: Note[] = []): BilanPeriode | null {
  const periode = releve.periodes.find((p) => p.code === codePeriode);
  if (!periode) return null;
  const notes = [...notesDePeriode(releve, periode), ...notesFictives];
  const simulation = notesFictives.length > 0;

  const infos = new Map<string, Matiere>(periode.matieres.map((m) => [m.code, m]));
  const codes = [...periode.matieres.map((m) => m.code)];
  for (const n of notes) if (!infos.has(n.codeMatiere) && !codes.includes(n.codeMatiere)) codes.push(n.codeMatiere);

  const matieres: MoyenneMatiere[] = codes.map((code) => {
    const info = infos.get(code);
    const notesMatiere = notes.filter((n) => n.codeMatiere === code).sort((a, b) => a.date.localeCompare(b.date));
    const calculee = moyenneMatiere(notesMatiere);
    const officielle = simulation ? null : info?.moyenne ?? null;
    return {
      code,
      nom: info?.nom ?? notesMatiere[0]?.matiere ?? code,
      coef: info?.coef ?? 1,
      professeurs: info?.professeurs ?? [],
      notes: notesMatiere,
      calculee,
      officielle,
      affichee: officielle ?? calculee,
      ecartAvecOfficielle: differe(calculee, info?.moyenne ?? null) && !simulation,
      moyenneClasse: info?.moyenneClasse ?? null,
      moyenneMin: info?.moyenneMin ?? null,
      moyenneMax: info?.moyenneMax ?? null,
    };
  });

  const calculee = moyenneGenerale(matieres.map((m) => ({ moyenne: m.affichee, coef: m.coef })));
  const officielle = simulation ? null : periode.moyenneGenerale;
  return {
    periode,
    matieres,
    generale: {
      calculee,
      officielle,
      affichee: officielle ?? calculee,
      ecartAvecOfficielle: !simulation && differe(calculee, periode.moyenneGenerale),
      classe: periode.moyenneGeneraleClasse,
    },
  };
}
