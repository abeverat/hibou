/**
 * Formats bruts de l'API EcoleDirecte (seulement les champs utilisés).
 * Voir docs/ecoledirecte-api.md. Ces types ne doivent pas sortir de `ed/`.
 */

export interface RawReponse<T> {
  host?: string;
  code: number;
  token?: string;
  message?: string;
  data: T;
}

export interface RawEleveFamille {
  id: number;
  prenom: string;
  nom: string;
  nomEtablissement?: string;
  classe?: { libelle?: string };
}

export interface RawCompte {
  idLogin: number;
  id: number;
  typeCompte: string; // "E" = élève, "1" = famille
  /** Jeton de reconnexion (connexion « se souvenir de moi »). Les deux graphies existent selon les sources. */
  accessToken?: string;
  access_token?: string;
  main: boolean;
  prenom: string;
  nom: string;
  nomEtablissement?: string;
  anneeScolaireCourante?: string;
  profile?: {
    classe?: { libelle?: string };
    nomEtablissement?: string;
    eleves?: RawEleveFamille[];
  };
}

export interface RawLogin {
  accounts: RawCompte[];
}

export interface RawQcm {
  question: string; // base64
  propositions: string[]; // base64
}

export interface RawCours {
  id: number;
  text?: string;
  matiere: string;
  codeMatiere: string;
  typeCours: string;
  start_date: string; // "YYYY-MM-DD HH:mm"
  end_date: string;
  color: string;
  prof: string;
  salle: string;
  isAnnule: boolean;
  isModifie?: boolean;
}

export interface RawDevoirListe {
  matiere: string;
  codeMatiere: string;
  idDevoir: number;
  donneLe: string;
  effectue: boolean;
  interrogation: boolean;
  rendreEnLigne?: boolean;
}

export type RawCahierDeTexte = Record<string, RawDevoirListe[]>;

export interface RawDevoirJour {
  matiere: string;
  codeMatiere: string;
  nomProf: string;
  id: number;
  interrogation: boolean;
  aFaire?: {
    idDevoir: number;
    contenu: string; // base64
    rendreEnLigne: boolean;
    donneLe: string;
    effectue: boolean;
    documents?: { id: number; libelle: string; taille: number }[];
  };
}

export interface RawCahierDeTexteJour {
  date: string;
  matieres: RawDevoirJour[];
}

export interface RawDiscipline {
  codeMatiere: string;
  discipline: string;
  moyenne?: string;
  moyenneClasse?: string;
  moyenneMin?: string;
  moyenneMax?: string;
  coef?: number | string;
  groupeMatiere?: boolean;
  sousMatiere?: boolean;
  professeurs?: { nom: string }[];
}

export interface RawPeriode {
  codePeriode: string;
  periode: string;
  annuel: boolean;
  dateDebut: string;
  dateFin: string;
  cloture: boolean;
  ensembleMatieres?: {
    moyenneGenerale?: string;
    moyenneClasse?: string;
    disciplines?: RawDiscipline[];
  };
}

export interface RawNote {
  id: number;
  devoir: string;
  codePeriode: string;
  codeMatiere: string;
  libelleMatiere: string;
  typeDevoir: string;
  commentaire?: string;
  coef: string;
  noteSur: string;
  valeur: string;
  nonSignificatif: boolean;
  date: string;
  dateSaisie?: string;
  moyenneClasse?: string;
  minClasse?: string;
  maxClasse?: string;
}

export interface RawNotes {
  periodes: RawPeriode[];
  notes: RawNote[];
  parametrage?: Record<string, unknown>;
}
