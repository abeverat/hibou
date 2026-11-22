/**
 * Service Hibou : ce que l'interface appelle (équivalent des routes `/api/...` du cahier
 * des charges). Garde la session, l'élève choisi et un petit cache mémoire.
 */
import type { Compte, Cours, DateISO, Devoir, DevoirDetail, Releve } from './types';
import type { EdBackend, JetonConnexion } from './ed/backend';
import { EdClient, type ResultatConnexion } from './ed/client';
import { ErreurEd } from './ed/erreurs';

export interface EtatSession {
  demo: boolean;
  compte: Compte | null;
  idEleve: number | null;
}

/** Contrat entre l'interface et le service (transporté par IPC sur le bureau). */
export interface HibouApi {
  etat(): Promise<EtatSession>;
  connexion(identifiant: string, motdepasse: string): Promise<ResultatConnexion>;
  repondreQcm(choix: string): Promise<ResultatConnexion>;
  deconnexion(): Promise<void>;
  choisirEleve(idEleve: number): Promise<void>;
  emploiDuTemps(debut: DateISO, fin: DateISO): Promise<Cours[]>;
  devoirs(): Promise<Devoir[]>;
  devoirsDuJour(date: DateISO): Promise<DevoirDetail[]>;
  marquerDevoir(idDevoir: number, effectue: boolean): Promise<void>;
  releve(): Promise<Releve>;
  /** Vide le cache (bouton « Actualiser »). */
  actualiser(): Promise<void>;
}

export const METHODES_API = [
  'etat', 'connexion', 'repondreQcm', 'deconnexion', 'choisirEleve', 'emploiDuTemps',
  'devoirs', 'devoirsDuJour', 'marquerDevoir', 'releve', 'actualiser',
] as const satisfies readonly (keyof HibouApi)[];

const DUREE_CACHE_MS = 5 * 60_000;

export class HibouService implements HibouApi {
  private readonly client: EdClient;
  private compte: Compte | null = null;
  private idEleve: number | null = null;
  private cache = new Map<string, { expire: number; valeur: Promise<unknown> }>();

  constructor(backend: EdBackend, private readonly horloge: () => number = Date.now) {
    this.client = new EdClient(backend);
  }

  async etat(): Promise<EtatSession> {
    return { demo: this.client.demo, compte: this.compte, idEleve: this.idEleve };
  }

  async connexion(identifiant: string, motdepasse: string) {
    this.reinitialiser();
    return this.apresConnexion(await this.client.connexion(identifiant, motdepasse));
  }

  /**
   * Reconnexion avec un jeton « rester connecté ». Réservé au processus principal :
   * ne fait pas partie de `METHODES_API`, la fenêtre ne manipule jamais de jeton.
   */
  async reprendre(jeton: JetonConnexion) {
    this.reinitialiser();
    return this.apresConnexion(await this.client.reprendre(jeton));
  }

  /** Jeton de la session en cours (processus principal uniquement). */
  jetonActuel(): JetonConnexion | null {
    return this.client.jetonActuel();
  }

  async repondreQcm(choix: string) {
    return this.apresConnexion(await this.client.repondreQcm(choix));
  }

  async deconnexion() {
    this.client.deconnexion();
    this.reinitialiser();
  }

  async choisirEleve(idEleve: number) {
    if (!this.compte?.eleves.some((e) => e.id === idEleve)) {
      throw new ErreurEd('inconnue', 'Élève inconnu pour ce compte.');
    }
    this.idEleve = idEleve;
  }

  emploiDuTemps(debut: DateISO, fin: DateISO) {
    const id = this.eleve();
    return this.memoriser(`edt:${id}:${debut}:${fin}`, () => this.client.emploiDuTemps(id, debut, fin));
  }

  devoirs() {
    const id = this.eleve();
    return this.memoriser(`devoirs:${id}`, () => this.client.devoirs(id));
  }

  devoirsDuJour(date: DateISO) {
    const id = this.eleve();
    return this.memoriser(`devoirs:${id}:${date}`, () => this.client.devoirsDuJour(id, date));
  }

  async marquerDevoir(idDevoir: number, effectue: boolean) {
    const id = this.eleve();
    await this.client.marquerDevoir(id, idDevoir, effectue);
    for (const cle of this.cache.keys()) if (cle.startsWith(`devoirs:${id}`)) this.cache.delete(cle);
  }

  releve() {
    const id = this.eleve();
    return this.memoriser(`notes:${id}`, () => this.client.releve(id));
  }

  async actualiser() {
    this.cache.clear();
  }

  private apresConnexion(r: ResultatConnexion): ResultatConnexion {
    if (r.etat === 'connecte') {
      this.compte = r.compte;
      this.idEleve = r.compte.eleves[0]?.id ?? null;
    }
    return r;
  }

  private reinitialiser() {
    this.compte = null;
    this.idEleve = null;
    this.cache.clear();
  }

  private eleve(): number {
    if (this.idEleve == null) throw new ErreurEd('non-connecte', "Vous n'êtes pas connecté.");
    return this.idEleve;
  }

  private memoriser<T>(cle: string, charger: () => Promise<T>): Promise<T> {
    const maintenant = this.horloge();
    const enCache = this.cache.get(cle);
    if (enCache && enCache.expire > maintenant) return enCache.valeur as Promise<T>;
    const valeur = charger();
    this.cache.set(cle, { expire: maintenant + DUREE_CACHE_MS, valeur });
    valeur.catch(() => this.cache.delete(cle)); // ne pas garder une erreur en cache
    return valeur;
  }
}
