/** Calendrier mensuel des contrôles à venir, avec export .ics. */
import { useMemo, useState } from 'react';
import {
  ajouterJours, dateLocale, ecartJours, evenementsControles, genererIcs, lundiDeLaSemaine, placerDevoirs,
  type Devoir, type Eleve,
} from '@hibou/core';
import { api } from '../api';
import { dansNJours, fmt, heure, useCharge } from '../format';
import { DetailDevoir } from '../composants/Devoirs';

const premierDuMois = (d: string) => `${d.slice(0, 7)}-01`;
function moisSuivant(d: string, n: number) {
  const [a, m] = d.split('-').map(Number);
  const x = new Date(Date.UTC(a!, m! - 1 + n, 1));
  return x.toISOString().slice(0, 10);
}

export function Controles({ eleve }: { eleve: Eleve | undefined }) {
  const aujourdHui = dateLocale();
  const demain = ajouterJours(aujourdHui, 1);
  const [mois, setMois] = useState(() => premierDuMois(aujourdHui));
  const [ouvert, setOuvert] = useState<Devoir | null>(null);

  const [{ donnees, erreur }] = useCharge(async () => {
    const controles = (await api.devoirs()).filter((d) => d.estControle);
    const fin = controles.reduce((max, d) => (d.pourLe > max ? d.pourLe : max), aujourdHui);
    // L'emploi du temps donne l'heure de chaque contrôle (cours de la matière ce jour-là).
    const cours = controles.length ? await api.emploiDuTemps(aujourdHui, fin) : [];
    return { controles, cours };
  }, []);

  const heures = useMemo(() => {
    const m = new Map<number, { debut: string; fin: string }>();
    if (!donnees) return m;
    const { parCours } = placerDevoirs(donnees.cours, donnees.controles);
    for (const c of donnees.cours) for (const d of parCours.get(c.id) ?? []) m.set(d.id, { debut: c.debut, fin: c.fin });
    return m;
  }, [donnees]);

  const debutGrille = lundiDeLaSemaine(mois);
  const finMois = ajouterJours(moisSuivant(mois, 1), -1);
  const nbSemaines = Math.ceil((ecartJours(debutGrille, finMois) + 1) / 7);
  const cases = Array.from({ length: nbSemaines * 7 }, (_, i) => ajouterJours(debutGrille, i));
  const controlesDuJour = (j: string) => donnees?.controles.filter((d) => d.pourLe === j) ?? [];
  const prochain = donnees?.controles[0];

  function exporter() {
    if (!donnees) return;
    const ics = genererIcs(evenementsControles(donnees.controles, donnees.cours, eleve?.prenom));
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `controles${eleve ? `-${eleve.prenom.toLowerCase()}` : ''}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="controles">
      <div className="cal-barre">
        <div className="cal-nav">
          <button className="bouton-secondaire" onClick={() => setMois(moisSuivant(mois, -1))} aria-label="Mois précédent">‹</button>
          <button className="bouton-secondaire" onClick={() => setMois(premierDuMois(aujourdHui))}>Ce mois-ci</button>
          <button className="bouton-secondaire" onClick={() => setMois(moisSuivant(mois, 1))} aria-label="Mois suivant">›</button>
          <h2 className="cal-titre premiere-majuscule">{fmt(mois, { month: 'long', year: 'numeric' })}</h2>
        </div>
        <button onClick={exporter} disabled={!donnees?.controles.length}>
          Exporter vers mon agenda (.ics)
        </button>
      </div>

      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      {!donnees && !erreur && <p className="discret">Chargement…</p>}

      {donnees && (
        <>
          {prochain ? (
            <p className="prochain-controle">
              Prochain contrôle : <strong>{prochain.matiere}</strong>,{' '}
              {fmt(prochain.pourLe, { weekday: 'long', day: 'numeric', month: 'long' })}{' '}
              <span className="badge badge-rouge">{dansNJours(ecartJours(aujourdHui, prochain.pourLe))}</span>
            </p>
          ) : (
            <p className="discret">Aucun contrôle annoncé pour le moment.</p>
          )}

          <div className="mois" role="grid">
            {['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'].map((j) => (
              <div key={j} className="mois-entete" role="columnheader">{j}</div>
            ))}
            {cases.map((j) => {
              const liste = controlesDuJour(j);
              const horsMois = j.slice(0, 7) !== mois.slice(0, 7);
              return (
                <div
                  key={j}
                  role="gridcell"
                  className={`mois-case ${horsMois ? 'hors-mois' : ''} ${j === aujourdHui ? 'aujourdhui' : ''} ${liste.length ? 'avec' : ''} ${j < aujourdHui ? 'passe' : ''}`}
                >
                  <div className="mois-num">{Number(j.slice(8))}</div>
                  {liste.map((d) => {
                    const h = heures.get(d.id);
                    return (
                      <button key={d.id} className="puce-controle" onClick={() => setOuvert(d)} title={d.matiere}>
                        {h && <span className="puce-heure">{heure(h.debut)}</span>} {d.matiere}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <p className="discret petit">
            EcoleDirecte ne liste que les contrôles à venir : les contrôles passés n'apparaissent pas ici.
            Le fichier .ics s'importe dans Google Agenda, Outlook ou le calendrier du téléphone ; l'heure est celle du
            cours de la matière ce jour-là.
          </p>
        </>
      )}
      {ouvert && <DetailDevoir devoir={ouvert} demain={demain} onFermer={() => setOuvert(null)} />}
    </div>
  );
}
