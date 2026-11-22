/** Grille horaire d'une semaine (vue jour sur téléphone), partagée par l'emploi du temps et les devoirs. */
import { useMemo, useState, type ReactNode } from 'react';
import type { Cours } from '@hibou/core';
import { fmt, lundiParDefaut, minutes } from '../format';

const PX_PAR_MINUTE = 1.8;

export interface RenduCours {
  className: string;
  contenu: ReactNode;
}

export function GrilleSemaine({
  jours, cours, aujourdHui, jourMobile, setJourMobile, rendreCours, avantColonne,
}: {
  jours: string[];
  cours: Cours[];
  aujourdHui: string;
  jourMobile: string;
  setJourMobile: (j: string) => void;
  rendreCours: (c: Cours) => RenduCours;
  /** Contenu affiché au-dessus de la colonne d'un jour (devoirs sans créneau…). */
  avantColonne?: (jour: string) => ReactNode;
}) {
  const plage = useMemo(() => {
    if (cours.length === 0) return { debut: 8 * 60, fin: 17 * 60 };
    return {
      debut: Math.floor(Math.min(...cours.map((x) => minutes(x.debut))) / 60) * 60,
      fin: Math.ceil(Math.max(...cours.map((x) => minutes(x.fin))) / 60) * 60,
    };
  }, [cours]);
  const hauteur = (plage.fin - plage.debut) * PX_PAR_MINUTE;
  const heures: number[] = [];
  for (let m = plage.debut; m <= plage.fin; m += 60) heures.push(m);
  const maintenant = new Date();
  const minutesMaintenant = maintenant.getHours() * 60 + maintenant.getMinutes();

  return (
    <>
      <div className="cal-onglets-jours">
        {jours.map((j) => (
          <button
            key={j}
            className={`${j === jourMobile ? 'actif' : ''} ${j === aujourdHui ? 'aujourdhui' : ''}`}
            onClick={() => setJourMobile(j)}
          >
            {fmt(j, { weekday: 'short' })}
            <br />
            {fmt(j, { day: 'numeric' })}
          </button>
        ))}
      </div>
      <div className="cal-grille" style={{ ['--nb-jours' as string]: jours.length }}>
        <div className="cal-heures" style={{ height: hauteur }}>
          {heures.map((m) => (
            <span key={m} style={{ top: (m - plage.debut) * PX_PAR_MINUTE }}>{m / 60}h</span>
          ))}
        </div>
        {jours.map((jour) => {
          const coursDuJour = cours.filter((c) => c.debut.startsWith(jour));
          return (
            <section
              key={jour}
              className={`cal-jour ${jour === aujourdHui ? 'aujourdhui' : ''} ${jour === jourMobile ? 'jour-mobile' : ''} ${jour < aujourdHui ? 'passe' : ''}`}
              aria-label={fmt(jour, { weekday: 'long', day: 'numeric', month: 'long' })}
            >
              <header className="cal-jour-titre">
                {fmt(jour, { weekday: 'long' })} <span className="discret">{fmt(jour, { day: 'numeric', month: 'short' })}</span>
              </header>
              {avantColonne?.(jour)}
              <div className="cal-colonne" style={{ height: hauteur }}>
                {heures.map((m) => (
                  <div key={m} className="cal-ligne-heure" style={{ top: (m - plage.debut) * PX_PAR_MINUTE }} />
                ))}
                {jour === aujourdHui && minutesMaintenant > plage.debut && minutesMaintenant < plage.fin && (
                  <div className="cal-maintenant" style={{ top: (minutesMaintenant - plage.debut) * PX_PAR_MINUTE }} />
                )}
                {coursDuJour.length === 0 && <div className="cal-vide-jour">Pas de cours</div>}
                {coursDuJour.map((c) => {
                  const r = rendreCours(c);
                  return (
                    <article
                      key={c.id}
                      className={`cal-cours ${r.className} ${c.annule ? 'annule' : ''}`}
                      style={{
                        top: (minutes(c.debut) - plage.debut) * PX_PAR_MINUTE,
                        minHeight: (minutes(c.fin) - minutes(c.debut)) * PX_PAR_MINUTE,
                        ['--couleur' as string]: c.couleur,
                      }}
                    >
                      {r.contenu}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

/** Lundi → vendredi, plus le samedi s'il y a quelque chose ce jour-là. */
export function joursDeLaSemaine(lundi: string, aSamedi: boolean, ajouter: (d: string, n: number) => string) {
  const base = [0, 1, 2, 3, 4].map((i) => ajouter(lundi, i));
  return aSamedi ? [...base, ajouter(lundi, 5)] : base;
}

export function BarreSemaine({
  lundi, dernierJour, onDecaler, onAujourdhui, droite,
}: {
  lundi: string;
  dernierJour: string;
  onDecaler: (n: number) => void;
  onAujourdhui: () => void;
  droite?: ReactNode;
}) {
  return (
    <div className="cal-barre">
      <div className="cal-nav">
        <button className="bouton-secondaire" onClick={() => onDecaler(-1)} aria-label="Semaine précédente">‹</button>
        <button className="bouton-secondaire" onClick={onAujourdhui}>Aujourd'hui</button>
        <button className="bouton-secondaire" onClick={() => onDecaler(1)} aria-label="Semaine suivante">›</button>
        <h2 className="cal-titre">
          Semaine du {fmt(lundi, { day: 'numeric', month: 'long' })} au {fmt(dernierJour, { day: 'numeric', month: 'long' })}
        </h2>
      </div>
      {droite && <div className="cal-resume">{droite}</div>}
    </div>
  );
}

/** État de navigation d'une vue semaine. */
export function useSemaine(aujourdHui: string, ajouter: (d: string, n: number) => string, jourSemaineDe: (d: string) => number) {
  const jourInitial = () => (jourSemaineDe(aujourdHui) <= 5 ? aujourdHui : lundiParDefaut(aujourdHui));
  const [lundi, setLundi] = useState(() => lundiParDefaut(aujourdHui));
  const [jourMobile, setJourMobile] = useState(jourInitial);
  return {
    lundi,
    jourMobile,
    setJourMobile,
    decaler: (n: number) => {
      const nouveau = ajouter(lundi, 7 * n);
      setLundi(nouveau);
      setJourMobile(nouveau);
    },
    revenir: () => {
      setLundi(lundiParDefaut(aujourdHui));
      setJourMobile(jourInitial());
    },
  };
}
