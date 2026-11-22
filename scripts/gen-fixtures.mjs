// Génère les fixtures de démo (format brut EcoleDirecte), semaine de référence = lundi 2025-01-06.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const save = (name, obj) => writeFileSync(join(OUT, name), JSON.stringify(obj, null, 2) + '\n');
const env = (data, code = 200) => ({ host: 'HTTP193', code, token: '', message: '', data });

const M = {
  FRANC: ['FRANCAIS', '#e57373', 'Mme LEROY C.'],
  MATHS: ['MATHEMATIQUES', '#64b5f6', 'M. GARNIER P.'],
  HIGEO: ['HISTOIRE-GEOGRAPHIE', '#ffb74d', 'Mme FONTAINE A.'],
  AGL1: ['ANGLAIS LV1', '#ba68c8', 'Mme WALKER J.'],
  ESP2: ['ESPAGNOL LV2', '#f06292', 'M. RUIZ D.'],
  SVT: ['SCIENCES VIE & TERRE', '#81c784', 'M. MOREL T.'],
  'PH-CH': ['PHYSIQUE-CHIMIE', '#4db6ac', 'Mme CARON L.'],
  TECHN: ['TECHNOLOGIE', '#a1887f', 'M. BLANC F.'],
  EPS: ['ED.PHYSIQUE & SPORT.', '#90a4ae', 'M. ROUSSEL B.'],
  ARPLA: ['ARTS PLASTIQUES', '#fff176', 'Mme PERRIN S.'],
  EDMUS: ['EDUCATION MUSICALE', '#9575cd', 'M. DUVAL G.'],
  VIESC: ['VIE DE CLASSE', '#cfd8dc', 'Mme LEROY C.'],
};
const SALLES = { FRANC: 'B12', MATHS: 'B14', HIGEO: 'B10', AGL1: 'C03', ESP2: 'C05', SVT: 'LABO 2', 'PH-CH': 'LABO 1', TECHN: 'TECHNO', EPS: 'GYMNASE', ARPLA: 'ARTS', EDMUS: 'MUSIQUE', VIESC: 'B12' };

// ---------- Emploi du temps (une semaine type) ----------
const semaine = {
  '2025-01-06': [['08:00', 'MATHS'], ['09:00', 'FRANC'], ['10:15', 'AGL1'], ['11:15', 'HIGEO'], ['13:30', 'SVT'], ['14:30', 'EPS', 2]],
  '2025-01-07': [['08:00', 'FRANC'], ['09:00', 'PH-CH'], ['10:15', 'MATHS'], ['11:15', 'ESP2'], ['13:30', 'TECHN'], ['14:30', 'AGL1'], ['15:30', 'VIESC']],
  '2025-01-08': [['08:00', 'HIGEO'], ['09:00', 'MATHS'], ['10:15', 'ARPLA'], ['11:15', 'FRANC']],
  '2025-01-09': [['08:00', 'AGL1'], ['09:00', 'SVT'], ['10:15', 'FRANC'], ['11:15', 'MATHS'], ['13:30', 'EDMUS'], ['14:30', 'ESP2'], ['15:30', 'HIGEO']],
  '2025-01-10': [['08:00', 'PH-CH'], ['09:00', 'MATHS'], ['10:15', 'FRANC'], ['11:15', 'TECHN'], ['13:30', 'EPS', 2]],
};
const addMin = (hhmm, min) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
let id = 51200;
const edt = [];
for (const [date, cours] of Object.entries(semaine)) {
  for (const [debut, code, heures = 1] of cours) {
    const [nom, couleur, prof] = M[code];
    const annule = date === '2025-01-07' && code === 'TECHN';
    const modifie = date === '2025-01-09' && code === 'EDMUS';
    edt.push({
      id: id++, text: nom, matiere: nom, codeMatiere: code,
      typeCours: code === 'VIESC' ? 'VIE DE CLASSE' : 'COURS',
      start_date: `${date} ${debut}`, end_date: `${date} ${addMin(debut, heures * 60 - 5)}`,
      color: couleur, dispensable: false, dispense: 0, prof,
      salle: modifie ? 'AUDITORIUM' : SALLES[code], classe: '4EME B', classeId: 412, classeCode: '4B',
      groupe: '', groupeCode: '', isFlexible: false, groupeId: 0, icone: '',
      isModifie: modifie, contenuDeSeance: false, devoirAFaire: false, isAnnule: annule,
    });
  }
}
// Le fichier contient une semaine type ; le mode démo la recopie sur la semaine demandée.
save('emploidutemps.json', env(edt));

// ---------- Cahier de texte ----------
const devoirs = [
  // [pourLe, code, contrôle, effectué, donnéLe, contenu HTML]
  ['2025-01-07', 'MATHS', false, true, '2025-01-03', '<p>Exercices 12, 13 et 15 page 84 (équations).</p>'],
  ['2025-01-07', 'PH-CH', false, false, '2025-01-03', '<p>Apprendre la leçon sur les <b>atomes et molécules</b>.</p>'],
  ['2025-01-08', 'HIGEO', false, false, '2025-01-06', '<p>Lire les pages 112 à 115 et répondre aux questions 1 à 4.</p>'],
  ['2025-01-09', 'AGL1', true, false, '2025-01-02', '<p><b>Contrôle</b> : irregular verbs (liste 2) + prétérit.</p>'],
  ['2025-01-09', 'FRANC', false, false, '2025-01-06', '<p>Rédaction : <i>raconter un souvenir d\'enfance</i> (20 lignes minimum).</p><ul><li>Utiliser le passé simple</li><li>Relire l\'orthographe</li></ul>'],
  ['2025-01-10', 'MATHS', true, false, '2025-01-03', '<p><b>Contrôle chapitre 5</b> : calcul littéral, développer et factoriser.</p><p>Revoir les fiches et les exercices corrigés.</p>'],
  ['2025-01-13', 'SVT', false, false, '2025-01-06', '<p>Compléter le schéma de la digestion (fiche distribuée).</p>'],
  ['2025-01-14', 'ESP2', false, false, '2025-01-07', '<p>Apprendre le vocabulaire de la famille, page 46.</p>'],
  ['2025-01-16', 'HIGEO', true, false, '2025-01-06', '<p><b>Évaluation</b> : la Révolution française (dates et définitions).</p>'],
  ['2025-01-20', 'PH-CH', true, false, '2025-01-09', '<p><b>Contrôle</b> : la matière et ses transformations.</p>'],
  ['2025-01-23', 'FRANC', true, false, '2025-01-09', '<p><b>Contrôle de lecture</b> : <i>Le Horla</i>, de Maupassant.</p>'],
];
const cdtListe = {};
const cdtJours = {};
let idDevoir = 8800;
for (const [pourLe, code, interro, effectue, donneLe, html] of devoirs) {
  const [nom, , prof] = M[code];
  const idD = idDevoir++;
  (cdtListe[pourLe] ??= []).push({
    matiere: nom, codeMatiere: code, aFaire: true, idDevoir: idD, documentsAFaire: false,
    donneLe, effectue, interrogation: interro, rendreEnLigne: false,
  });
  (cdtJours[pourLe] ??= { date: pourLe, matieres: [] }).matieres.push({
    entityCode: '4B', entityLibelle: '4EME B', entityType: 'C', matiere: nom, codeMatiere: code,
    nomProf: prof, id: idD, interrogation: interro, blogActif: false, nbJourMaxRenduDevoir: 0,
    aFaire: {
      idDevoir: idD, contenu: b64(html), rendreEnLigne: false, donneLe, effectue, ressource: '',
      ressourceDocuments: [],
      documents: code === 'MATHS' && interro ? [{ id: 30551, libelle: 'fiche-revision-ch5.pdf', date: donneLe, taille: 182340, type: 'FICHIER_CDT', signatureDemandee: false, signature: {} }] : [],
      commentaires: [], elementsProg: [], liensManuel: [], documentsRendus: [],
      contenuDeSeance: { contenu: '', documents: [], commentaires: [] },
    },
    contenuDeSeance: { idDevoir: idD, contenu: '', documents: [], commentaires: [], elementsProg: [], liensManuel: [] },
  });
}
save('cahierdetexte.json', env(cdtListe));
save('cahierdetexte-jours.json', cdtJours); // clé = date, valeur = `data` de la route du jour

// ---------- Notes ----------
const N = []; let idNote = 70100;
const note = (date, code, devoir, type, valeur, noteSur = '20', coef = '1', extra = {}) => {
  const v = typeof valeur === 'number' ? String(valeur).replace('.', ',') : valeur;
  const num = typeof valeur === 'number' ? valeur * 20 / Number(noteSur.replace(',', '.')) : null;
  const moy = num == null ? 11.4 : Math.min(19, Math.max(7, num - 1.3));
  N.push({
    id: idNote++, devoir, codePeriode: date < '2024-12-01' ? 'A001' : 'A002', codeMatiere: code,
    libelleMatiere: M[code][0], codeSousMatiere: '', typeDevoir: type, enLettre: false, commentaire: '',
    uncSujet: '', uncCorrige: '', coef, noteSur, valeur: v, nonSignificatif: false,
    date, dateSaisie: date, valeurisee: false,
    moyenneClasse: (moy * Number(noteSur.replace(',', '.')) / 20).toFixed(2).replace('.', ','),
    minClasse: (Number(noteSur.replace(',', '.')) * 0.2).toFixed(2).replace('.', ','),
    maxClasse: noteSur.includes(',') ? noteSur : `${noteSur},00`,
    elementsProgramme: [], ...extra,
  });
};
// 1er trimestre
note('2024-09-20', 'MATHS', 'Nombres relatifs', 'CONTROLE', 14.5, '20', '2');
note('2024-10-04', 'MATHS', 'Interrogation fractions', 'INTERROGATION ECRITE', 8, '10');
note('2024-11-15', 'MATHS', 'Puissances', 'CONTROLE', 12, '20', '2');
note('2024-09-27', 'FRANC', 'Dictée n°1', 'INTERROGATION ECRITE', 13);
note('2024-10-18', 'FRANC', 'Rédaction : portrait', 'DEVOIR SUR TABLE', 15.5, '20', '2');
note('2024-11-22', 'FRANC', 'Grammaire', 'CONTROLE', 'Abs');
note('2024-10-11', 'AGL1', 'Vocabulary test', 'INTERROGATION ECRITE', 17);
note('2024-11-08', 'AGL1', 'Oral presentation', 'INTERROGATION ORALE', 16);
note('2024-10-08', 'HIGEO', "L'Europe des Lumières", 'CONTROLE', 11.5, '20', '2');
note('2024-11-19', 'HIGEO', 'Croquis', 'EXERCICE', 7, '10');
note('2024-10-15', 'SVT', 'Respiration', 'CONTROLE', 15);
note('2024-11-26', 'PH-CH', 'Mélanges', 'CONTROLE', 13.5);
note('2024-10-22', 'ESP2', 'Presentarse', 'INTERROGATION ORALE', 18);
note('2024-11-12', 'TECHN', 'Projet objet connecté', 'TRAVAUX PRATIQUES', 16);
note('2024-11-05', 'EPS', 'Demi-fond', 'EXERCICE', 'Disp');
note('2024-11-28', 'ARPLA', 'Autoportrait', 'EXERCICE', 14);
// 2e trimestre (en cours)
note('2024-12-06', 'MATHS', 'Calcul littéral (1)', 'INTERROGATION ECRITE', 31, '40', '1,5');
note('2024-12-17', 'MATHS', 'Géométrie : Pythagore', 'CONTROLE', 9.5, '20', '2');
note('2025-01-03', 'MATHS', 'Devoir maison n°4', 'DEVOIR MAISON', 18, '20', '0,5');
note('2024-12-10', 'FRANC', 'Lecture cursive', 'CONTROLE', 12);
note('2024-12-19', 'FRANC', 'Dictée n°4', 'INTERROGATION ECRITE', 6.5, '10');
note('2024-12-13', 'AGL1', 'Christmas traditions', 'INTERROGATION ECRITE', 15);
note('2025-01-02', 'AGL1', 'Test de rattrapage', 'INTERROGATION ECRITE', 4, '20', '1', { nonSignificatif: true });
note('2024-12-12', 'HIGEO', 'Révolution industrielle', 'CONTROLE', 13, '20', '2');
note('2024-12-16', 'SVT', 'Digestion', 'INTERROGATION ECRITE', 'NE');
note('2025-01-03', 'PH-CH', 'Atomes', 'INTERROGATION ECRITE', 8.5, '10');
note('2024-12-18', 'ESP2', 'Vocabulario', 'INTERROGATION ECRITE', 16.5);
note('2024-12-11', 'TECHN', 'Algorithmique', 'CONTROLE', 14);

const disciplines = (codes, avecMoyennes) => codes.map((code, i) => ({
  id: 9000 + i, codeMatiere: code, codeSousMatiere: '', discipline: M[code][0],
  moyenne: avecMoyennes ? avecMoyennes[code] ?? '' : '', moyenneClasse: avecMoyennes ? '11,85' : '',
  moyenneMin: avecMoyennes ? '5,20' : '', moyenneMax: avecMoyennes ? '18,40' : '',
  coef: ['MATHS', 'FRANC'].includes(code) ? 3 : code === 'HIGEO' || code === 'AGL1' ? 2 : 1,
  effectif: 27, rang: 0, groupeMatiere: false, idGroupeMatiere: 0, option: 0, sousMatiere: false,
  saisieAppreciationSSMAT: false, professeurs: [{ id: 400 + i, nom: M[code][2] }],
}));
const codes = ['FRANC', 'MATHS', 'HIGEO', 'AGL1', 'ESP2', 'SVT', 'PH-CH', 'TECHN', 'EPS', 'ARPLA', 'EDMUS'];
const periode = (code, nom, annuel, debut, fin, cloture, moyennes, mg) => ({
  idPeriode: code, codePeriode: code, periode: nom, annuel, dateDebut: debut, dateFin: fin,
  examenBlanc: false, cloture,
  ...(annuel ? {} : { dateConseil: fin, heureConseil: '17:30', heureFinConseil: '18:30' }),
  moyNbreJoursApresConseil: 0,
  ensembleMatieres: {
    dateCalcul: moyennes ? `${fin} 18:00` : '', moyenneGenerale: mg ?? '', moyenneClasse: mg ? '12,04' : '',
    moyenneMin: mg ? '6,92' : '', moyenneMax: mg ? '17,31' : '', nomPP: 'Mme LEROY C.', nomCE: '',
    decisionDuConseil: '', disciplines: disciplines(codes, moyennes), disciplinesSimulation: [],
  },
});
// Trimestre 1 clôturé : l'établissement publie les moyennes officielles.
// FRANC volontairement différent du calcul (arrondi/coef interne) pour tester l'avertissement « estimation ».
const moyT1 = { FRANC: '14,90', MATHS: '13,13', HIGEO: '12,50', AGL1: '16,50', ESP2: '18,00', SVT: '15,00', 'PH-CH': '13,50', TECHN: '16,00', EPS: '', ARPLA: '14,00', EDMUS: '' };
// Trimestre en cours et année : EcoleDirecte publie aussi des moyennes « provisoires ».
const coefM = (c) => (['MATHS', 'FRANC'].includes(c) ? 3 : c === 'HIGEO' || c === 'AGL1' ? 2 : 1);
const moyennes = (filtre) => {
  const r = {}; let s = 0, p = 0;
  for (const c of codes) {
    let sn = 0, pn = 0;
    for (const n of N.filter((x) => x.codeMatiere === c && filtre(x) && !x.nonSignificatif)) {
      const v = Number(n.valeur.replace(',', '.')); if (Number.isNaN(v)) continue;
      const k = Number(n.coef.replace(',', '.')); sn += (v / Number(n.noteSur.replace(',', '.'))) * 20 * k; pn += k;
    }
    if (pn) { const m = sn / pn; r[c] = m.toFixed(2).replace('.', ','); s += m * coefM(c); p += coefM(c); } else r[c] = '';
  }
  return [r, p ? (s / p).toFixed(2).replace('.', ',') : ''];
};
const [moyT2, mgT2] = moyennes((n) => n.codePeriode === 'A002');
const [moyAn, mgAn] = moyennes(() => true);
const notes = {
  foStat: 'demo',
  periodes: [
    periode('A001', '1er Trimestre', false, '2024-09-02', '2024-11-29', true, moyT1, '14,72'),
    periode('A002', '2ème Trimestre', false, '2024-12-02', '2025-03-07', false, moyT2, mgT2),
    periode('A003', '3ème Trimestre', false, '2025-03-10', '2025-07-04', false, null, null),
    periode('A999Z', 'Année', true, '2024-09-02', '2025-07-04', false, moyAn, mgAn),
  ],
  notes: N,
  parametrage: {
    couleurEval1: '#FF0000', couleurEval2: '#FFC000', couleurEval3: '#0070C0', couleurEval4: '#00B050',
    affichageMoyenne: true, affichageMoyenneDevoir: true, affichagePositionMatiere: false, affichageNote: true,
    affichageCompetence: false, affichageAppreciation: false, moyenneUniquementPeriodeCloture: false,
    moyennePeriodeReleve: true, moyennePeriodeAnnuelle: true, moyenneEleveDansNotes: true, moyenneEleve: true,
    moyenneEleveDansMoyenne: true, moyenneGenerale: true, moyenneCoefMatiere: true,
    moyenneClasse: true, moyenneMin: true, moyenneMax: true, moyenneRang: false, moyenneSur: 20,
    moyenneGraphique: true, moyennesSimulation: false, coefficientNote: true, colonneCoefficientMatiere: true,
    libelleDevoir: true, dateDevoir: true, typeDevoir: true, noteUniquementPeriodeCloture: false,
  },
};
save('notes.json', env(notes));

// ---------- Connexion (compte famille, deux enfants) ----------
const eleve = (id, prenom, classe, code) => ({
  id, prenom, nom: 'MARTIN', sexe: 'F', infoEDT: '', idEtablissement: '7', nomEtablissement: 'Collège Démo',
  idReelEtab: '7', isPrimaire: false, photo: '', classe: { id: code === '4B' ? 412 : 611, code, libelle: classe, estNote: 1 },
  modules: [{ code: 'EDT', enable: true }, { code: 'CAHIER_DE_TEXTES', enable: true }, { code: 'NOTES', enable: true }],
});
save('login.json', {
  host: 'HTTP193', code: 200, token: '', message: '',
  data: {
    accounts: [{
      idLogin: 120001, id: 5500, uid: '', identifiant: 'demo', typeCompte: '1', codeOgec: '000000000',
      main: true, lastConnexion: '2025-01-05 19:02', civilite: 'Mme', prenom: 'Claire', particule: '',
      nom: 'MARTIN', email: '', anneeScolaireCourante: '2024-2025', nomEtablissement: 'Collège Démo',
      logoEtablissement: '', couleurAgendaEtablissement: '#1796b0', modules: [],
      profile: { eleves: [eleve(3101, 'Léa', '4EME B', '4B'), { ...eleve(3102, 'Hugo', '6EME A', '6A'), sexe: 'M' }] },
    }],
  },
});
console.log('fixtures écrites dans', OUT);
