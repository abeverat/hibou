/** Accès typé aux données EcoleDirecte : routes + conversion vers le modèle interne. */
import type { Compte, Cours, DateISO, Devoir, DevoirDetail, Releve } from '../types';
import type { EdBackend, EtapeConnexion } from './backend';
import type { RawCahierDeTexte, RawCahierDeTexteJour, RawCours, RawNotes } from './raw';
import {
  parseCompte, parseCours, parseDevoirs, parseDevoirsJour, parseQcm, parseReleve,
} from './parsers';

export type ResultatConnexion =
  | { etat: 'connecte'; compte: Compte }
  | { etat: 'qcm'; question: string; propositions: { texte: string; valeur: string }[] };

const versResultat = (e: EtapeConnexion): ResultatConnexion =>
  e.etat === 'connecte'
    ? { etat: 'connecte', compte: parseCompte(e.login) }
    : { etat: 'qcm', ...parseQcm(e.qcm) };

export class EdClient {
  constructor(private readonly backend: EdBackend) {}

  get demo() {
    return this.backend.demo;
  }

  async connexion(identifiant: string, motdepasse: string): Promise<ResultatConnexion> {
    return versResultat(await this.backend.connexion(identifiant, motdepasse));
  }

  async repondreQcm(choix: string): Promise<ResultatConnexion> {
    return versResultat(await this.backend.repondreQcm(choix));
  }

  deconnexion() {
    this.backend.deconnexion();
  }

  async emploiDuTemps(idEleve: number, debut: DateISO, fin: DateISO): Promise<Cours[]> {
    const raw = await this.backend.requete<RawCours[]>(`E/${idEleve}/emploidutemps.awp`, 'get', {
      dateDebut: debut, dateFin: fin, avecTrous: false,
    });
    return parseCours(Array.isArray(raw) ? raw : []);
  }

  async devoirs(idEleve: number): Promise<Devoir[]> {
    const raw = await this.backend.requete<RawCahierDeTexte>(`Eleves/${idEleve}/cahierdetexte.awp`, 'get', {});
    return parseDevoirs(raw ?? {});
  }

  async devoirsDuJour(idEleve: number, date: DateISO): Promise<DevoirDetail[]> {
    const raw = await this.backend.requete<RawCahierDeTexteJour>(
      `Eleves/${idEleve}/cahierdetexte/${date}.awp`, 'get', {},
    );
    return parseDevoirsJour(raw ?? { date, matieres: [] });
  }

  async marquerDevoir(idEleve: number, idDevoir: number, effectue: boolean): Promise<void> {
    await this.backend.requete(`Eleves/${idEleve}/cahierdetexte.awp`, 'put', {
      idDevoirsEffectues: effectue ? [idDevoir] : [],
      idDevoirsNonEffectues: effectue ? [] : [idDevoir],
    });
  }

  async releve(idEleve: number): Promise<Releve> {
    const raw = await this.backend.requete<RawNotes>(`eleves/${idEleve}/notes.awp`, 'get', { anneeScolaire: '' });
    return parseReleve(raw);
  }
}
