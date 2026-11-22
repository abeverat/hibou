import type { HibouApi, TypeErreur } from '@hibou/core';

export const CANAL_IPC = 'hibou:appel';

/** Méthodes propres au bureau, en plus de celles du service. */
export const METHODES_BUREAU = [
  'appareilEnAttente', 'memoriserAppareil', 'oublierAppareil', 'appareilMemorise',
  'biometrie', 'activerBiometrie', 'ignorerBiometrie', 'desactiverBiometrie', 'deverrouiller',
  'verrouiller', 'deverrouillerSession', 'estVerrouille', 'reglages', 'reprendreSession',
] as const;

export const CANAL_VERROU = 'hibou:verrou';
/** Menu « Réglages… / Paramètres » de l'application. */
export const CANAL_REGLAGES = 'hibou:reglages';

export interface EtatReglages {
  biometrie: EtatBiometrie;
  /** Identifiant du compte connecté (pour l'activation depuis les réglages). */
  identifiant: string;
  appareilMemorise: boolean;
  /** Libellés natifs selon la langue du système. */
  libelles: { reglages: string };
}

export interface EtatBiometrie {
  /** « Touch ID », « Windows Hello », ou null si indisponible sur cet appareil. */
  nom: 'Touch ID' | 'Windows Hello' | null;
  /** Identifiants enregistrés : l'appli s'ouvre par biométrie. */
  active: boolean;
  /** Connexion par mot de passe réussie : on peut proposer d'activer la biométrie. */
  proposer: boolean;
}

export interface ApiBureau extends HibouApi {
  /** `garder` : « Rester connecté sur cet ordinateur » (jeton EcoleDirecte enregistré chiffré). */
  connexion(identifiant: string, motdepasse: string, garder?: boolean): Promise<import('@hibou/core').ResultatConnexion>;
  /** Reconnexion avec le jeton enregistré ; null s'il n'y en a pas. */
  reprendreSession(): Promise<import('@hibou/core').ResultatConnexion | null>;
  /** true si un QCM vient d'être réussi et que l'appareil peut être mémorisé. */
  appareilEnAttente(): Promise<boolean>;
  /** Mémorise cn/cv (chiffrés) pour éviter le QCM ; false si le chiffrement est indisponible. */
  memoriserAppareil(): Promise<boolean>;
  oublierAppareil(): Promise<void>;
  appareilMemorise(): Promise<boolean>;
  biometrie(): Promise<EtatBiometrie>;
  /** Demande l'empreinte puis enregistre les identifiants : ceux de la dernière connexion,
   *  ou le mot de passe ressaisi dans les réglages (« Plus tard » l'a effacé de la mémoire). */
  activerBiometrie(motdepasse?: string): Promise<boolean>;
  reglages(): Promise<EtatReglages>;
  ignorerBiometrie(): Promise<void>;
  desactiverBiometrie(): Promise<void>;
  /** Empreinte, puis connexion avec les identifiants enregistrés. */
  deverrouiller(): Promise<import('@hibou/core').ResultatConnexion>;
  verrouiller(): Promise<void>;
  deverrouillerSession(): Promise<boolean>;
  estVerrouille(): Promise<boolean>;
  /** Abonnement au verrouillage automatique (veille, écran verrouillé). Pas un appel IPC. */
  onVerrouillage(rappel: () => void): () => void;
  /** Ouverture des réglages depuis le menu natif. Pas un appel IPC. */
  onReglages(rappel: () => void): () => void;
}

export type ReponseIpc =
  | { ok: true; valeur: unknown }
  | { ok: false; erreur: { type: TypeErreur; message: string } };
