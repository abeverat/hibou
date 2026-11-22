import { useEffect, useState, type FormEvent } from 'react';
import type { EtatReglages } from '../../../preload/ipc';
import { api, lireErreur } from '../api';

/** Panneau Réglages : déverrouillage biométrique (activable après « Plus tard ») et appareil mémorisé. */
export function Reglages({ titre, onFermer, onChange }: { titre: string; onFermer: () => void; onChange: () => void }) {
  const [etat, setEtat] = useState<EtatReglages | null>(null);
  const [motdepasse, setMotdepasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const recharger = async () => {
    setEtat(await api.reglages());
    onChange();
  };

  useEffect(() => {
    void api.reglages().then(setEtat);
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [onFermer]);

  async function activer(e: FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setMessage(null);
    try {
      const ok = await api.activerBiometrie(motdepasse);
      setMotdepasse('');
      setMessage(ok ? { ok: true, texte: `${nom} est activé.` } : { ok: false, texte: `${nom} n'a pas été confirmé.` });
      await recharger();
    } catch (err) {
      setMessage({ ok: false, texte: lireErreur(err).message });
    } finally {
      setEnCours(false);
    }
  }

  const nom = etat?.biometrie.nom;

  return (
    <div className="voile-reglages" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div className="carte panneau-reglages" role="dialog" aria-modal="true" aria-labelledby="titre-reglages">
        <div className="panneau-entete">
          <h2 id="titre-reglages">{titre}</h2>
          <button className="bouton-secondaire" onClick={onFermer} aria-label="Fermer">
            ✕
          </button>
        </div>
        {!etat ? (
          <p className="discret">Chargement…</p>
        ) : (
          <>
            <section>
              <h3>Déverrouillage biométrique</h3>
              {!nom ? (
                <p className="discret">Ni Touch ID ni Windows Hello n'est disponible sur cet ordinateur.</p>
              ) : etat.biometrie.active ? (
                <>
                  <p>
                    <span className="badge badge-ok">Activé</span> Hibou s'ouvre avec {nom}. Le mot de passe est chiffré
                    dans le trousseau du système.
                  </p>
                  <button
                    className="bouton-secondaire"
                    onClick={async () => {
                      await api.desactiverBiometrie();
                      setMessage({ ok: true, texte: 'Mot de passe enregistré effacé.' });
                      await recharger();
                    }}
                  >
                    Désactiver {nom} et effacer le mot de passe enregistré
                  </button>
                </>
              ) : (
                <form onSubmit={activer}>
                  <p className="discret">
                    Ouvrir Hibou avec {nom} au lieu du mot de passe. Pour l'activer, confirmez le mot de passe
                    EcoleDirecte de <strong>{etat.identifiant}</strong> : il sera chiffré dans le trousseau du système et
                    lisible seulement après {nom}.
                  </p>
                  <label>
                    Mot de passe EcoleDirecte
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={motdepasse}
                      onChange={(e) => setMotdepasse(e.target.value)}
                      required
                    />
                  </label>
                  <button type="submit" disabled={enCours || !motdepasse}>
                    {enCours ? 'Confirmation…' : `Activer ${nom}`}
                  </button>
                </form>
              )}
              {message && (
                <p className={message.ok ? 'succes' : 'erreur'} role="status">
                  {message.texte}
                </p>
              )}
            </section>
            {etat.appareilMemorise && (
              <section>
                <h3>Cet ordinateur</h3>
                <p className="discret">Mémorisé auprès d'EcoleDirecte : la question de sécurité n'est plus posée.</p>
                <button
                  className="bouton-secondaire"
                  onClick={async () => {
                    await api.oublierAppareil();
                    await recharger();
                  }}
                >
                  Oublier cet ordinateur
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
