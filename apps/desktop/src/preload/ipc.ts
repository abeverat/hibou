import type { HibouApi, TypeErreur } from '@hibou/core';

export const CANAL_IPC = 'hibou:appel';

/** Méthodes propres au bureau, en plus de celles du service. */
export const METHODES_BUREAU = ['appareilEnAttente', 'memoriserAppareil', 'oublierAppareil', 'appareilMemorise'] as const;

export interface ApiBureau extends HibouApi {
  /** true si un QCM vient d'être réussi et que l'appareil peut être mémorisé. */
  appareilEnAttente(): Promise<boolean>;
  /** Mémorise cn/cv (chiffrés) pour éviter le QCM ; false si le chiffrement est indisponible. */
  memoriserAppareil(): Promise<boolean>;
  oublierAppareil(): Promise<void>;
  appareilMemorise(): Promise<boolean>;
}

export type ReponseIpc =
  | { ok: true; valeur: unknown }
  | { ok: false; erreur: { type: TypeErreur; message: string } };
