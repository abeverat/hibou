import type { RawLogin, RawQcm } from './raw';

export type Verbe = 'get' | 'put' | 'post';

export type EtapeConnexion =
  | { etat: 'connecte'; login: RawLogin }
  | { etat: 'qcm'; qcm: RawQcm };

/**
 * Transport vers EcoleDirecte : le seul endroit qui parle HTTP (ou aux fixtures).
 * Implémentations : `DemoBackend` (fixtures), puis le backend réel (étape 4), dont le
 * HTTP dépend de la plateforme (Node/Electron, Capacitor).
 *
 * Contrat : le token reste à l'intérieur du backend ; `requete` renvoie le champ `data`
 * ou lève une `ErreurEd`.
 */
/**
 * Jeton « se souvenir de moi » (connexion de type mobile) : permet de rouvrir une session
 * sans le mot de passe. Secret : à garder chiffré (trousseau), jamais dans les logs.
 */
export interface JetonConnexion {
  identifiant: string;
  /** Identifiant d'appareil (uuid v4) choisi à la connexion par mot de passe. */
  uuid: string;
  typeCompte: string;
  accessToken: string;
}

export interface EdBackend {
  readonly demo: boolean;
  /** Connexion par mot de passe ; demande aussi un jeton « se souvenir de moi ». */
  connexion(identifiant: string, motdepasse: string): Promise<EtapeConnexion>;
  /** Reconnexion avec un jeton obtenu précédemment (sans mot de passe). */
  reprendre(jeton: JetonConnexion): Promise<EtapeConnexion>;
  /** Jeton de la session en cours, s'il y en a un (à enregistrer pour « rester connecté »). */
  jetonActuel(): JetonConnexion | null;
  /** `choix` = proposition encodée en base64, telle que reçue. */
  repondreQcm(choix: string): Promise<EtapeConnexion>;
  requete<T>(chemin: string, verbe: Verbe, donnees: object): Promise<T>;
  deconnexion(): void;
}
