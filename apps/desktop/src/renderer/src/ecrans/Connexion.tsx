import { useEffect, useState, type FormEvent } from 'react';
import type { ResultatConnexion } from '@hibou/core';
import { api, lireErreur } from '../api';

type Qcm = Extract<ResultatConnexion, { etat: 'qcm' }>;

export function Connexion({ demo, onConnecte }: { demo: boolean; onConnecte: () => void }) {
  const [identifiant, setIdentifiant] = useState(demo ? 'demo' : '');
  const [motdepasse, setMotdepasse] = useState('');
  const [qcm, setQcm] = useState<Qcm | null>(null);
  const [choix, setChoix] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  /** Après un QCM réussi : proposer de mémoriser l'appareil. */
  const [proposerMemo, setProposerMemo] = useState(false);
  const [memorise, setMemorise] = useState(false);

  useEffect(() => {
    void api.appareilMemorise().then(setMemorise);
  }, []);

  async function traiter(promesse: Promise<ResultatConnexion>, apresEchecQcm = false) {
    setEnCours(true);
    setErreur('');
    try {
      const r = await promesse;
      if (r.etat === 'connecte') {
        setMotdepasse('');
        if (qcm && (await api.appareilEnAttente())) setProposerMemo(true);
        else onConnecte();
      } else {
        if (apresEchecQcm) setErreur('Réponse incorrecte. Une nouvelle question vous est posée.');
        setQcm(r);
        setChoix('');
      }
    } catch (e) {
      setErreur(lireErreur(e).message);
    } finally {
      setEnCours(false);
    }
  }

  function envoyer(e: FormEvent) {
    e.preventDefault();
    void traiter(api.connexion(identifiant.trim(), motdepasse));
  }

  function envoyerQcm(e: FormEvent) {
    e.preventDefault();
    if (choix) void traiter(api.repondreQcm(choix), true);
  }

  return (
    <div className="page-connexion">
      <div className="carte carte-connexion">
        <h1>
          <span aria-hidden>🦉</span> Hibou
        </h1>
        <p className="discret">Client non officiel pour EcoleDirecte</p>

        {proposerMemo ? (
          <div className="memo-appareil">
            <h2>Mémoriser cet ordinateur ?</h2>
            <p>
              EcoleDirecte ne posera plus la question de sécurité sur cet ordinateur. Hibou garde seulement le code
              de confirmation fourni par EcoleDirecte, chiffré par le trousseau du système. Votre mot de passe n'est
              jamais enregistré.
            </p>
            <button
              onClick={async () => {
                await api.memoriserAppareil();
                onConnecte();
              }}
            >
              Oui, mémoriser
            </button>
            <button className="bouton-secondaire" onClick={onConnecte}>
              Non, merci
            </button>
          </div>
        ) : !qcm ? (
          <form onSubmit={envoyer}>
            <label>
              Identifiant
              <input
                autoFocus
                autoComplete="username"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                required
              />
            </label>
            <label>
              Mot de passe
              <input
                type="password"
                autoComplete="current-password"
                value={motdepasse}
                onChange={(e) => setMotdepasse(e.target.value)}
                required
              />
            </label>
            {erreur && <p className="erreur" role="alert">{erreur}</p>}
            <button type="submit" disabled={enCours}>
              {enCours ? 'Connexion…' : 'Se connecter'}
            </button>
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
                Identifiant « qcm » pour tester la question de sécurité, mot de passe « faux » pour tester
                l'erreur.
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={envoyerQcm}>
            <p className="qcm-intro">
              EcoleDirecte demande de confirmer votre identité sur ce nouvel appareil.
            </p>
            <fieldset>
              <legend>{qcm.question}</legend>
              {qcm.propositions.map((p) => (
                <label key={p.valeur} className="choix">
                  <input
                    type="radio"
                    name="qcm"
                    value={p.valeur}
                    checked={choix === p.valeur}
                    onChange={() => setChoix(p.valeur)}
                  />
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
