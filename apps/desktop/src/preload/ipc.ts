import type { TypeErreur } from '@hibou/core';

export const CANAL_IPC = 'hibou:appel';

export type ReponseIpc =
  | { ok: true; valeur: unknown }
  | { ok: false; erreur: { type: TypeErreur; message: string } };
