/**
 * Place les devoirs et contrôles sur les cours de l'emploi du temps : un devoir pour le jour J
 * va sur le cours de la même matière ce jour-là (le premier cours non annulé s'il y en a plusieurs).
 */
import type { Cours, Devoir } from './types';

export interface Placement {
  /** Devoirs rattachés à un cours, par identifiant de cours. */
  parCours: Map<number, Devoir[]>;
  /** Devoirs dont la matière n'a pas de cours ce jour-là, par date. */
  sansCreneau: Map<string, Devoir[]>;
}

/** Nom de matière comparable : sans accents, sans ponctuation, en majuscules. */
export function cleMatiere(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

const memeMatiere = (c: Cours, d: Devoir) =>
  (c.codeMatiere !== '' && c.codeMatiere === d.codeMatiere) || cleMatiere(c.matiere) === cleMatiere(d.matiere);

export function placerDevoirs(cours: Cours[], devoirs: Devoir[]): Placement {
  const parCours = new Map<number, Devoir[]>();
  const sansCreneau = new Map<string, Devoir[]>();
  const coursParJour = new Map<string, Cours[]>();
  for (const c of cours) {
    const jour = c.debut.slice(0, 10);
    coursParJour.set(jour, [...(coursParJour.get(jour) ?? []), c]);
  }
  for (const liste of coursParJour.values()) liste.sort((a, b) => a.debut.localeCompare(b.debut));

  for (const d of devoirs) {
    const candidats = (coursParJour.get(d.pourLe) ?? []).filter((c) => memeMatiere(c, d));
    const cible = candidats.find((c) => !c.annule) ?? candidats[0];
    if (cible) parCours.set(cible.id, [...(parCours.get(cible.id) ?? []), d]);
    else sansCreneau.set(d.pourLe, [...(sansCreneau.get(d.pourLe) ?? []), d]);
  }
  // Les contrôles d'abord dans chaque case.
  const trier = (l: Devoir[]) => l.sort((a, b) => Number(b.estControle) - Number(a.estControle));
  parCours.forEach(trier);
  sansCreneau.forEach(trier);
  return { parCours, sansCreneau };
}
