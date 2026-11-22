import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ResultatConnexion } from '@hibou/core';
import type { EtatBiometrie } from '../../../preload/ipc';
import { api, lireErreur } from '../api';

type Qcm = Extract<ResultatConnexion, { etat: 'qcm' }>;
/** Étapes facultatives proposées après une connexion réussie. */
type Proposition = 'appareil' | 'biometrie' | null;

export function Connexion({ demo, onConnecte }: { demo: boolean; onConnecte: () => void }) {
  const [identifiant, setIdentifiant] = useState(demo ? 'demo' : '');
  const [motdepasse, setMotdepasse] = useState('');
  const [qcm, setQcm] = useState<Qcm | null>(null);
  const [choix, setChoix] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [proposition, setProposition] = useState<Proposition>(null);
  const [memorise, setMemorise] = useState(false);
  const [bio, setBio] = useState<EtatBiometrie | null>(null);
  /** L'utilisateur préfère le formulaire au déverrouillage biométrique. */
  const [formulaire, setFormulaire] = useState(false);
  const tentativeAuto = useRef(false);

  useEffect(() => {
    void api.appareilMemorise().then(setMemorise);
    void api.biometrie().then((b) => {
      setBio(b);
      // Une seule demande automatique à l'ouverture.
      if (b.active && !tentativeAuto.current) {
        tentativeAuto.current = true;
        void traiter(api.deverrouiller(), { biometrique: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Après une connexion : propositions facultatives (appareil, biométrie), puis l'appli. */
  async function apresConnexion(depuisQcm: boolean) {
    if (depuisQcm && (await api.appareilEnAttente())) return setProposition('appareil');
    await proposerBiometrieOuEntrer();
  }

  async function proposerBiometrieOuEntrer() {
    const b = await api.biometrie();
    setBio(b);
    if (b.proposer) setProposition('biometrie');
    else onConnecte();
  }

  async function traiter(promesse: Promise<ResultatConnexion>, o: { apresEchecQcm?: boolean; biometrique?: boolean } = {}) {
    setEnCours(true);
    setErreur('');
    try {
      const r = await promesse;
      if (r.etat === 'connecte') {
        setMotdepasse('');
        await apresConnexion(qcm !== null);
      } else {
        if (o.apresEchecQcm) setErreur('Réponse incorrecte. Une nouvelle question vous est posée.');
        setQcm(r);
        setChoix('');
      }
    } catch (e) {
      const err = lireErreur(e);
      setErreur(err.message);
      if (o.biometrique) {
        // Échec du déverrouillage : on garde le bouton biométrique si les identifiants existent encore.
        setBio(await api.biometrie());
      }
    } finally {
      setEnCours(false);
    }
  }

  const avecBiometrie = bio?.active && !formulaire && !qcm && !proposition;

  return (
    <div className="page-connexion">
      <div className="carte carte-connexion">
        <h1>
          <span aria-hidden>🦉</span> Hibou
        </h1>
        <p className="discret">Client non officiel pour EcoleDirecte</p>

        {proposition === 'appareil' ? (
          <div className="memo-appareil">
            <h2>Mémoriser cet ordinateur ?</h2>
            <p>
              EcoleDirecte ne posera plus la question de sécurité sur cet ordinateur. Hibou garde seulement le code
              de confirmation fourni par EcoleDirecte, chiffré par le trousseau du système.
            </p>
            <button
              onClick={async () => {
                await api.memoriserAppareil();
                await proposerBiometrieOuEntrer();
              }}
            >
              Oui, mémoriser
            </button>
            <button className="bouton-secondaire" onClick={() => void proposerBiometrieOuEntrer()}>
              Non, merci
            </button>
          </div>
        ) : proposition === 'biometrie' ? (
          <div className="memo-appareil">
            <h2>Ouvrir Hibou avec {bio?.nom} ?</h2>
            <p>
              La prochaine fois, {bio?.nom} suffira pour ouvrir Hibou. Votre mot de passe EcoleDirecte sera rangé,
              chiffré, dans le trousseau {bio?.nom === 'Touch ID' ? 'macOS' : 'Windows'}, et Hibou ne pourra le lire
              qu'après {bio?.nom}. Vous pourrez l'oublier à tout moment depuis l'écran de connexion.
            </p>
            {erreur && <p className="erreur" role="alert">{erreur}</p>}
            <button
              disabled={enCours}
              onClick={async () => {
                setEnCours(true);
                setErreur('');
                const ok = await api.activerBiometrie();
                setEnCours(false);
                if (ok) onConnecte();
                else setErreur(`${bio?.nom} n'a pas été confirmé. Réessayez, ou choisissez « Plus tard ».`);
              }}
            >
              {enCours ? 'Confirmation…' : `Activer ${bio?.nom}`}
            </button>
            <button
              className="bouton-secondaire"
              onClick={async () => {
                await api.ignorerBiometrie();
                onConnecte();
              }}
            >
              Plus tard
            </button>
          </div>
        ) : avecBiometrie ? (
          <div className="memo-appareil">
            <button className="bouton-biometrie" onClick={() => void traiter(api.deverrouiller(), { biometrique: true })} disabled={enCours}>
              <span aria-hidden>{bio?.nom === 'Touch ID' ? '☝️' : '🙂'}</span>
              {enCours ? 'Connexion…' : `Ouvrir avec ${bio?.nom}`}
            </button>
            {erreur && <p className="erreur" role="alert">{erreur}</p>}
            <button className="bouton-secondaire" onClick={() => setFormulaire(true)}>
              Utiliser le mot de passe
            </button>
            <button
              className="lien discret petit"
              onClick={async () => {
                await api.desactiverBiometrie();
                setBio(await api.biometrie());
                setErreur('');
              }}
            >
              Oublier le mot de passe enregistré
            </button>
          </div>
        ) : !qcm ? (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void traiter(api.connexion(identifiant.trim(), motdepasse));
            }}
          >
            <label>
              Identifiant
              <input autoFocus autoComplete="username" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} required />
            </label>
            <label>
              Mot de passe
              <input type="password" autoComplete="current-password" value={motdepasse} onChange={(e) => setMotdepasse(e.target.value)} required />
            </label>
            {erreur && <p className="erreur" role="alert">{erreur}</p>}
            <button type="submit" disabled={enCours}>
              {enCours ? 'Connexion…' : 'Se connecter'}
            </button>
            {bio?.active && (
              <button type="button" className="bouton-secondaire" onClick={() => { setFormulaire(false); setErreur(''); }}>
                Ouvrir avec {bio.nom}
              </button>
            )}
            {memorise && (
              <p className="aide-demo">
                Cet ordinateur est mémorisé pour éviter la question de sécurité.{' '}
                <button
                  type="button"
                  className="lien"
                  onClick={async () => {
                    await api.oublierAppareil();
                    setMemorise(false);
                  }}
                >
                  Oublier cet ordinateur
                </button>
              </p>
            )}
            {demo && (
              <p className="aide-demo">
                Mode démo : n'importe quel mot de passe fonctionne.
                <br />
                Identifiant « qcm » pour tester la question de sécurité, mot de passe « faux » pour tester l'erreur.
              </p>
            )}
          </form>
        ) : (
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (choix) void traiter(api.repondreQcm(choix), { apresEchecQcm: true });
            }}
          >
            <p className="qcm-intro">EcoleDirecte demande de confirmer votre identité sur ce nouvel appareil.</p>
            <fieldset>
              <legend>{qcm.question}</legend>
              {qcm.propositions.map((p) => (
                <label key={p.valeur} className="choix">
                  <input type="radio" name="qcm" value={p.valeur} checked={choix === p.valeur} onChange={() => setChoix(p.valeur)} />
                  {p.texte}
                </label>
              ))}
            </fieldset>
            {erreur && <p className="erreur" role="alert">{erreur}</p>}
            <button type="submit" disabled={enCours || !choix}>
              {enCours ? 'Vérification…' : 'Valider'}
            </button>
            <button
              type="button"
              className="bouton-secondaire"
              onClick={() => {
                setQcm(null);
                setErreur('');
                void api.deconnexion();
              }}
            >
              Annuler
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
