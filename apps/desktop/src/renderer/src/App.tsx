import { useEffect, useState } from 'react';
import type { EtatSession } from '@hibou/core';
import { api } from './api';
import { Connexion } from './ecrans/Connexion';
import { Aujourdhui } from './ecrans/Aujourdhui';
import { EmploiDuTemps } from './ecrans/EmploiDuTemps';
import { CalendrierDevoirs } from './ecrans/CalendrierDevoirs';
import { Controles } from './ecrans/Controles';
import { Notes } from './ecrans/Notes';

const ONGLETS = [
  { id: 'aujourdhui', nom: "Aujourd'hui" },
  { id: 'edt', nom: 'Emploi du temps' },
  { id: 'devoirs', nom: 'Devoirs & contrôles' },
  { id: 'controles', nom: 'Calendrier des contrôles' },
  { id: 'notes', nom: 'Notes' },
] as const;
type Onglet = (typeof ONGLETS)[number]['id'];

export function App() {
  const [session, setSession] = useState<EtatSession | null>(null);
  /** Incrémenté par « Actualiser » et au changement d'enfant pour recharger l'écran. */
  const [version, setVersion] = useState(0);
  const [onglet, setOnglet] = useState<Onglet>('aujourdhui');

  useEffect(() => {
    void api.etat().then(setSession);
  }, []);

  if (!session) return <div className="chargement-page">Chargement…</div>;

  if (!session.compte) {
    return (
      <Connexion
        demo={session.demo}
        onConnecte={() => {
          setOnglet('aujourdhui');
          void api.etat().then(setSession);
        }}
      />
    );
  }

  const { compte, idEleve } = session;
  const eleve = compte.eleves.find((e) => e.id === idEleve);
  const cle = `${idEleve}-${version}`;

  return (
    <div className="appli">
      <header className="entete">
        <div className="marque">
          <span className="logo" aria-hidden>🦉</span> Hibou
          {session.demo && <span className="badge badge-demo">Démo</span>}
        </div>
        <div className="entete-actions">
          {compte.eleves.length > 1 ? (
            <select
              aria-label="Enfant"
              value={idEleve ?? ''}
              onChange={async (e) => {
                await api.choisirEleve(Number(e.target.value));
                setSession(await api.etat());
                setVersion((v) => v + 1);
              }}
            >
              {compte.eleves.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.prenom} · {e.classe}
                </option>
              ))}
            </select>
          ) : (
            <span className="eleve-nom">{eleve?.prenom} · {eleve?.classe}</span>
          )}
          <button
            className="bouton-secondaire"
            title="Recharger les données depuis EcoleDirecte"
            onClick={async () => {
              await api.actualiser();
              setVersion((v) => v + 1);
            }}
          >
            Actualiser
          </button>
          <button
            className="bouton-secondaire"
            onClick={async () => {
              await api.deconnexion();
              setSession(await api.etat());
            }}
          >
            Déconnexion
          </button>
        </div>
      </header>
      <nav className="onglets" aria-label="Sections">
        {ONGLETS.map((o) => (
          <button key={o.id} className={onglet === o.id ? 'actif' : ''} aria-current={onglet === o.id ? 'page' : undefined} onClick={() => setOnglet(o.id)}>
            {o.nom}
          </button>
        ))}
      </nav>
      <main className="contenu">
        {onglet === 'aujourdhui' && <Aujourdhui key={cle} onVoir={setOnglet} />}
        {onglet === 'edt' && <EmploiDuTemps key={cle} />}
        {onglet === 'devoirs' && <CalendrierDevoirs key={cle} />}
        {onglet === 'controles' && <Controles key={cle} eleve={eleve} />}
        {onglet === 'notes' && <Notes key={cle} />}
      </main>
    </div>
  );
}
