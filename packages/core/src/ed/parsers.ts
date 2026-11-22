/** Conversion des réponses brutes EcoleDirecte vers le modèle interne. */
import type {
  AffichageNotes, Compte, Cours, Devoir, DevoirDetail, Eleve, Matiere, Note, Periode, Releve,
} from '../types';
import type {
  RawCahierDeTexte, RawCahierDeTexteJour, RawCours, RawLogin, RawNotes, RawQcm,
} from './raw';
import { ErreurEd } from './erreurs';

/** `"15,5"` → 15.5 ; `"Abs"`, `"Disp"`, `"NE"`, `""` → null. */
export function parseNombre(valeur: unknown): number | null {
  if (typeof valeur === 'number') return Number.isFinite(valeur) ? valeur : null;
  if (typeof valeur !== 'string') return null;
  const s = valeur.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return Number(s);
}

/** Décode une chaîne base64 contenant de l'UTF-8 (navigateur et Node). */
export function decodeBase64(b64: string): string {
  if (!b64) return '';
  const binaire = atob(b64);
  const octets = Uint8Array.from(binaire, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(octets);
}

export function encodeBase64(texte: string): string {
  const octets = new TextEncoder().encode(texte);
  return btoa(String.fromCharCode(...octets));
}

/** `"2025-01-06 08:00"` → `"2025-01-06T08:00"`. */
const dateHeure = (s: string) => s.trim().replace(' ', 'T').slice(0, 16);

/** EcoleDirecte écrit les matières en majuscules sans accents : on rétablit les plus courants. */
const MOTS: Record<string, string> = {
  mathematiques: 'Mathématiques', francais: 'Français', geographie: 'Géographie', education: 'Éducation',
  ed: 'Éd', economiques: 'Économiques', numerique: 'Numérique', specialite: 'Spécialité', theatre: 'Théâtre',
  litterature: 'Littérature', litteraire: 'Littéraire', etranger: 'Étranger', etrangere: 'Étrangère',
  langues: 'Langues', medias: 'Médias', ethique: 'Éthique', vie: 'Vie', sante: 'Santé', societe: 'Société',
  lv1: 'LV1', lv2: 'LV2', lv3: 'LV3', eps: 'EPS', svt: 'SVT', ses: 'SES', nsi: 'NSI', snt: 'SNT', emc: 'EMC',
  hggsp: 'HGGSP', hlp: 'HLP', llcer: 'LLCER', si: 'SI', ap: 'AP',
};

/** `"HISTOIRE-GEOGRAPHIE"` → `"Histoire-Géographie"`, `"ANGLAIS LV1"` → `"Anglais LV1"`. */
export function libelle(s: string): string {
  return s
    .toLocaleLowerCase('fr-FR')
    .replace(/\p{L}[\p{L}\d]*/gu, (mot, pos: number, tout: string) => {
      if (MOTS[mot]) return MOTS[mot]!;
      const petit = ['de', 'du', 'des', 'et', 'la', 'le', 'les', 'en', 'a'].includes(mot) && pos > 0 && tout[pos - 1] === ' ';
      return petit ? mot : mot[0]!.toLocaleUpperCase('fr-FR') + mot.slice(1);
    });
}

// ---------- Compte ----------

export function parseCompte(raw: RawLogin): Compte {
  const compte = raw.accounts.find((a) => a.main) ?? raw.accounts[0];
  if (!compte) throw new ErreurEd('inconnue', 'Aucun compte dans la réponse de connexion.');
  const etab = compte.nomEtablissement ?? compte.profile?.nomEtablissement ?? '';
  let eleves: Eleve[];
  if (compte.typeCompte === 'E') {
    eleves = [{
      id: compte.id, prenom: compte.prenom, nom: compte.nom,
      classe: compte.profile?.classe?.libelle ?? '', etablissement: etab,
    }];
  } else if (compte.typeCompte === '1') {
    eleves = (compte.profile?.eleves ?? []).map((e) => ({
      id: e.id, prenom: e.prenom, nom: e.nom,
      classe: e.classe?.libelle ?? '', etablissement: e.nomEtablissement ?? etab,
    }));
  } else {
    throw new ErreurEd('inconnue', `Type de compte non pris en charge (${compte.typeCompte}). Hibou gère les comptes élève et famille.`);
  }
  return {
    type: compte.typeCompte === 'E' ? 'eleve' : 'famille',
    prenom: compte.prenom, nom: compte.nom, eleves,
    anneeScolaire: compte.anneeScolaireCourante ?? '',
  };
}

export function parseQcm(raw: RawQcm): { question: string; propositions: { texte: string; valeur: string }[] } {
  return {
    question: decodeBase64(raw.question),
    propositions: raw.propositions.map((p) => ({ texte: decodeBase64(p), valeur: p })),
  };
}

// ---------- Emploi du temps ----------

export function parseCours(raw: RawCours[]): Cours[] {
  return raw
    .map((c) => ({
      id: c.id,
      debut: dateHeure(c.start_date),
      fin: dateHeure(c.end_date),
      matiere: libelle(c.matiere || c.text || ''),
      codeMatiere: c.codeMatiere,
      salle: c.salle ?? '',
      professeur: c.prof ?? '',
      annule: Boolean(c.isAnnule),
      modifie: Boolean(c.isModifie),
      type: c.typeCours ?? '',
      couleur: c.color || '#90a4ae',
    }))
    .sort((a, b) => a.debut.localeCompare(b.debut));
}

// ---------- Cahier de texte ----------

export function parseDevoirs(raw: RawCahierDeTexte): Devoir[] {
  return Object.entries(raw)
    .flatMap(([pourLe, liste]) =>
      liste.map((d) => ({
        id: d.idDevoir,
        pourLe,
        donneLe: d.donneLe,
        matiere: libelle(d.matiere),
        codeMatiere: d.codeMatiere,
        estControle: Boolean(d.interrogation),
        effectue: Boolean(d.effectue),
        rendreEnLigne: Boolean(d.rendreEnLigne),
      })),
    )
    .sort((a, b) => a.pourLe.localeCompare(b.pourLe) || a.matiere.localeCompare(b.matiere));
}

export function parseDevoirsJour(raw: RawCahierDeTexteJour): DevoirDetail[] {
  return raw.matieres
    .filter((m) => m.aFaire)
    .map((m) => ({
      id: m.aFaire!.idDevoir,
      pourLe: raw.date,
      donneLe: m.aFaire!.donneLe,
      matiere: libelle(m.matiere),
      codeMatiere: m.codeMatiere,
      estControle: Boolean(m.interrogation),
      effectue: Boolean(m.aFaire!.effectue),
      rendreEnLigne: Boolean(m.aFaire!.rendreEnLigne),
      professeur: m.nomProf ?? '',
      // HTML non assaini : l'interface DOIT le passer dans DOMPurify avant affichage.
      contenuHtml: decodeBase64(m.aFaire!.contenu),
      documents: (m.aFaire!.documents ?? []).map((d) => ({ id: d.id, nom: d.libelle, taille: d.taille })),
    }));
}

// ---------- Notes ----------

const vrai = (p: Record<string, unknown> | undefined, cle: string, defaut = true) =>
  p && cle in p ? Boolean(p[cle]) : defaut;

export function parseAffichage(p: Record<string, unknown> | undefined): AffichageNotes {
  return {
    moyenneEleve: vrai(p, 'moyenneEleve'),
    moyenneGenerale: vrai(p, 'moyenneGenerale'),
    moyenneClasse: vrai(p, 'moyenneClasse'),
    moyenneMinMax: vrai(p, 'moyenneMin') && vrai(p, 'moyenneMax'),
    coefficientNote: vrai(p, 'coefficientNote'),
    coefficientMatiere: vrai(p, 'colonneCoefficientMatiere'),
  };
}

export function parseReleve(raw: RawNotes): Releve {
  const affichage = parseAffichage(raw.parametrage);
  // Respect de `parametrage` : ce que l'établissement masque est retiré ici,
  // pour que l'interface ne puisse pas l'afficher par erreur.
  const siClasse = (v: unknown) => (affichage.moyenneClasse ? parseNombre(v) : null);
  const siMinMax = (v: unknown) => (affichage.moyenneMinMax ? parseNombre(v) : null);
  const siEleve = (v: unknown) => (affichage.moyenneEleve ? parseNombre(v) : null);

  const periodes: Periode[] = raw.periodes.map((p) => {
    const em = p.ensembleMatieres;
    const matieres: Matiere[] = (em?.disciplines ?? [])
      .filter((d) => !d.groupeMatiere && !d.sousMatiere)
      .map((d) => ({
        code: d.codeMatiere,
        nom: libelle(d.discipline),
        coef: parseNombre(d.coef) ?? 1,
        professeurs: (d.professeurs ?? []).map((x) => x.nom),
        moyenne: siEleve(d.moyenne),
        moyenneClasse: siClasse(d.moyenneClasse),
        moyenneMin: siMinMax(d.moyenneMin),
        moyenneMax: siMinMax(d.moyenneMax),
      }));
    return {
      code: p.codePeriode,
      nom: p.periode,
      annuelle: Boolean(p.annuel),
      debut: p.dateDebut,
      fin: p.dateFin,
      cloturee: Boolean(p.cloture),
      moyenneGenerale: affichage.moyenneGenerale ? siEleve(em?.moyenneGenerale) : null,
      moyenneGeneraleClasse: affichage.moyenneGenerale ? siClasse(em?.moyenneClasse) : null,
      matieres,
    };
  });

  const notes: Note[] = raw.notes
    .map((n) => ({
      id: n.id,
      devoir: n.devoir,
      codePeriode: n.codePeriode,
      codeMatiere: n.codeMatiere,
      matiere: libelle(n.libelleMatiere),
      type: n.typeDevoir ?? '',
      date: n.date,
      dateSaisie: n.dateSaisie || n.date,
      valeurTexte: (n.valeur ?? '').trim(),
      valeur: parseNombre(n.valeur),
      noteSur: parseNombre(n.noteSur) ?? 20,
      coef: parseNombre(n.coef) ?? 1,
      nonSignificatif: Boolean(n.nonSignificatif),
      commentaire: n.commentaire ?? '',
      moyenneClasse: siClasse(n.moyenneClasse),
      minClasse: siMinMax(n.minClasse),
      maxClasse: siMinMax(n.maxClasse),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { periodes, notes, affichage };
}
