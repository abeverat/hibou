/**
 * Modèle de données interne de Hibou.
 * L'interface ne voit que ces types, jamais le format brut d'EcoleDirecte.
 */

/** Date au format `YYYY-MM-DD`. */
export type DateISO = string;
/** Date et heure locales au format `YYYY-MM-DDTHH:mm`. */
export type DateHeureISO = string;

export interface Eleve {
  id: number;
  prenom: string;
  nom: string;
  classe: string;
  etablissement: string;
}

export interface Compte {
  type: 'eleve' | 'famille';
  prenom: string;
  nom: string;
  /** Un seul élève pour un compte élève, un ou plusieurs enfants pour un compte famille. */
  eleves: Eleve[];
  anneeScolaire: string;
}

export interface Cours {
  id: number;
  debut: DateHeureISO;
  fin: DateHeureISO;
  matiere: string;
  codeMatiere: string;
  salle: string;
  professeur: string;
  annule: boolean;
  modifie: boolean;
  /** `COURS`, `PERMANENCE`, … tel que fourni par EcoleDirecte. */
  type: string;
  couleur: string;
}

export interface Devoir {
  id: number;
  /** Date d'échéance. */
  pourLe: DateISO;
  donneLe: DateISO;
  matiere: string;
  codeMatiere: string;
  estControle: boolean;
  effectue: boolean;
  rendreEnLigne: boolean;
}

export interface DevoirDetail extends Devoir {
  professeur: string;
  /** HTML décodé. À assainir côté interface (DOMPurify) avant affichage. */
  contenuHtml: string;
  documents: { id: number; nom: string; taille: number }[];
}

export interface Note {
  id: number;
  devoir: string;
  codePeriode: string;
  codeMatiere: string;
  matiere: string;
  type: string;
  date: DateISO;
  dateSaisie: DateISO;
  /** Valeur brute affichable (`"15,5"`, `"Abs"`, `"Disp"`…). */
  valeurTexte: string;
  /** Valeur numérique, `null` si la note n'est pas un nombre (absence, dispense…). */
  valeur: number | null;
  noteSur: number;
  coef: number;
  nonSignificatif: boolean;
  commentaire: string;
  /** Statistiques de classe : `null` si absentes ou masquées par l'établissement. */
  moyenneClasse: number | null;
  minClasse: number | null;
  maxClasse: number | null;
}

export interface Matiere {
  code: string;
  nom: string;
  coef: number;
  professeurs: string[];
  /** Moyenne officielle publiée par l'établissement, `null` sinon. */
  moyenne: number | null;
  moyenneClasse: number | null;
  moyenneMin: number | null;
  moyenneMax: number | null;
}

export interface Periode {
  code: string;
  nom: string;
  annuelle: boolean;
  debut: DateISO;
  fin: DateISO;
  cloturee: boolean;
  moyenneGenerale: number | null;
  moyenneGeneraleClasse: number | null;
  matieres: Matiere[];
}

/** Ce que l'établissement autorise à afficher (sous-ensemble de `parametrage`). */
export interface AffichageNotes {
  moyenneEleve: boolean;
  moyenneGenerale: boolean;
  moyenneClasse: boolean;
  moyenneMinMax: boolean;
  coefficientNote: boolean;
  coefficientMatiere: boolean;
}

export interface Releve {
  periodes: Periode[];
  notes: Note[];
  affichage: AffichageNotes;
}
