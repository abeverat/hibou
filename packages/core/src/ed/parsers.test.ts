import { describe, expect, it } from 'vitest';
import { decodeBase64, encodeBase64, libelle, parseAffichage, parseCompte, parseNombre, parseReleve } from './parsers';
import { DemoBackend, decalerDates } from './demo';
import { HibouService } from '../service';
import type { RawNotes } from './raw';

describe('parseNombre', () => {
  it('lit la virgule décimale', () => {
    expect(parseNombre('15,5')).toBe(15.5);
    expect(parseNombre(' 8 ')).toBe(8);
    expect(parseNombre('0,5')).toBe(0.5);
    expect(parseNombre(3)).toBe(3);
  });
  it('renvoie null pour les valeurs non numériques', () => {
    for (const v of ['Abs', 'Disp', 'NE', '', '  ', 'abs.', undefined, null]) expect(parseNombre(v)).toBeNull();
  });
});

describe('base64', () => {
  it('décode l’UTF-8 (accents)', () => {
    expect(decodeBase64(encodeBase64('Quel est votre mois de naissance ? Février'))).toBe(
      'Quel est votre mois de naissance ? Février',
    );
    expect(decodeBase64('RMOpcGFzc8Opcw==')).toBe('Dépassés'); // exemple de la doc communautaire
  });
});

describe('libelle', () => {
  it('met en forme les noms de matière', () => {
    expect(libelle('SCIENCES VIE & TERRE')).toBe('Sciences Vie & Terre');
    expect(libelle('HISTOIRE-GEOGRAPHIE')).toBe('Histoire-Géographie');
    expect(libelle('ED.PHYSIQUE & SPORT.')).toBe('Éd.Physique & Sport.');
    expect(libelle('ANGLAIS LV1')).toBe('Anglais LV1');
    expect(libelle('SCIENCES DE LA VIE ET DE LA TERRE')).toBe('Sciences de la Vie et de la Terre');
  });
});

describe('parseCompte', () => {
  it('compte élève : un seul élève', () => {
    const c = parseCompte({
      accounts: [{
        idLogin: 1, id: 42, typeCompte: 'E', main: true, prenom: 'Léa', nom: 'MARTIN',
        nomEtablissement: 'Collège', profile: { classe: { libelle: '4EME B' } },
      }],
    });
    expect(c.type).toBe('eleve');
    expect(c.eleves).toEqual([{ id: 42, prenom: 'Léa', nom: 'MARTIN', classe: '4EME B', etablissement: 'Collège' }]);
  });
});

describe('parseReleve et parametrage', () => {
  const raw: RawNotes = {
    periodes: [],
    notes: [{
      id: 1, devoir: 'D', codePeriode: 'A001', codeMatiere: 'M', libelleMatiere: 'MATHS', typeDevoir: 'CONTROLE',
      coef: '1', noteSur: '20', valeur: '12,5', nonSignificatif: false, date: '2025-01-01',
      moyenneClasse: '11,00', minClasse: '3,00', maxClasse: '19,00',
    }],
    parametrage: { moyenneClasse: false, moyenneMin: true, moyenneMax: true },
  };
  it('masque la moyenne de classe si l’établissement la cache', () => {
    const r = parseReleve(raw);
    expect(r.notes[0]!.valeur).toBe(12.5);
    expect(r.notes[0]!.moyenneClasse).toBeNull();
    expect(r.notes[0]!.minClasse).toBe(3);
  });
  it('par défaut, tout est visible', () => {
    expect(parseAffichage(undefined).moyenneClasse).toBe(true);
  });
});

describe('mode démo', () => {
  const mercredi = () => new Date(2026, 10, 25, 10, 0); // mercredi 25/11/2026
  const service = () => new HibouService(new DemoBackend({ maintenant: mercredi, latence: 0 }));

  it('recale les dates, clés comprises', () => {
    expect(decalerDates({ '2025-01-06': ['2025-01-06 08:00'] }, 7)).toEqual({ '2025-01-13': ['2025-01-13 08:00'] });
  });

  it('connexion famille puis données de l’enfant choisi', async () => {
    const s = service();
    const r = await s.connexion('demo', 'x');
    expect(r.etat).toBe('connecte');
    if (r.etat !== 'connecte') return;
    expect(r.compte.type).toBe('famille');
    expect(r.compte.eleves.map((e) => e.prenom)).toEqual(['Léa', 'Hugo']);

    const edt = await s.emploiDuTemps('2026-11-23', '2026-11-29');
    expect(edt.length).toBeGreaterThan(20);
    expect(edt.every((c) => c.debut >= '2026-11-23' && c.debut < '2026-11-28')).toBe(true);
    expect(edt.some((c) => c.annule)).toBe(true);

    const devoirs = await s.devoirs();
    expect(devoirs.every((d) => d.pourLe >= '2026-11-25')).toBe(true);
    expect(devoirs.some((d) => d.estControle)).toBe(true);

    const releve = await s.releve();
    expect(releve.notes.length).toBeGreaterThan(20);
    expect(releve.notes.every((n) => n.date < '2026-11-23')).toBe(true);
    expect(releve.notes.some((n) => n.valeurTexte === 'Abs' && n.valeur === null)).toBe(true);
  });

  it('détail d’un jour et case « fait »', async () => {
    const s = service();
    await s.connexion('demo', 'x');
    const [premier] = await s.devoirs();
    const detail = await s.devoirsDuJour(premier!.pourLe);
    expect(detail.length).toBeGreaterThan(0);
    expect(detail[0]!.contenuHtml).toContain('<p>');

    await s.marquerDevoir(premier!.id, !premier!.effectue);
    const apres = await s.devoirs();
    expect(apres.find((d) => d.id === premier!.id)!.effectue).toBe(!premier!.effectue);
  });

  it('QCM : mauvaise réponse puis bonne réponse', async () => {
    const s = service();
    const q = await s.connexion('qcm', 'x');
    expect(q.etat).toBe('qcm');
    if (q.etat !== 'qcm') return;
    expect(q.question).toContain('mois de naissance');
    const faux = q.propositions.find((p) => p.texte === 'Janvier')!;
    expect((await s.repondreQcm(faux.valeur)).etat).toBe('qcm');
    const bon = q.propositions.find((p) => p.texte === 'Avril')!;
    expect((await s.repondreQcm(bon.valeur)).etat).toBe('connecte');
  });

  it('mauvais mot de passe → erreur identifiants', async () => {
    await expect(service().connexion('demo', 'faux')).rejects.toMatchObject({ type: 'identifiants' });
  });
});
