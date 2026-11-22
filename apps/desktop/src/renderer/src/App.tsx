import { useEffect, useState } from 'react';
import type { EtatSession } from '@hibou/core';
import { api } from './api';
import { Connexion } from './ecrans/Connexion';
import { Aujourdhui } from './ecrans/Aujourdhui';
import { EmploiDuTemps } from './ecrans/EmploiDuTemps';
import { CalendrierDevoirs } from './ecrans/CalendrierDevoirs';
import { Notes } from './ecrans/Notes';
import { Reglages } from './ecrans/Reglages';
import {
  IconeActualiser, IconeAujourdhui, IconeCadenas, IconeCalendrier, IconeDeconnexion, IconeDevoirs, IconeNotes, IconeReglages,
} from './composants/Icones';

const ONGLETS = [
  { id: 'aujourdhui', nom: "Aujourd'hui", Icone: IconeAujourdhui },
  { id: 'edt', nom: 'Emploi du temps', Icone: IconeCalendrier },
  { id: 'devoirs', nom: 'Devoirs & contrôles', Icone: IconeDevoirs },
  { id: 'notes', nom: 'Notes', Icone: IconeNotes },
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
      <aside className="barre-laterale">
        <div className="marque">
          <span className="logo" aria-hidden>🦉</span>
          <span className="libelle">Hibou</span>
          {session.demo && <span className="badge badge-demo libelle">Démo</span>}
        </div>
        {compte.eleves.length > 1 ? (
          // Deux variantes : « Prénom · classe » (barre large) et le prénom seul (barre réduite).
          (['complet', 'court'] as const).map((forme) => (
            <select
              key={forme}
              className={`choix-eleve ${forme}`}
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
                  {forme === 'complet' ? `${e.prenom} · ${e.classe}` : e.prenom}
                </option>
              ))}
            </select>
          ))
        ) : (
          <div className="eleve-nom libelle">{eleve?.prenom} · {eleve?.classe}</div>
        )}
        <nav className="navigation" aria-label="Sections">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              className={`element-nav ${onglet === o.id ? 'actif' : ''}`}
              aria-current={onglet === o.id ? 'page' : undefined}
              title={o.nom}
              onClick={() => setOnglet(o.id)}
            >
              <o.Icone />
              <span className="libelle">{o.nom}</span>
            </button>
          ))}
        </nav>
        <div className="barre-pied">
          <button
            className="element-nav"
            title="Recharger les données depuis EcoleDirecte"
            onClick={async () => {
              await api.actualiser();
              setVersion((v) => v + 1);
            }}
          >
            <IconeActualiser />
            <span className="libelle">Actualiser</span>
          </button>
          {bioActive && (
            <button
              className="element-nav"
              title="Verrouiller Hibou"
              onClick={async () => {
                await api.verrouiller();
                setVerrouille(await api.estVerrouille());
              }}
            >
              <IconeCadenas />
              <span className="libelle">Verrouiller</span>
            </button>
          )}
          <button className="element-nav" title={titreReglages} onClick={() => setReglagesOuverts(true)}>
            <IconeReglages />
            <span className="libelle">{titreReglages}</span>
          </button>
          <button
            className="element-nav"
            title="Déconnexion"
            onClick={async () => {
              await api.deconnexion();
              setSession(await api.etat());
            }}
          >
            <IconeDeconnexion />
            <span className="libelle">Déconnexion</span>
          </button>
        </div>
      </aside>
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
