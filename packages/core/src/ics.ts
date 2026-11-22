/** Export des contrôles au format iCalendar (RFC 5545), pour Google Agenda / calendrier du téléphone. */
import { ajouterJours } from './dates';
import type { Cours, Devoir } from './types';
import { placerDevoirs } from './calendrier';

export interface EvenementIcs {
  uid: string;
  titre: string;
  description?: string;
  lieu?: string;
  /** `YYYY-MM-DD` (journée entière) ou `YYYY-MM-DDTHH:mm` (heure locale de Paris). */
  debut: string;
  fin?: string;
}

const echapper = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Plie les lignes à 75 octets (RFC 5545 §3.1) sans couper un caractère UTF-8. */
function plier(ligne: string): string {
  const morceaux: string[] = [];
  let courant = '';
  let octets = 0;
  for (const car of ligne) {
    const n = new TextEncoder().encode(car).length;
    if (octets + n > (morceaux.length === 0 ? 75 : 74)) {
      morceaux.push(courant);
      courant = '';
      octets = 0;
    }
    courant += car;
    octets += n;
  }
  morceaux.push(courant);
  return morceaux.join('\r\n ');
}

const dateIcs = (iso: string) => iso.slice(0, 10).replace(/-/g, '');
const dateHeureIcs = (iso: string) => `${dateIcs(iso)}T${iso.slice(11, 13)}${iso.slice(14, 16)}00`;

export function genererIcs(evenements: EvenementIcs[], horodatage: Date = new Date()): string {
  const stamp = horodatage.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hibou//Controles EcoleDirecte//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Contrôles',
  ];
  for (const e of evenements) {
    lignes.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`);
    if (e.debut.length > 10) {
      lignes.push(`DTSTART;TZID=Europe/Paris:${dateHeureIcs(e.debut)}`);
      lignes.push(`DTEND;TZID=Europe/Paris:${dateHeureIcs(e.fin ?? e.debut)}`);
    } else {
      lignes.push(`DTSTART;VALUE=DATE:${dateIcs(e.debut)}`);
      lignes.push(`DTEND;VALUE=DATE:${dateIcs(ajouterJours(e.debut, 1))}`);
    }
    lignes.push(`SUMMARY:${echapper(e.titre)}`);
    if (e.lieu) lignes.push(`LOCATION:${echapper(e.lieu)}`);
    if (e.description) lignes.push(`DESCRIPTION:${echapper(e.description)}`);
    lignes.push('END:VEVENT');
  }
  lignes.push('END:VCALENDAR');
  return lignes.map(plier).join('\r\n') + '\r\n';
}

/** Contrôles → événements, à l'heure du cours de la matière quand l'emploi du temps la donne. */
export function evenementsControles(controles: Devoir[], cours: Cours[], prenom = ''): EvenementIcs[] {
  const { parCours } = placerDevoirs(cours, controles);
  const coursDe = new Map<number, Cours>();
  for (const c of cours) for (const d of parCours.get(c.id) ?? []) coursDe.set(d.id, c);
  return controles.map((d) => {
    const c = coursDe.get(d.id);
    return {
      uid: `controle-${d.id}@hibou`,
      titre: `Contrôle ${d.matiere}${prenom ? ` (${prenom})` : ''}`,
      debut: c ? c.debut : d.pourLe,
      fin: c?.fin,
      lieu: c?.salle || undefined,
      description: 'Exporté depuis Hibou (EcoleDirecte).',
    };
  });
}
