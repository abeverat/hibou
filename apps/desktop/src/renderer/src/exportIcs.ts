import { dateLocale, evenementsControles, genererIcs, type Eleve } from '@hibou/core';
import { api } from './api';

/** Télécharge un fichier .ics avec tous les contrôles à venir, à l'heure du cours de la matière. */
export async function exporterControles(eleve: Eleve | undefined): Promise<number> {
  const aujourdHui = dateLocale();
  const controles = (await api.devoirs()).filter((d) => d.estControle);
  if (controles.length === 0) return 0;
  const fin = controles.reduce((max, d) => (d.pourLe > max ? d.pourLe : max), aujourdHui);
  const cours = await api.emploiDuTemps(aujourdHui, fin);
  const ics = genererIcs(evenementsControles(controles, cours, eleve?.prenom));
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `controles${eleve ? `-${eleve.prenom.toLowerCase()}` : ''}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return controles.length;
}
