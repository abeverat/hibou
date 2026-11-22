import { ajouterJours, dateLocale, jourSemaine } from '@hibou/core';
import { api } from '../api';
import { heure, useCharge } from '../format';
import { BarreSemaine, GrilleSemaine, joursDeLaSemaine, useSemaine } from '../composants/GrilleSemaine';

export function EmploiDuTemps() {
  const aujourdHui = dateLocale();
  const { lundi, jourMobile, setJourMobile, decaler, revenir } = useSemaine(aujourdHui, ajouterJours, jourSemaine);
  const samedi = ajouterJours(lundi, 5);
  const [{ donnees: cours, erreur }] = useCharge(() => api.emploiDuTemps(lundi, samedi), [lundi]);
  const jours = joursDeLaSemaine(lundi, Boolean(cours?.some((c) => c.debut.startsWith(samedi))), ajouterJours);
  const maintenant = `${aujourdHui}T${new Date().toTimeString().slice(0, 5)}`;
  const nbAnnules = cours?.filter((c) => c.annule).length ?? 0;

  return (
    <div className="calendrier">
      <BarreSemaine
        lundi={lundi}
        dernierJour={jours[jours.length - 1]!}
        onDecaler={decaler}
        onAujourdhui={revenir}
        droite={nbAnnules > 0 && <span className="badge badge-rouge">{nbAnnules} cours annulé{nbAnnules > 1 ? 's' : ''}</span>}
      />
      {erreur && <p className="erreur" role="alert">{erreur}</p>}
      {!cours && !erreur && <p className="discret">Chargement…</p>}
      {cours && (
        <GrilleSemaine
          jours={jours}
          cours={cours}
          aujourdHui={aujourdHui}
          jourMobile={jourMobile}
          setJourMobile={setJourMobile}
          rendreCours={(c) => ({
            className: `plein edt ${c.debut <= maintenant && maintenant < c.fin ? 'en-cours' : ''}`,
            contenu: (
              <>
                <div className="cal-cours-titre">
                  <span className="cal-matiere">{c.matiere}</span>
                  {c.annule && <span className="badge badge-rouge">Annulé</span>}
                  {c.modifie && !c.annule && <span className="badge badge-orange">Modifié</span>}
                </div>
                <div className="cal-cours-info">
                  {heure(c.debut)}–{heure(c.fin)} · {c.salle}
                </div>
                <div className="cal-cours-info">{c.professeur}</div>
              </>
            ),
          })}
        />
      )}
    </div>
  );
}
