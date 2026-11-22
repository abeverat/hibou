import { describe, expect, it } from 'vitest';
import { cleMatiere, placerDevoirs } from './calendrier';
import type { Cours, Devoir } from './types';

const cours = (id: number, debut: string, codeMatiere: string, matiere: string, annule = false): Cours => ({
  id, debut, fin: debut, matiere, codeMatiere, salle: '', professeur: '', annule, modifie: false, type: 'COURS', couleur: '#000',
});
const devoir = (id: number, pourLe: string, codeMatiere: string, matiere: string, estControle = false): Devoir => ({
  id, pourLe, donneLe: '2025-01-01', matiere, codeMatiere, estControle, effectue: false, rendreEnLigne: false,
});

describe('placerDevoirs', () => {
  const edt = [
    cours(1, '2025-01-07T10:15', 'MATHS', 'Mathematiques'),
    cours(2, '2025-01-07T08:00', 'FRANC', 'Francais'),
    cours(3, '2025-01-07T14:30', 'MATHS', 'Mathematiques'),
    cours(4, '2025-01-08T08:00', 'AGL1', 'Anglais Lv1', true),
    cours(5, '2025-01-08T11:00', 'AGL1', 'Anglais Lv1'),
    cours(6, '2025-01-09T09:00', 'HG', 'Histoire-Géographie'),
  ];

  it('place sur le premier cours de la matière le jour de l’échéance', () => {
    const p = placerDevoirs(edt, [devoir(10, '2025-01-07', 'MATHS', 'Mathematiques')]);
    expect(p.parCours.get(1)?.map((d) => d.id)).toEqual([10]);
    expect(p.parCours.has(3)).toBe(false);
  });

  it('évite un cours annulé s’il y en a un autre', () => {
    const p = placerDevoirs(edt, [devoir(11, '2025-01-08', 'AGL1', 'Anglais Lv1')]);
    expect(p.parCours.get(5)?.map((d) => d.id)).toEqual([11]);
  });

  it('se rabat sur le nom de matière si les codes diffèrent', () => {
    const p = placerDevoirs(edt, [devoir(12, '2025-01-09', 'HIGEO', 'HISTOIRE-GEOGRAPHIE')]);
    expect(p.parCours.get(6)?.map((d) => d.id)).toEqual([12]);
  });

  it('garde à part les devoirs sans cours ce jour-là', () => {
    const p = placerDevoirs(edt, [devoir(13, '2025-01-07', 'SVT', 'Svt'), devoir(14, '2025-01-12', 'MATHS', 'Maths')]);
    expect(p.sansCreneau.get('2025-01-07')?.map((d) => d.id)).toEqual([13]);
    expect(p.sansCreneau.get('2025-01-12')?.map((d) => d.id)).toEqual([14]);
  });

  it('met les contrôles en premier', () => {
    const p = placerDevoirs(edt, [devoir(15, '2025-01-07', 'MATHS', 'M'), devoir(16, '2025-01-07', 'MATHS', 'M', true)]);
    expect(p.parCours.get(1)?.map((d) => d.id)).toEqual([16, 15]);
  });
});

it('cleMatiere ignore accents et ponctuation', () => {
  expect(cleMatiere('Histoire-Géographie')).toBe(cleMatiere('HISTOIRE GEOGRAPHIE'));
});
