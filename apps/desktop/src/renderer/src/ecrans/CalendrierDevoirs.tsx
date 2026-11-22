/**
 * Devoirs et contrôles en vue calendrier : chaque devoir est posé sur le cours de sa matière
 * le jour de l'échéance (emploi du temps EcoleDirecte). Les cours sans rien à faire sont grisés.
 */
import { useEffect, useMemo, useState } from 'react';
import { ajouterJours, dateLocale, jourSemaine, placerDevoirs, type Cours, type Devoir } from '@hibou/core';
import { api, lireErreur } from '../api';
import { texteBrut } from '../html';
import { heure } from '../format';
import { BarreSemaine, GrilleSemaine, joursDeLaSemaine, useSemaine } from '../composants/GrilleSemaine';
import { DetailDevoir, LigneDevoir, useBasculerDevoir } from '../composants/Devoirs';

interface Donnees {
  cours: Cours[];
  devoirs: Devoir[];
}

export function CalendrierDevoirs() {
  const aujourdHui = dateLocale();
  const demain = ajouterJours(aujourdHui, 1);
  const { lundi, jourMobile, setJourMobile, decaler, revenir } = useSemaine(aujourdHui, ajouterJours, jourSemaine);
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState('');
  const [ouvert, setOuvert] = useState<Devoir | null>(null);
  /** Début de la consigne de chaque devoir, chargé après l'affichage de la semaine. */
  const [consignes, setConsignes] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    let annule = false;
    setDonnees(null);
    setErreur('');
    setConsignes(new Map());
    const samedi = ajouterJours(lundi, 5);
    // La liste EcoleDirecte ne contient que les devoirs à venir : pour les jours déjà passés
    // de la semaine affichée, on lit le cahier de texte jour par jour.
    const joursPasses = [0, 1, 2, 3, 4, 5].map((i) => ajouterJours(lundi, i)).filter((j) => j < aujourdHui);
    Promise.all([
      api.emploiDuTemps(lundi, samedi),
      api.devoirs(),
      Promise.all(joursPasses.map((j) => api.devoirsDuJour(j))),
    ])
      .then(([cours, aVenir, passes]) => {
        if (annule) return;
        const devoirs = [...passes.flat(), ...aVenir].filter((d) => d.pourLe >= lundi && d.pourLe <= samedi);
        setDonnees({ cours, devoirs });
        // Les consignes demandent une requête par jour : on les charge ensuite, sans bloquer l'affichage.
        const joursAvecDevoirs = [...new Set(devoirs.map((d) => d.pourLe))].filter((j) => !joursPasses.includes(j));
        return Promise.all(joursAvecDevoirs.map((j) => api.devoirsDuJour(j).catch(() => []))).then((details) => {
          if (annule) return;
          const m = new Map<number, string>();
          for (const d of [...passes.flat(), ...details.flat()]) m.set(d.id, texteBrut(d.contenuHtml));
          setConsignes(m);
        });
      })
      .catch((e) => !annule && setErreur(lireErreur(e).message));
    return () => {
      annule = true;
    };
  }, [lundi, aujourdHui]);

  const samedi = ajouterJours(lundi, 5);
  const jours = joursDeLaSemaine(
    lundi,
    Boolean(donnees?.cours.some((c) => c.debut.startsWith(samedi)) || donnees?.devoirs.some((d) => d.pourLe === samedi)),
    ajouterJours,
  );
  const placement = useMemo(() => placerDevoirs(donnees?.cours ?? [], donnees?.devoirs ?? []), [donnees]);

  const basculer = useBasculerDevoir(
    (id, effectue) =>
      setDonnees((x) => x && { ...x, devoirs: x.devoirs.map((y) => (y.id === id ? { ...y, effectue } : y)) }),
    setErreur,
  );

  const nbControles = donnees?.devoirs.filter((d) => d.estControle).length ?? 0;
  const nbDevoirs = (donnees?.devoirs.length ?? 0) - nbControles;
  const ligne = (d: Devoir, avecMatiere = false) => (
    <LigneDevoir
      key={d.id} d={d} consigne={consignes.get(d.id)} demain={demain}
      onBasculer={basculer} onOuvrir={setOuvert} avecMatiere={avecMatiere}
    />
  );

  return (
    <div className="calendrier">
      <BarreSemaine
        lundi={lundi}
        dernierJour={jours[jours.length - 1]!}
        onDecaler={decaler}
        onAujourdhui={revenir}
        droite={
          donnees && (
            <>
              <span className="badge badge-rouge">{nbControles} contrôle{nbControles > 1 ? 's' : ''}</span>
              <span className="badge">{nbDevoirs} devoir{nbDevoirs > 1 ? 's' : ''}</span>
            </>
          )
        }
      />
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      {!donnees && !erreur && <p className="discret">Chargement…</p>}
      {donnees && (
        <GrilleSemaine
          jours={jours}
          cours={donnees.cours}
          aujourdHui={aujourdHui}
          jourMobile={jourMobile}
          setJourMobile={setJourMobile}
          avantColonne={(jour) => {
            const sans = placement.sansCreneau.get(jour) ?? [];
            return (
              sans.length > 0 && (
                <div className="cal-sans-creneau">
                  <div className="discret petit">Sans cours ce jour-là</div>
                  {sans.map((d) => ligne(d, true))}
                </div>
              )
            );
          }}
          rendreCours={(c) => {
            const devoirs = placement.parCours.get(c.id) ?? [];
            const vide = devoirs.length === 0;
            return {
              className: `${vide ? 'vide' : 'plein'} ${devoirs.some((d) => d.estControle) ? 'avec-controle' : ''}`,
              contenu: (
                <>
                  <div className="cal-cours-titre">
                    <span className="cal-matiere">{c.matiere}</span>
                    {c.annule && <span className="badge badge-rouge">Annulé</span>}
                  </div>
                  <div className="cal-cours-info">
                    {heure(c.debut)}–{heure(c.fin)} · {c.salle}
                  </div>
                  {vide ? <div className="cal-rien">Rien à faire</div> : devoirs.map((d) => ligne(d))}
                </>
              ),
            };
          }}
        />
      )}
      {ouvert && <DetailDevoir devoir={ouvert} demain={demain} onFermer={() => setOuvert(null)} />}
    </div>
  );
}
