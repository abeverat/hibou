import { describe, expect, it } from 'vitest';
import { bilanPeriode, evolutionMoyennes, moyenneGenerale, moyenneMatiere, noteSur20 } from './moyennes';
import { parseNombre } from '../ed/parsers';
import type { Note, Periode, Releve } from '../types';

/** Note construite comme le ferait le parseur, à partir des chaînes EcoleDirecte. */
const note = (valeur: string, noteSur = '20', coef = '1', extra: Partial<Note> = {}): Note => ({
  id: Math.random(), devoir: 'D', codePeriode: 'A001', codeMatiere: 'MATHS', matiere: 'Maths', type: '',
  date: '2025-01-01', dateSaisie: '2025-01-01', valeurTexte: valeur, valeur: parseNombre(valeur),
  noteSur: parseNombre(noteSur) ?? 20, coef: parseNombre(coef) ?? 1, nonSignificatif: false, commentaire: '',
  moyenneClasse: null, minClasse: null, maxClasse: null, ...extra,
});

describe('noteSur20', () => {
  it('gère la virgule décimale', () => {
    expect(noteSur20(note('15,5'))).toBe(15.5);
  });
  it('ramène sur 20 les notes sur 10 et sur 40', () => {
    expect(noteSur20(note('7', '10'))).toBe(14);
    expect(noteSur20(note('31', '40'))).toBe(15.5);
    expect(noteSur20(note('6,5', '10'))).toBe(13);
  });
  it('ignore absences, dispenses, non notés et notes non significatives', () => {
    for (const v of ['Abs', 'Disp', 'NE', '']) expect(noteSur20(note(v))).toBeNull();
    expect(noteSur20(note('18', '20', '1', { nonSignificatif: true }))).toBeNull();
  });
});

describe('moyenneMatiere', () => {
  it('pondère par les coefficients, y compris décimaux', () => {
    // (12×2 + 18×0,5) / 2,5 = 13,2
    expect(moyenneMatiere([note('12', '20', '2'), note('18', '20', '0,5')])).toBeCloseTo(13.2, 10);
    // 31/40 → 15,5 coef 1,5 ; 9,5/20 coef 2 → (23,25 + 19) / 3,5
    expect(moyenneMatiere([note('31', '40', '1,5'), note('9,5', '20', '2')])).toBeCloseTo(42.25 / 3.5, 10);
  });
  it('ne compte ni les absences ni les notes non significatives', () => {
    const notes = [note('10'), note('Abs'), note('4', '20', '1', { nonSignificatif: true }), note('16')];
    expect(moyenneMatiere(notes)).toBe(13);
  });
  it('matière sans note → null', () => {
    expect(moyenneMatiere([])).toBeNull();
    expect(moyenneMatiere([note('Abs'), note('Disp')])).toBeNull();
  });
  it('un coefficient nul ne compte pas', () => {
    expect(moyenneMatiere([note('20', '20', '0'), note('10')])).toBe(10);
  });
});

describe('moyenneGenerale', () => {
  it('pondère par le coefficient de matière et ignore les matières sans moyenne', () => {
    expect(moyenneGenerale([{ moyenne: 12, coef: 3 }, { moyenne: 16, coef: 1 }, { moyenne: null, coef: 2 }])).toBe(13);
  });
  it('sans coefficient de matière (tous à 1) : moyenne simple', () => {
    expect(moyenneGenerale([{ moyenne: 10, coef: 1 }, { moyenne: 15, coef: 1 }])).toBe(12.5);
  });
});

describe('bilanPeriode', () => {
  const periode = (moyenne: number | null, generale: number | null): Periode => ({
    code: 'A001', nom: 'T1', annuelle: false, debut: '2024-09-01', fin: '2024-12-01', cloturee: true,
    moyenneGenerale: generale, moyenneGeneraleClasse: null,
    matieres: [
      { code: 'MATHS', nom: 'Maths', coef: 2, professeurs: [], moyenne, moyenneClasse: null, moyenneMin: null, moyenneMax: null },
      { code: 'ARTS', nom: 'Arts', coef: 1, professeurs: [], moyenne: null, moyenneClasse: null, moyenneMin: null, moyenneMax: null },
    ],
  });
  const releve = (p: Periode): Releve => ({
    periodes: [p],
    notes: [note('12'), note('16'), note('9', '20', '1', { codeMatiere: 'SVT', matiere: 'Svt' })],
    affichage: { moyenneEleve: true, moyenneGenerale: true, moyenneClasse: true, moyenneMinMax: true, coefficientNote: true, coefficientMatiere: true },
  });

  it('sans moyenne officielle : affiche la calculée, garde les matières sans note', () => {
    const b = bilanPeriode(releve(periode(null, null)), 'A001')!;
    const maths = b.matieres.find((m) => m.code === 'MATHS')!;
    expect(maths.affichee).toBe(14);
    expect(maths.ecartAvecOfficielle).toBe(false);
    expect(b.matieres.find((m) => m.code === 'ARTS')!.affichee).toBeNull();
    expect(b.matieres.find((m) => m.code === 'SVT')!.affichee).toBe(9); // matière absente du relevé officiel
    // (14×2 + 9×1) / 3
    expect(b.generale.affichee).toBeCloseTo(37 / 3, 10);
  });

  it('avec moyenne officielle différente : affiche l’officielle et signale l’écart', () => {
    const b = bilanPeriode(releve(periode(14.5, 13)), 'A001')!;
    const maths = b.matieres.find((m) => m.code === 'MATHS')!;
    expect(maths.affichee).toBe(14.5);
    expect(maths.calculee).toBe(14);
    expect(maths.ecartAvecOfficielle).toBe(true);
    expect(b.generale.affichee).toBe(13);
  });

  it('simulateur : une note fictive change la moyenne calculée', () => {
    const b = bilanPeriode(releve(periode(14, null)), 'A001', [note('20', '20', '2')])!;
    // (12 + 16 + 20×2) / 4 = 17
    expect(b.matieres.find((m) => m.code === 'MATHS')!.affichee).toBe(17);
  });
});

describe('evolutionMoyennes', () => {
  it('cumule la moyenne de l’élève et celle de la classe note après note', () => {
    const notes = [
      note('12', '20', '1', { date: '2025-01-01', moyenneClasse: 10 }),
      note('8', '10', '1', { date: '2025-01-05', moyenneClasse: 6 }),
      note('Abs', '20', '1', { date: '2025-01-08', moyenneClasse: 11 }),
      note('15', '20', '1', { date: '2025-01-09', codeMatiere: 'SVT', moyenneClasse: null }),
    ];
    const coefs = new Map([['MATHS', 3], ['SVT', 1]]);
    const pts = evolutionMoyennes(notes, coefs);
    expect(pts.map((p) => p.eleve)).toEqual([12, 14, 14, (14 * 3 + 15) / 4]);
    // classe maths : 10 puis (10 + 12)/2 = 11, puis (10 + 12 + 11)/3 = 11 ; SVT sans moyenne de classe
    expect(pts.map((p) => p.classe)).toEqual([10, 11, 11, 11]);
    expect(pts[2]!.noteSur20).toBeNull();
  });
  it('filtre sur une matière', () => {
    const notes = [note('12'), note('15', '20', '1', { codeMatiere: 'SVT' })];
    expect(evolutionMoyennes(notes, new Map(), 'SVT').map((p) => p.eleve)).toEqual([15]);
  });
});
