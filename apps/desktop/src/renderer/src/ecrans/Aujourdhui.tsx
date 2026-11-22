/** Tableau de bord : cours du jour, devoirs pour le prochain jour de classe, prochain contrôle, dernières notes. */
import { useState } from 'react';
import { ajouterJours, dateLocale, ecartJours, type Devoir } from '@hibou/core';
import { api } from '../api';
import { dansNJours, fmt, heure, nombre, useCharge } from '../format';
import { DetailDevoir, LigneDevoir, useBasculerDevoir } from '../composants/Devoirs';

export function Aujourdhui({ onVoir }: { onVoir: (onglet: 'devoirs' | 'notes' | 'edt') => void }) {
  const aujourdHui = dateLocale();
  const maintenant = `${aujourdHui}T${new Date().toTimeString().slice(0, 5)}`;
  const [ouvert, setOuvert] = useState<Devoir | null>(null);
  const [erreurAction, setErreurAction] = useState('');

  const [{ donnees, erreur }, setEtat] = useCharge(async () => {
    const [cours, devoirs, releve] = await Promise.all([
      api.emploiDuTemps(aujourdHui, ajouterJours(aujourdHui, 10)),
      api.devoirs(),
      api.releve(),
    ]);
    return { cours, devoirs, releve };
  }, []);

  const basculer = useBasculerDevoir(
    (id, effectue) =>
      setEtat((e) => ({
        ...e,
        donnees: e.donnees && {
          ...e.donnees,
          devoirs: e.donnees.devoirs.map((d) => (d.id === id ? { ...d, effectue } : d)),
        },
      })),
    setErreurAction,
  );

  if (erreur) return <p className="erreur" role="alert">{erreur}</p>;
  if (!donnees) return <p className="discret">Chargement…</p>;
  const { cours, devoirs, releve } = donnees;

  // Jour de cours affiché : aujourd'hui s'il y a cours, sinon le prochain jour de classe.
  const joursDeCours = [...new Set(cours.map((c) => c.debut.slice(0, 10)))].sort();
  const jourCours = joursDeCours.includes(aujourdHui) ? aujourdHui : joursDeCours[0];
  const coursDuJour = cours.filter((c) => jourCours && c.debut.startsWith(jourCours));
  // Devoirs : pour le prochain jour de classe après aujourd'hui (demain en semaine, lundi le vendredi).
  const jourDevoirs = joursDeCours.find((j) => j > aujourdHui) ?? ajouterJours(aujourdHui, 1);
  const devoirsProchains = devoirs.filter((d) => d.pourLe === jourDevoirs);
  const nomJourDevoirs = ecartJours(aujourdHui, jourDevoirs) === 1 ? 'demain' : fmt(jourDevoirs, { weekday: 'long' });
  const controles = devoirs.filter((d) => d.estControle && !d.effectue);
  const prochain = controles[0];
  const dernieresNotes = [...releve.notes].sort((a, b) => b.dateSaisie.localeCompare(a.dateSaisie) || b.id - a.id).slice(0, 5);

  return (
    <div className="tableau-de-bord">
      {erreurAction && <p className="erreur" role="alert">{erreurAction}</p>}
      <h1 className="salutation premiere-majuscule">{fmt(aujourdHui, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>

      <div className="tdb-grille">
        <section className="carte tdb-cours">
          <div className="carte-titre">
            <h2>{jourCours === aujourdHui ? "Cours d'aujourd'hui" : jourCours ? `Prochains cours : ${fmt(jourCours, { weekday: 'long', day: 'numeric' })}` : 'Cours'}</h2>
            <button className="lien discret" onClick={() => onVoir('edt')}>Semaine →</button>
          </div>
          {coursDuJour.length === 0 ? (
            <p className="vide-grise">Pas de cours prévu dans les prochains jours.</p>
          ) : (
            <ol className="frise">
              {coursDuJour.map((c) => {
                const enCours = c.debut <= maintenant && maintenant < c.fin;
                const fini = c.fin <= maintenant;
                return (
                  <li
                    key={c.id}
                    className={`${enCours ? 'en-cours' : ''} ${fini ? 'fini' : ''} ${c.annule ? 'annule' : ''}`}
                    style={{ ['--couleur' as string]: c.couleur }}
                  >
                    <span className="frise-heure">{heure(c.debut)}</span>
                    <span className="frise-matiere">{c.matiere}</span>
                    <span className="discret">{c.salle}</span>
                    {enCours && <span className="badge badge-bleu">En cours</span>}
                    {c.annule && <span className="badge badge-rouge">Annulé</span>}
                    {c.modifie && !c.annule && <span className="badge badge-orange">Modifié</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="carte tdb-controle">
          <h2>Prochain contrôle</h2>
          {prochain ? (
            <button className="compte-a-rebours" onClick={() => setOuvert(prochain)}>
              <span className="rebours-nombre">{ecartJours(aujourdHui, prochain.pourLe)}</span>
              <span className="rebours-unite">jour{ecartJours(aujourdHui, prochain.pourLe) > 1 ? 's' : ''}</span>
              <span className="rebours-matiere">{prochain.matiere}</span>
              <span className="discret">
                {fmt(prochain.pourLe, { weekday: 'long', day: 'numeric', month: 'long' })} · {dansNJours(ecartJours(aujourdHui, prochain.pourLe))}
              </span>
            </button>
          ) : (
            <p className="vide-grise">Aucun contrôle annoncé.</p>
          )}
          {controles.length > 1 && (
            <button className="lien discret" onClick={() => onVoir('devoirs')}>
              {controles.length - 1} autre{controles.length > 2 ? 's' : ''} contrôle{controles.length > 2 ? 's' : ''} à venir →
            </button>
          )}
        </section>

        <section className="carte tdb-devoirs">
          <div className="carte-titre">
            <h2 className="premiere-majuscule">Pour {nomJourDevoirs}</h2>
            <button className="lien discret" onClick={() => onVoir('devoirs')}>Tous les devoirs →</button>
          </div>
          {devoirsProchains.length === 0 ? (
            <p className="vide-grise">Rien à faire pour {nomJourDevoirs}.</p>
          ) : (
            <div className="liste-devoirs">
              {devoirsProchains.map((d) => (
                <LigneDevoir key={d.id} d={d} demain={ajouterJours(aujourdHui, 1)} onBasculer={basculer} onOuvrir={setOuvert} avecMatiere />
              ))}
            </div>
          )}
        </section>

        <section className="carte tdb-notes">
          <div className="carte-titre">
            <h2>Dernières notes</h2>
            <button className="lien discret" onClick={() => onVoir('notes')}>Toutes les notes →</button>
          </div>
          {dernieresNotes.length === 0 ? (
            <p className="vide-grise">Aucune note pour le moment.</p>
          ) : (
            <ul className="liste">
              {dernieresNotes.map((n) => (
                <li key={n.id} className={n.nonSignificatif ? 'fait' : ''}>
                  <span className="note">
                    {n.valeurTexte || '—'}
                    {n.valeur != null && <span className="discret">/{nombre(n.noteSur)}</span>}
                  </span>
                  <span>
                    {n.matiere} <span className="discret">· {n.devoir}</span>
                    {n.moyenneClasse != null && <span className="discret"> · classe {nombre(n.moyenneClasse)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {ouvert && <DetailDevoir devoir={ouvert} demain={ajouterJours(aujourdHui, 1)} onFermer={() => setOuvert(null)} />}
    </div>
  );
}
