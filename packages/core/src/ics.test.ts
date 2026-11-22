import { describe, expect, it } from 'vitest';
import { evenementsControles, genererIcs } from './ics';
import type { Cours, Devoir } from './types';

describe('genererIcs', () => {
  const stamp = new Date('2026-11-22T10:00:00Z');

  it('journée entière et événement horaire', () => {
    const ics = genererIcs(
      [
        { uid: 'a@h', titre: 'Contrôle Maths', debut: '2026-11-27' },
        { uid: 'b@h', titre: 'Contrôle Anglais', debut: '2026-11-26T08:00', fin: '2026-11-26T08:55', lieu: 'C03' },
      ],
      stamp,
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:20261127\r\nDTEND;VALUE=DATE:20261128');
    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20261126T080000\r\nDTEND;TZID=Europe/Paris:20261126T085500');
    expect(ics).toContain('DTSTAMP:20261122T100000Z');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('échappe et plie les lignes longues', () => {
    const ics = genererIcs([{ uid: 'c@h', titre: 'A, B; C', debut: '2026-01-01', description: 'é'.repeat(100) }], stamp);
    expect(ics).toContain('SUMMARY:A\\, B\\; C');
    for (const l of ics.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});

it('evenementsControles place le contrôle à l’heure du cours', () => {
  const cours: Cours[] = [{
    id: 1, debut: '2026-11-26T08:00', fin: '2026-11-26T08:55', matiere: 'Anglais', codeMatiere: 'AGL1',
    salle: 'C03', professeur: '', annule: false, modifie: false, type: 'COURS', couleur: '',
  }];
  const ctrl = (id: number, pourLe: string, code: string): Devoir => ({
    id, pourLe, donneLe: '', matiere: code, codeMatiere: code, estControle: true, effectue: false, rendreEnLigne: false,
  });
  const [a, b] = evenementsControles([ctrl(1, '2026-11-26', 'AGL1'), ctrl(2, '2026-12-03', 'HIGEO')], cours, 'Léa');
  expect(a).toMatchObject({ debut: '2026-11-26T08:00', fin: '2026-11-26T08:55', lieu: 'C03', titre: 'Contrôle AGL1 (Léa)' });
  expect(b).toMatchObject({ debut: '2026-12-03', fin: undefined });
});
