export type TypeErreur =
  | 'identifiants' // mauvais identifiant / mot de passe (505)
  | 'qcm' // réponse au QCM refusée ou essais épuisés
  | 'session' // token invalide ou expiré (520, 525) : se reconnecter
  | 'indisponible' // API ou établissement indisponible (535, 5xx, réseau)
  | 'version' // version d'API refusée (517) : mettre à jour Hibou
  | 'non-connecte'
  | 'non-implemente'
  | 'biometrie' // vérification Touch ID / Windows Hello annulée ou refusée
  | 'verrouille' // appli verrouillée : déverrouiller d'abord
  | 'inconnue';

/** Erreur unique remontée par la couche d'accès ; `message` est affichable tel quel. */
export class ErreurEd extends Error {
  constructor(
    readonly type: TypeErreur,
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = 'ErreurEd';
  }
}

export function erreurDepuisCode(code: number, message?: string): ErreurEd {
  switch (code) {
    case 505:
      return new ErreurEd('identifiants', 'Identifiant ou mot de passe incorrect.', code);
    case 517:
      return new ErreurEd('version', "EcoleDirecte a changé de version : Hibou doit être mis à jour.", code);
    case 520:
    case 525:
      return new ErreurEd('session', 'Votre session a expiré, reconnectez-vous.', code);
    case 535:
      return new ErreurEd('indisponible', "L'établissement n'est pas disponible sur EcoleDirecte pour le moment.", code);
    default:
      return new ErreurEd('inconnue', message || `Erreur EcoleDirecte (code ${code}).`, code);
  }
}
