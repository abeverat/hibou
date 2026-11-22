/** Icônes de l'interface : tracés simples dessinés pour Hibou (contour, 24×24, couleur du texte). */
import type { ReactNode } from 'react';

function Icone({ children, taille = 20 }: { children: ReactNode; taille?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={taille} height={taille} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/** Soleil levant : la journée. */
export const IconeAujourdhui = () => (
  <Icone>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
  </Icone>
);

/** Calendrier avec grille : emploi du temps. */
export const IconeCalendrier = () => (
  <Icone>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17.2h.01M12 17.2h.01" />
  </Icone>
);

/** Liste cochée : devoirs et contrôles. */
export const IconeDevoirs = () => (
  <Icone>
    <path d="M4 6.5l1.6 1.6L8.5 5.2M4 12.5l1.6 1.6 2.9-2.9M4 18.5l1.6 1.6 2.9-2.9M11.5 7h8.5M11.5 13h8.5M11.5 19h8.5" />
  </Icone>
);

/** Courbe montante : notes. */
export const IconeNotes = () => (
  <Icone>
    <path d="M3.5 20.5h17" />
    <path d="M5 16l4.5-5 3.5 3 6-7" />
    <path d="M15 7h4v4" />
  </Icone>
);

/** Flèches circulaires : actualiser. */
export const IconeActualiser = () => (
  <Icone>
    <path d="M20 11.5A8 8 0 0 0 6 6.6L4 8.5" />
    <path d="M4 4v4.5h4.5" />
    <path d="M4 12.5a8 8 0 0 0 14 4.9l2-1.9" />
    <path d="M20 20v-4.5h-4.5" />
  </Icone>
);

/** Roue dentée : réglages. */
export const IconeReglages = () => (
  <Icone>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Icone>
);

/** Porte et flèche : se déconnecter. */
export const IconeDeconnexion = () => (
  <Icone>
    <path d="M9.5 20.5H6a2.5 2.5 0 0 1-2.5-2.5V6A2.5 2.5 0 0 1 6 3.5h3.5" />
    <path d="M15.5 16.5L20 12l-4.5-4.5M20 12H9.5" />
  </Icone>
);

/** Cadenas : verrouiller. */
export const IconeCadenas = () => (
  <Icone>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Icone>
);
