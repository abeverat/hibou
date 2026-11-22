/**
 * Backend de démonstration : sert les fixtures (format brut EcoleDirecte) en recalant leurs
 * dates sur la semaine courante, pour que « aujourd'hui », « demain » et le prochain contrôle
 * aient toujours un sens.
 *
 * - identifiant quelconque → compte famille avec deux enfants ;
 * - identifiant `qcm` → passe par l'écran du QCM (bonne réponse : « Avril ») ;
 * - mot de passe `faux` → erreur « identifiants incorrects ».
 */
import { ajouterJours, dateLocale, ecartJours, jourSemaine, lundiDeLaSemaine } from '../dates';
import type { EdBackend, EtapeConnexion, Verbe } from './backend';
import { ErreurEd, erreurDepuisCode } from './erreurs';
import { encodeBase64 } from './parsers';
import type {
  RawCahierDeTexte, RawCahierDeTexteJour, RawCours, RawLogin, RawNotes, RawReponse,
} from './raw';
import fixtureLogin from './fixtures/login.json';
import fixtureEdt from './fixtures/emploidutemps.json';
import fixtureCdt from './fixtures/cahierdetexte.json';
import fixtureCdtJours from './fixtures/cahierdetexte-jours.json';
import fixtureNotes from './fixtures/notes.json';

/** Lundi de la semaine type des fixtures. */
export const LUNDI_REFERENCE = '2025-01-06';

const REPONSE_QCM = 'Avril';
const QCM = {
  question: encodeBase64('Quel est votre mois de naissance ?'),
  propositions: ['Janvier', 'Février', 'Avril', 'Septembre', 'Novembre'].map(encodeBase64),
};

const DATE_EN_TETE = /^(\d{4}-\d{2}-\d{2})/;

/** Recale récursivement toutes les dates (`YYYY-MM-DD…`) d'une valeur JSON, clés comprises. */
export function decalerDates<T>(valeur: T, jours: number): T {
  const decaler = (s: string) => s.replace(DATE_EN_TETE, (d) => ajouterJours(d, jours));
  const parcourir = (v: unknown): unknown => {
    if (typeof v === 'string') return decaler(v);
    if (Array.isArray(v)) return v.map(parcourir);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [decaler(k), parcourir(x)]));
    }
    return v;
  };
  return parcourir(valeur) as T;
}

const copie = <T>(v: T): T => structuredClone(v);

export interface OptionsDemo {
  /** Horloge injectable (tests). */
  maintenant?: () => Date;
  /** Latence simulée en ms. */
  latence?: number;
}

export class DemoBackend implements EdBackend {
  readonly demo = true;
  private connecte = false;
  private qcmEnCours = false;
  /** Devoirs cochés/décochés pendant la session de démo. */
  private effectues = new Map<number, boolean>();
  private readonly maintenant: () => Date;
  private readonly latence: number;

  constructor(options: OptionsDemo = {}) {
    this.maintenant = options.maintenant ?? (() => new Date());
    this.latence = options.latence ?? 200;
  }

  /** Lundi sur lequel on cale la semaine type (le lundi suivant pendant le week-end). */
  private lundiAncre(): string {
    const aujourdHui = dateLocale(this.maintenant());
    const lundi = lundiDeLaSemaine(aujourdHui);
    return jourSemaine(aujourdHui) >= 6 ? ajouterJours(lundi, 7) : lundi;
  }

  private decalage(): number {
    return ecartJours(LUNDI_REFERENCE, this.lundiAncre());
  }

  private async attendre() {
    if (this.latence > 0) await new Promise((r) => setTimeout(r, this.latence));
  }

  async connexion(identifiant: string, motdepasse: string): Promise<EtapeConnexion> {
    await this.attendre();
    if (motdepasse === 'faux') throw erreurDepuisCode(505);
    if (identifiant.trim().toLowerCase() === 'qcm') {
      this.qcmEnCours = true;
      return { etat: 'qcm', qcm: copie(QCM) };
    }
    this.connecte = true;
    return { etat: 'connecte', login: copie((fixtureLogin as RawReponse<RawLogin>).data) };
  }

  async repondreQcm(choix: string): Promise<EtapeConnexion> {
    await this.attendre();
    if (!this.qcmEnCours) throw new ErreurEd('qcm', 'Aucun QCM en cours.');
    if (choix !== encodeBase64(REPONSE_QCM)) {
      // Comme EcoleDirecte : une mauvaise réponse redonne une question.
      return { etat: 'qcm', qcm: copie(QCM) };
    }
    this.qcmEnCours = false;
    this.connecte = true;
    return { etat: 'connecte', login: copie((fixtureLogin as RawReponse<RawLogin>).data) };
  }

  deconnexion(): void {
    this.connecte = false;
    this.qcmEnCours = false;
  }

  async requete<T>(chemin: string, verbe: Verbe, donnees: object): Promise<T> {
    if (!this.connecte) throw new ErreurEd('non-connecte', "Vous n'êtes pas connecté.");
    await this.attendre();
    const d = donnees as Record<string, unknown>;
    let m: RegExpMatchArray | null;

    if ((m = chemin.match(/^E\/\d+\/emploidutemps\.awp$/))) {
      return this.emploiDuTemps(String(d.dateDebut), String(d.dateFin)) as T;
    }
    if (chemin.match(/^Eleves\/\d+\/cahierdetexte\.awp$/)) {
      if (verbe === 'put') {
        for (const id of (d.idDevoirsEffectues as number[]) ?? []) this.effectues.set(id, true);
        for (const id of (d.idDevoirsNonEffectues as number[]) ?? []) this.effectues.set(id, false);
        return {} as T;
      }
      return this.cahierDeTexte() as T;
    }
    if ((m = chemin.match(/^Eleves\/\d+\/cahierdetexte\/(\d{4}-\d{2}-\d{2})\.awp$/))) {
      return this.cahierDuJour(m[1]!) as T;
    }
    if (chemin.match(/^eleves\/\d+\/notes\.awp$/)) {
      return decalerDates((fixtureNotes as RawReponse<RawNotes>).data, this.decalage()) as T;
    }
    throw new ErreurEd('non-implemente', `Route non simulée en mode démo : ${chemin}`);
  }

  /** Recopie la semaine type sur chaque jour ouvré de l'intervalle demandé. */
  private emploiDuTemps(debut: string, fin: string): RawCours[] {
    const semaine = (fixtureEdt as RawReponse<RawCours[]>).data;
    const resultat: RawCours[] = [];
    const nbJours = Math.min(ecartJours(debut, fin), 62);
    for (let i = 0; i <= nbJours; i++) {
      const date = ajouterJours(debut, i);
      const jourRef = ajouterJours(LUNDI_REFERENCE, jourSemaine(date) - 1);
      for (const c of semaine) {
        if (!c.start_date.startsWith(jourRef)) continue;
        resultat.push({
          ...c,
          id: c.id * 1000 + i,
          start_date: date + c.start_date.slice(10),
          end_date: date + c.end_date.slice(10),
          // Le cours annulé / modifié ne l'est que la semaine courante, pour rester crédible.
          isAnnule: c.isAnnule && ecartJours(this.lundiAncre(), lundiDeLaSemaine(date)) === 0,
          isModifie: c.isModifie && ecartJours(this.lundiAncre(), lundiDeLaSemaine(date)) === 0,
        });
      }
    }
    return resultat;
  }

  private cahierDeTexte(): RawCahierDeTexte {
    const aujourdHui = dateLocale(this.maintenant());
    const brut = decalerDates((fixtureCdt as RawReponse<RawCahierDeTexte>).data, this.decalage());
    const resultat: RawCahierDeTexte = {};
    for (const [date, liste] of Object.entries(brut)) {
      if (date < aujourdHui) continue; // EcoleDirecte ne renvoie que les devoirs à venir
      resultat[date] = liste.map((dv) => ({
        ...dv,
        effectue: this.effectues.get(dv.idDevoir) ?? dv.effectue,
      }));
    }
    return resultat;
  }

  private cahierDuJour(date: string): RawCahierDeTexteJour {
    const dateRef = ajouterJours(date, -this.decalage());
    const jour = (fixtureCdtJours as Record<string, RawCahierDeTexteJour>)[dateRef];
    if (!jour) return { date, matieres: [] };
    const decale = decalerDates(jour, this.decalage());
    for (const m of decale.matieres) {
      if (m.aFaire) m.aFaire.effectue = this.effectues.get(m.aFaire.idDevoir) ?? m.aFaire.effectue;
    }
    return decale;
  }
}
