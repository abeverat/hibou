import { useEffect, useState } from 'react';
import type { Devoir, DevoirDetail } from '@hibou/core';
import { api, lireErreur } from '../api';
import { htmlSur } from '../html';
import { fmt } from '../format';

export function Badges({ d, demain }: { d: Devoir; demain: string }) {
  return (
    <>
      {d.estControle && <span className="badge badge-rouge">Contrôle</span>}
      {d.pourLe === demain && !d.effectue && <span className="badge badge-orange">Demain</span>}
    </>
  );
}

export function LigneDevoir({
  d, consigne, demain, onBasculer, onOuvrir, avecMatiere = false,
}: {
  d: Devoir;
  consigne?: string;
  demain: string;
  onBasculer: (d: Devoir) => void;
  onOuvrir: (d: Devoir) => void;
  avecMatiere?: boolean;
}) {
  return (
    <div className={`cal-devoir ${d.effectue ? 'fait' : ''}`}>
      <input
        type="checkbox"
        checked={d.effectue}
        onChange={() => onBasculer(d)}
        aria-label={`${d.estControle ? 'Contrôle' : 'Devoir'} de ${d.matiere} : ${d.effectue ? 'fait' : 'à faire'}`}
      />
      <button className={`lien ${d.estControle && !avecMatiere ? 'lien-controle' : ''}`} onClick={() => onOuvrir(d)}>
        {avecMatiere ? d.matiere : d.estControle ? 'Contrôle' : 'Devoir'}
      </button>
      {avecMatiere ? (
        <Badges d={d} demain={demain} />
      ) : (
        d.pourLe === demain && !d.effectue && <span className="badge badge-orange">Demain</span>
      )}
      {consigne && (
        <button className="cal-consigne" onClick={() => onOuvrir(d)} title={consigne}>
          {consigne}
        </button>
      )}
    </div>
  );
}

export function DetailDevoir({ devoir, demain, onFermer }: { devoir: Devoir; demain: string; onFermer: () => void }) {
  const [detail, setDetail] = useState<DevoirDetail | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api
      .devoirsDuJour(devoir.pourLe)
      .then((l) => {
        const trouve = l.find((x) => x.id === devoir.id);
        if (trouve) setDetail(trouve);
        else setErreur("Le détail de ce devoir n'est pas disponible.");
      })
      .catch((e) => setErreur(lireErreur(e).message));
  }, [devoir]);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [onFermer]);

  return (
    <div className="voile" onClick={onFermer}>
      <div className="carte panneau" role="dialog" aria-modal="true" aria-label={`Détail : ${devoir.matiere}`} onClick={(e) => e.stopPropagation()}>
        <div className="panneau-entete">
          <h2>
            {devoir.matiere} <Badges d={devoir} demain={demain} />
          </h2>
          <button className="bouton-secondaire" onClick={onFermer} aria-label="Fermer">✕</button>
        </div>
        <p className="discret">
          Pour le {fmt(devoir.pourLe, { weekday: 'long', day: 'numeric', month: 'long' })}
          {devoir.donneLe && <> · donné le {fmt(devoir.donneLe, { day: 'numeric', month: 'long' })}</>}
          {detail?.professeur && <> · {detail.professeur}</>}
        </p>
        {erreur && <p className="erreur">{erreur}</p>}
        {!detail && !erreur && <p className="discret">Chargement…</p>}
        {detail && (
          <>
            <div className="contenu-devoir" dangerouslySetInnerHTML={{ __html: htmlSur(detail.contenuHtml) }} />
            {detail.documents.length > 0 && (
              <div className="documents">
                <h3>Pièces jointes</h3>
                <ul>
                  {detail.documents.map((doc) => (
                    <li key={doc.id}>
                      📎 {doc.nom} <span className="discret">({Math.round(doc.taille / 1024)} Ko)</span>
                    </li>
                  ))}
                </ul>
                <p className="discret petit">Le téléchargement des pièces jointes arrivera avec la connexion réelle.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Coche / décoche avec mise à jour immédiate, annulée si EcoleDirecte refuse. */
export function useBasculerDevoir(
  majLocale: (id: number, effectue: boolean) => void,
  onErreur: (message: string) => void,
) {
  return async (d: Devoir) => {
    majLocale(d.id, !d.effectue);
    try {
      await api.marquerDevoir(d.id, !d.effectue);
    } catch (e) {
      majLocale(d.id, d.effectue);
      onErreur(lireErreur(e).message);
    }
  };
}
