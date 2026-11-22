import { useEffect, useState } from 'react';
import type { EtatSession } from '@hibou/core';
import { api } from './api';
import { Connexion } from './ecrans/Connexion';
import { Aujourdhui } from './ecrans/Aujourdhui';
import { EmploiDuTemps } from './ecrans/EmploiDuTemps';
import { CalendrierDevoirs } from './ecrans/CalendrierDevoirs';
import { Notes } from './ecrans/Notes';
import { Reglages } from './ecrans/Reglages';

const ONGLETS = [
  { id: 'aujourdhui', nom: "Aujourd'hui" },
  { id: 'edt', nom: 'Emploi du temps' },
  { id: 'devoirs', nom: 'Devoirs & contrôles' },
  { id: 'notes', nom: 'Notes' },
] as const;
type Onglet = (typeof ONGLETS)[number]['id'];

export function App() {
  const [session, setSession] = useState<EtatSession | null>(null);
  /** Incrémenté par « Actualiser » et au changement d'enfant pour recharger l'écran. */
  const [version, setVersion] = useState(0);
  const [onglet, setOnglet] = useState<Onglet>('aujourdhui');
  const [verrouille, setVerrouille] = useState(false);
  const [bioActive, setBioActive] = useState(false);
  const [reglagesOuverts, setReglagesOuverts] = useState(false);
  /** Libellé natif (« Réglages », « Paramètres », « Settings »…) selon la langue du système. */
  const [titreReglages, setTitreReglages] = useState('Réglages');

  useEffect(() => {
    void api.etat().then(setSession);
    void api.estVerrouille().then(setVerrouille);
    void api.reglages().then((r) => setTitreReglages(r.libelles.reglages));
    const fin1 = api.onVerrouillage(() => {
      setReglagesOuverts(false);
      setVerrouille(true);
    });
    const fin2 = api.onReglages(() => setReglagesOuverts(true));
    return () => {
      fin1();
      fin2();
    };
  }, []);

  const majBiometrie = () => void api.biometrie().then((b) => setBioActive(b.active));

  // Bouton « Verrouiller » seulement si la biométrie est active (sinon impossible de rouvrir).
  useEffect(() => {
    if (session?.compte) majBiometrie();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.compte]);

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
          {bioActive && (
            <button
              className="bouton-secondaire"
              title="Verrouiller Hibou (déverrouillage biométrique)"
              onClick={async () => {
                await api.verrouiller();
                setVerrouille(await api.estVerrouille());
              }}
            >
              🔒 Verrouiller
            </button>
          )}
          <button className="bouton-secondaire bouton-icone" title={titreReglages} aria-label={titreReglages} onClick={() => setReglagesOuverts(true)}>
            <IconeReglages />
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
        <div className="onglets-capsule">
        {ONGLETS.map((o) => (
          <button key={o.id} className={onglet === o.id ? 'actif' : ''} aria-current={onglet === o.id ? 'page' : undefined} onClick={() => setOnglet(o.id)}>
            {o.nom}
          </button>
        ))}
        </div>
      </nav>
      <main className="contenu">
        {onglet === 'aujourdhui' && <Aujourdhui key={cle} onVoir={setOnglet} />}
        {onglet === 'edt' && <EmploiDuTemps key={cle} />}
        {onglet === 'devoirs' && <CalendrierDevoirs key={cle} eleve={eleve} />}
        {onglet === 'notes' && <Notes key={cle} />}
      </main>
      {reglagesOuverts && !verrouille && (
        <Reglages titre={titreReglages} onFermer={() => setReglagesOuverts(false)} onChange={majBiometrie} />
      )}
      {verrouille && (
        <Verrou
          onDeverrouille={() => {
            setVerrouille(false);
            setVersion((v) => v + 1);
          }}
          onDeconnecte={async () => {
            await api.deconnexion();
            setVerrouille(false);
            setSession(await api.etat());
          }}
        />
      )}
    </div>
  );
}

/** Voile opaque : le contenu n'est plus lisible tant que la biométrie n'a pas été confirmée. */
function Verrou({ onDeverrouille, onDeconnecte }: { onDeverrouille: () => void; onDeconnecte: () => void }) {
  const [nom, setNom] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    void api.biometrie().then((b) => setNom(b.nom));
  }, []);

  async function deverrouiller() {
    setEnCours(true);
    setErreur('');
    const ok = await api.deverrouillerSession();
    setEnCours(false);
    if (ok) onDeverrouille();
    else setErreur('Vérification annulée.');
  }

  return (
    <div className="voile-verrou" role="dialog" aria-modal="true" aria-label="Hibou est verrouillé">
      <div className="carte carte-connexion memo-appareil">
        <h1>
          <span aria-hidden>🔒</span> Hibou est verrouillé
        </h1>
        <button className="bouton-biometrie" autoFocus disabled={enCours} onClick={() => void deverrouiller()}>
          {enCours ? 'Vérification…' : `Déverrouiller avec ${nom ?? 'la biométrie'}`}
        </button>
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
        <button className="bouton-secondaire" onClick={onDeconnecte}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

/** Roue dentée (contour), à la taille du texte des boutons voisins. */
function IconeReglages() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
