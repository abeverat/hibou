/**
 * Backend réel : parle à api.ecoledirecte.com.
 * Flux de connexion repris de la bibliothèque `ecoledirecte` 0.4.2 (intégration Home Assistant
 * hass-ecoledirecte), voir docs/ecoledirecte-api.md.
 *
 * Sécurité : identifiant, mot de passe et token restent en mémoire dans cet objet ; rien n'est
 * écrit sur disque ni journalisé. Le mot de passe est gardé pour la durée de la session afin de
 * finir le QCM et de se reconnecter quand le token expire ; il est effacé à la déconnexion.
 */
import type { EdBackend, EtapeConnexion, Verbe } from './backend';
import { ErreurEd, erreurDepuisCode } from './erreurs';
import type { RawLogin, RawQcm, RawReponse } from './raw';

export const API_BASE = 'https://api.ecoledirecte.com/v3';
/** Version attendue par l'API (code 517 si elle est refusée). Valeur de `ecoledirecte` 0.4.2. */
export const API_VERSION = '4.104.3';

/** Le même user-agent doit être utilisé pendant toute la vie d'un token. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';

const EN_TETES_BASE: Record<string, string> = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'fr-FR,fr;q=0.9',
  'content-type': 'application/x-www-form-urlencoded',
  origin: 'https://www.ecoledirecte.com',
  referer: 'https://www.ecoledirecte.com/',
  'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'user-agent': USER_AGENT,
};

export interface RequeteHttp {
  methode: 'GET' | 'POST';
  url: string;
  enTetes: Record<string, string>;
  corps?: string;
}

export interface ReponseHttp {
  statut: number;
  /** En-têtes, noms en minuscules. */
  enTetes: Record<string, string>;
  /** Valeurs brutes des en-têtes Set-Cookie. */
  cookies: string[];
  texte: string;
}

/** Fonction HTTP fournie par la plateforme (Node/Electron, Capacitor…), sans restriction CORS. */
export type Http = (requete: RequeteHttp) => Promise<ReponseHttp>;

/**
 * Encodage des identifiants, comme `quote(s, safe="~()*!.'%\\")` puis `\` → `\\` en Python :
 * tout est encodé en %XX sauf lettres, chiffres et `_.-~()*!'%\`.
 */
export function encoderIdentifiant(s: string): string {
  let sortie = '';
  for (const car of s) {
    if (/[A-Za-z0-9_.\-~()*!'%\\]/.test(car)) sortie += car;
    else for (const o of new TextEncoder().encode(car)) sortie += '%' + o.toString(16).toUpperCase().padStart(2, '0');
  }
  return sortie.replace(/\\/g, '\\\\');
}

export interface OptionsReel {
  http: Http;
  /** Journal de diagnostic (chemins et codes uniquement, jamais de données). */
  journal?: (message: string) => void;
  /** `cn`/`cv` mémorisés d'un QCM précédent (évite de repasser le QCM). */
  doubleAuth?: { cn: string; cv: string } | null;
  /** Appelé quand EcoleDirecte fournit de nouveaux `cn`/`cv` après un QCM réussi. */
  onDoubleAuth?: (fa: { cn: string; cv: string }) => void;
}

export class ReelBackend implements EdBackend {
  readonly demo = false;
  private readonly http: Http;
  private readonly journal: (m: string) => void;
  private identifiants: { identifiant: string; motdepasse: string } | null = null;
  private token: string | null = null;
  private token2fa: string | null = null;
  private cookies = new Map<string, string>();
  private fa: { cn: string; cv: string } | null;
  private readonly onDoubleAuth?: (fa: { cn: string; cv: string }) => void;

  constructor(options: OptionsReel) {
    this.http = options.http;
    this.journal = options.journal ?? (() => {});
    this.fa = options.doubleAuth ?? null;
    this.onDoubleAuth = options.onDoubleAuth;
  }

  /** `cn`/`cv` mémorisés à utiliser pour la prochaine connexion (null : aucun). */
  definirDoubleAuth(fa: { cn: string; cv: string } | null) {
    this.fa = fa;
  }

  // ---------- Connexion ----------

  async connexion(identifiant: string, motdepasse: string): Promise<EtapeConnexion> {
    this.identifiants = { identifiant, motdepasse };
    try {
      return await this.login();
    } catch (e) {
      // Des cn/cv mémorisés mais devenus invalides : on retente sans, ce qui redemande le QCM.
      if (this.fa && e instanceof ErreurEd && e.type === 'identifiants') {
        this.journal('cn/cv refusés, nouvelle tentative sans');
        this.fa = null;
        return this.login();
      }
      throw e;
    }
  }

  async repondreQcm(choix: string): Promise<EtapeConnexion> {
    if (!this.identifiants) throw new ErreurEd('qcm', 'Aucune connexion en cours.');
    const r = await this.envoyer<{ cn?: string; cv?: string } | null>(
      'connexion/doubleauth.awp', 'post', `data={"choix": "${choix}"}`,
    );
    if (r.code !== 200 || !r.data?.cn || !r.data?.cv) {
      // Mauvaise réponse : EcoleDirecte pose une nouvelle question.
      this.journal(`QCM refusé (code ${r.code})`);
      return { etat: 'qcm', qcm: await this.lireQcm() };
    }
    this.fa = { cn: r.data.cn, cv: r.data.cv };
    this.onDoubleAuth?.(this.fa);
    const etape = await this.login();
    if (etape.etat === 'qcm') throw new ErreurEd('qcm', 'EcoleDirecte redemande la vérification. Réessayez dans un moment.');
    return etape;
  }

  deconnexion(): void {
    this.identifiants = null;
    this.token = null;
    this.token2fa = null;
    this.cookies.clear();
  }

  /** GTK puis login ; renvoie le compte, ou le QCM si EcoleDirecte le demande (code 250). */
  private async login(): Promise<EtapeConnexion> {
    const { identifiant, motdepasse } = this.identifiants!;
    this.token = null;
    this.token2fa = null;
    this.cookies.clear();
    const gtk = await this.lireGtk();

    const champs = [
      `"identifiant":"${encoderIdentifiant(identifiant)}"`,
      `"motdepasse":"${encoderIdentifiant(motdepasse)}"`,
      '"isReLogin": false',
      '"uuid": ""',
    ];
    if (this.fa) {
      const { cn, cv } = this.fa;
      champs.push(`"cn":"${cn}"`, `"cv":"${cv}"`, `"fa": [{"cn": "${cn}", "cv": "${cv}"}]`);
    }
    const reponse = await this.appel('POST', `${API_BASE}/login.awp?v=${API_VERSION}`, `data={${champs.join(', ')}}`, { 'x-gtk': gtk });
    const json = this.lireJson<RawLogin>(reponse);
    this.journal(`login.awp → code ${json.code}`);
    this.retenirToken(reponse, json);

    if (json.code === 200) {
      if (!json.data?.accounts?.length) throw new ErreurEd('inconnue', 'EcoleDirecte n’a renvoyé aucun compte.');
      return { etat: 'connecte', login: json.data };
    }
    if (json.code === 250) return { etat: 'qcm', qcm: await this.lireQcm() };
    throw erreurDepuisCode(json.code, json.message);
  }

  private async lireGtk(): Promise<string> {
    const reponse = await this.appel('GET', `${API_BASE}/login.awp?gtk=1&v=${API_VERSION}`);
    const gtk = this.cookies.get('GTK');
    this.journal(`gtk → statut ${reponse.statut}, cookie ${gtk ? 'reçu' : 'absent'}`);
    if (!gtk) throw new ErreurEd('indisponible', "EcoleDirecte n'a pas répondu comme prévu (cookie GTK absent). Réessayez plus tard.");
    return gtk;
  }

  private async lireQcm(): Promise<RawQcm> {
    const r = await this.envoyer<RawQcm>('connexion/doubleauth.awp', 'get', 'data={}');
    if (r.code !== 200 || !r.data?.question) throw new ErreurEd('qcm', "Impossible d'obtenir la question de sécurité d'EcoleDirecte.");
    return r.data;
  }

  // ---------- Requêtes de données ----------

  async requete<T>(chemin: string, verbe: Verbe, donnees: object): Promise<T> {
    if (!this.token || !this.identifiants) throw new ErreurEd('non-connecte', "Vous n'êtes pas connecté.");
    const corps = `data=${JSON.stringify(donnees)}`;
    let r = await this.envoyer<T>(chemin, verbe, corps);
    if (r.code === 520 || r.code === 525) {
      // Token expiré : reconnexion silencieuse, puis une seule nouvelle tentative.
      this.journal('token expiré, reconnexion');
      const etape = await this.login();
      if (etape.etat === 'qcm') throw new ErreurEd('session', 'Votre session a expiré, reconnectez-vous.');
      r = await this.envoyer<T>(chemin, verbe, corps);
    }
    if (r.code === 200 || r.code === 210) return r.data;
    throw erreurDepuisCode(r.code, r.message);
  }

  /** POST authentifié vers une route `.awp`, avec mise à jour du token. */
  private async envoyer<T>(chemin: string, verbe: Verbe, corps: string): Promise<RawReponse<T>> {
    const url = `${API_BASE}/${chemin}?verbe=${verbe}&v=${API_VERSION}`;
    const reponse = await this.appel('POST', url, corps);
    const json = this.lireJson<T>(reponse);
    this.journal(`${chemin} (${verbe}) → code ${json.code}`);
    this.retenirToken(reponse, json);
    return json;
  }

  // ---------- HTTP ----------

  private async appel(methode: 'GET' | 'POST', url: string, corps?: string, extra: Record<string, string> = {}) {
    const enTetes: Record<string, string> = { ...EN_TETES_BASE, ...extra };
    if (this.token) enTetes['x-token'] = this.token;
    if (this.token2fa) enTetes['2fa-token'] = this.token2fa;
    if (this.cookies.size) enTetes.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    let reponse: ReponseHttp;
    try {
      reponse = await this.http({ methode, url, enTetes, corps });
    } catch {
      throw new ErreurEd('indisponible', 'Impossible de joindre EcoleDirecte. Vérifiez votre connexion internet.');
    }
    for (const c of reponse.cookies) {
      const [paire] = c.split(';');
      const i = paire!.indexOf('=');
      if (i > 0) this.cookies.set(paire!.slice(0, i).trim(), paire!.slice(i + 1).trim());
    }
    if (reponse.statut >= 500) throw new ErreurEd('indisponible', `EcoleDirecte est indisponible pour le moment (erreur ${reponse.statut}).`);
    return reponse;
  }

  private lireJson<T>(reponse: ReponseHttp): RawReponse<T> {
    try {
      const json = JSON.parse(reponse.texte) as RawReponse<T>;
      if (typeof json?.code !== 'number') throw new Error('format');
      return json;
    } catch {
      throw new ErreurEd('indisponible', `Réponse inattendue d'EcoleDirecte (statut ${reponse.statut}).`);
    }
  }

  /** Le token peut être renouvelé dans chaque réponse : on garde toujours le dernier. */
  private retenirToken(reponse: ReponseHttp, json: RawReponse<unknown>) {
    const token = reponse.enTetes['x-token'] || json.token;
    if (token) this.token = token;
    const t2fa = reponse.enTetes['2fa-token'];
    if (t2fa) this.token2fa = t2fa;
  }
}
