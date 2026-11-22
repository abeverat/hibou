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
export interface EdBackend {
  readonly demo: boolean;
  connexion(identifiant: string, motdepasse: string): Promise<EtapeConnexion>;
  /** `choix` = proposition encodée en base64, telle que reçue. */
  repondreQcm(choix: string): Promise<EtapeConnexion>;
  requete<T>(chemin: string, verbe: Verbe, donnees: object): Promise<T>;
  deconnexion(): void;
}
