/**
 * Notes : moyennes publiées par EcoleDirecte (calcul local seulement si le site n'en publie pas),
 * graphique d'évolution et simulateur de note fictive.
 */
import { Fragment, useMemo, useState, type FormEvent } from 'react';
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  bilanPeriode, dateLocale, evolutionMoyennes, notesDePeriode, type Note, type Releve,
} from '@hibou/core';
import { api } from '../api';
import { fmt, moy, nombre, useCharge } from '../format';

function periodeParDefaut(releve: Releve, aujourdHui: string) {
  const trimestres = releve.periodes.filter((p) => !p.annuelle);
  const enCours = trimestres.find((p) => p.debut <= aujourdHui && aujourdHui <= p.fin);
  const avecNotes = trimestres.filter((p) => releve.notes.some((n) => n.codePeriode === p.code));
  return (enCours ?? avecNotes[avecNotes.length - 1] ?? releve.periodes[0])?.code ?? '';
}

export function Notes() {
  const [{ donnees: releve, erreur }] = useCharge(() => api.releve(), []);
  if (erreur) return <p className="erreur" role="alert">{erreur}</p>;
  if (!releve) return <p className="discret">Chargement…</p>;
  if (releve.notes.length === 0 && releve.periodes.length === 0) return <p className="vide-grise">Aucune note pour le moment.</p>;
  return <VueNotes releve={releve} />;
}

let idFictif = -1;

function VueNotes({ releve }: { releve: Releve }) {
  const aujourdHui = dateLocale();
  const [code, setCode] = useState(() => periodeParDefaut(releve, aujourdHui));
  const [fictives, setFictives] = useState<Note[]>([]);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const aff = releve.affichage;

  const reel = useMemo(() => bilanPeriode(releve, code), [releve, code]);
  const simule = useMemo(
    () => (fictives.length ? bilanPeriode(releve, code, fictives) : null),
    [releve, code, fictives],
  );
  const bilan = simule ?? reel;
  if (!bilan || !reel) return null;
  const periode = bilan.periode;

  return (
    <div className="notes">
      <div className="onglets-periodes" role="tablist">
        {releve.periodes.map((p) => (
          <button
            key={p.code}
            role="tab"
            aria-selected={p.code === code}
            className={p.code === code ? 'actif' : ''}
            onClick={() => {
              setCode(p.code);
              setFictives([]);
            }}
          >
            {p.nom}
          </button>
        ))}
      </div>

      <div className="notes-haut">
        {aff.moyenneGenerale && aff.moyenneEleve && (
          <section className="carte moyenne-generale">
            <div className="discret">Moyenne générale · {periode.nom}</div>
            <div className="hero-nombre">{moy(bilan.generale.affichee)}</div>
            {simule ? (
              <div className="simulation-ecart">
                avec les notes fictives (réelle : {moy(reel.generale.affichee)}
                {reel.generale.affichee != null && bilan.generale.affichee != null && (
                  <> ; {ecart(bilan.generale.affichee - reel.generale.affichee)}</>
                )}
                )
              </div>
            ) : (
              <div className="discret petit">
                {bilan.generale.officielle != null
                  ? 'Moyenne publiée par EcoleDirecte'
                  : bilan.generale.affichee != null
                    ? "Calculée par Hibou : l'établissement n'a pas encore publié de moyenne"
                    : 'Pas encore de note sur cette période'}
                {bilan.generale.ecartAvecOfficielle && <> · notre calcul donne {moy(bilan.generale.calculee)}</>}
              </div>
            )}
            {bilan.generale.classe != null && <div className="discret">Moyenne de la classe : {moy(bilan.generale.classe)}</div>}
          </section>
        )}
        <section className="carte graphique">
          <Graphique releve={releve} code={code} fictives={fictives} />
        </section>
      </div>

      <section className="carte">
        <div className="carte-titre">
          <h2>Matières</h2>
          <span className="discret petit">Cliquez sur une matière pour voir le détail des notes</span>
        </div>
        <table className="table-matieres">
          <thead>
            <tr>
              <th scope="col">Matière</th>
              {aff.coefficientMatiere && <th scope="col" className="num">Coef.</th>}
              <th scope="col">Notes</th>
              {aff.moyenneEleve && <th scope="col" className="num">Moyenne</th>}
              {aff.moyenneClasse && <th scope="col" className="num">Classe</th>}
              {aff.moyenneMinMax && <th scope="col" className="num">Min – max</th>}
            </tr>
          </thead>
          <tbody>
            {bilan.matieres.map((m) => {
              const sansNote = m.notes.length === 0;
              const reelle = reel.matieres.find((x) => x.code === m.code);
              const change = simule && reelle && m.affichee != null && reelle.affichee !== m.affichee;
              return (
                <Fragment key={m.code}>
                  <tr
                    className={`ligne-matiere ${sansNote ? 'grise' : ''} ${ouverte === m.code ? 'ouverte' : ''}`}
                    onClick={() => setOuverte(ouverte === m.code ? null : m.code)}
                  >
                    <th scope="row">
                      {m.nom}
                      {m.professeurs[0] && <div className="discret petit">{m.professeurs.join(', ')}</div>}
                    </th>
                    {aff.coefficientMatiere && <td className="num discret">{nombre(m.coef)}</td>}
                    <td>
                      {sansNote ? (
                        <span className="discret">Aucune note</span>
                      ) : (
                        <div className="puces-notes">
                          {m.notes.map((n) => <PuceNote key={n.id} n={n} coef={aff.coefficientNote} />)}
                        </div>
                      )}
                    </td>
                    {aff.moyenneEleve && (
                      <td className="num">
                        <strong>{moy(m.affichee)}</strong>
                        {change && reelle && <div className="simulation-ecart petit">{ecart(m.affichee! - (reelle.affichee ?? m.affichee!))}</div>}
                        {!simule && m.ecartAvecOfficielle && (
                          <div className="discret petit" title="La moyenne affichée est celle d'EcoleDirecte">calcul : {moy(m.calculee)}</div>
                        )}
                        {!simule && m.officielle == null && m.calculee != null && (
                          <div className="discret petit" title="L'établissement n'a pas publié cette moyenne">calculée</div>
                        )}
                      </td>
                    )}
                    {aff.moyenneClasse && <td className="num discret">{moy(m.moyenneClasse)}</td>}
                    {aff.moyenneMinMax && (
                      <td className="num discret">
                        {m.moyenneMin == null ? '—' : `${moy(m.moyenneMin)} – ${moy(m.moyenneMax)}`}
                      </td>
                    )}
                  </tr>
                  {ouverte === m.code && !sansNote && (
                    <tr className="detail-notes">
                      <td colSpan={6}>
                        <table>
                          <tbody>
                            {[...m.notes].reverse().map((n) => (
                              <tr key={n.id} className={n.valeur == null || n.nonSignificatif ? 'grise' : ''}>
                                <td>{fmt(n.date, { day: 'numeric', month: 'short' })}</td>
                                <td>
                                  {n.devoir}
                                  {n.type && <span className="discret"> · {n.type.toLowerCase()}</span>}
                                  {n.nonSignificatif && <span className="badge">non significative</span>}
                                  {n.id < 0 && <span className="badge badge-bleu">fictive</span>}
                                </td>
                                <td className="num">
                                  <strong>{n.valeurTexte}</strong>
                                  {n.valeur != null && <span className="discret">/{nombre(n.noteSur)}</span>}
                                </td>
                                {aff.coefficientNote && <td className="num discret">coef {nombre(n.coef)}</td>}
                                <td className="num discret">{n.moyenneClasse != null && <>classe {nombre(n.moyenneClasse)}</>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </section>

      <Simulateur
        matieres={bilan.matieres.map((m) => ({ code: m.code, nom: m.nom }))}
        codePeriode={periode.annuelle ? (releve.periodes.find((p) => !p.annuelle && p.debut <= aujourdHui && aujourdHui <= p.fin)?.code ?? code) : code}
        fictives={fictives}
        onAjouter={(n) => setFictives((f) => [...f, n])}
        onRetirer={(id) => setFictives((f) => f.filter((x) => x.id !== id))}
        onVider={() => setFictives([])}
      />
    </div>
  );
}

const ecart = (x: number) => `${x >= 0 ? '+' : '−'}${moy(Math.abs(x))}`;

function PuceNote({ n, coef }: { n: Note; coef: boolean }) {
  const ns = n.valeur == null || n.nonSignificatif;
  const info = `${n.devoir} · ${fmt(n.date, { day: 'numeric', month: 'long' })}${coef ? ` · coef ${nombre(n.coef)}` : ''}${
    n.nonSignificatif ? ' · non significative' : ''
  }${n.moyenneClasse != null ? ` · classe ${nombre(n.moyenneClasse)}` : ''}`;
  return (
    <span className={`puce-note ${ns ? 'grise' : ''} ${n.id < 0 ? 'fictive' : ''}`} title={info}>
      {n.valeurTexte || '—'}
      {n.valeur != null && n.noteSur !== 20 && <sub>/{nombre(n.noteSur)}</sub>}
      {coef && n.valeur != null && n.coef !== 1 && <sup>×{nombre(n.coef)}</sup>}
    </span>
  );
}

const LIBELLES: Record<string, string> = {
  note: 'Notes (ramenées sur 20)',
  eleve: "Moyenne de l'élève",
  classe: 'Moyenne de la classe',
};

/** Évolution : chaque note (sur 20), la moyenne de l'élève et celle de la classe à cette date. */
function Graphique({ releve, code, fictives }: { releve: Releve; code: string; fictives: Note[] }) {
  const periode = releve.periodes.find((p) => p.code === code)!;
  const [filtre, setFiltre] = useState('');
  const toutes = [...notesDePeriode(releve, periode), ...fictives];
  const matieres = [...new Map(toutes.map((n) => [n.codeMatiere, n.matiere])).entries()];
  const coefMatiere = new Map(periode.matieres.map((m) => [m.code, m.coef]));
  const arr = (x: number | null) => (x == null ? null : Math.round(x * 100) / 100);

  const points = evolutionMoyennes(toutes, coefMatiere, filtre || undefined)
    .filter((p) => p.noteSur20 != null)
    .map((p) => ({
      date: p.date,
      note: arr(p.noteSur20),
      eleve: arr(p.eleve),
      classe: arr(p.classe),
      libelle: `${p.note.matiere} · ${p.note.devoir}${p.note.id < 0 ? ' (fictive)' : ''}`,
    }));
  const avecClasse = releve.affichage.moyenneClasse && points.some((p) => p.classe != null);
  const portee = filtre ? ' en ' + (matieres.find(([c]) => c === filtre)?.[1] ?? '') : ' générale';

  return (
    <>
      <div className="carte-titre">
        <h2>Évolution</h2>
        <select value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Matière du graphique">
          <option value="">Moyenne générale</option>
          {matieres.map(([c, nom]) => (
            <option key={c} value={c}>{nom}</option>
          ))}
        </select>
      </div>
      {points.length === 0 ? (
        <p className="vide-grise">Pas de note chiffrée sur cette période.</p>
      ) : (
        <div className="graphique-zone">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--bord)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => fmt(d, { day: 'numeric', month: 'short' })}
                stroke="var(--discret)"
                tick={{ fontSize: 12 }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis domain={[0, 20]} ticks={[0, 5, 10, 15, 20]} stroke="var(--discret)" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--bord)', borderRadius: 8, color: 'var(--texte)' }}
                labelFormatter={(d, p) => `${fmt(String(d), { day: 'numeric', month: 'long' })} · ${p?.[0]?.payload?.libelle ?? ''}`}
                formatter={(v, nom) => [moy(Number(v)), nom === 'note' ? 'Note (sur 20)' : LIBELLES[String(nom)] + (nom === 'note' ? '' : portee)]}
              />
              <Legend formatter={(v) => <span style={{ color: 'var(--texte)' }}>{LIBELLES[String(v)]}</span>} />
              <Line dataKey="note" stroke="var(--serie-notes)" strokeWidth={0} dot={{ r: 4, fill: 'var(--serie-notes)', stroke: 'var(--surface)', strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
              <Line dataKey="eleve" stroke="var(--serie-moyenne)" strokeWidth={2} dot={false} type="monotone" isAnimationActive={false} />
              {avecClasse && (
                <Line dataKey="classe" stroke="var(--serie-classe)" strokeWidth={2} strokeDasharray="5 4" dot={false} type="monotone" connectNulls isAnimationActive={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

function Simulateur({
  matieres, codePeriode, fictives, onAjouter, onRetirer, onVider,
}: {
  matieres: { code: string; nom: string }[];
  codePeriode: string;
  fictives: Note[];
  onAjouter: (n: Note) => void;
  onRetirer: (id: number) => void;
  onVider: () => void;
}) {
  const [matiere, setMatiere] = useState(matieres[0]?.code ?? '');
  const [valeur, setValeur] = useState('');
  const [sur, setSur] = useState('20');
  const [coef, setCoef] = useState('1');
  const [erreur, setErreur] = useState('');
  const lire = (s: string) => Number(s.replace(',', '.'));

  function ajouter(e: FormEvent) {
    e.preventDefault();
    const v = lire(valeur), s = lire(sur), c = lire(coef);
    if (!(s > 0) || !(v >= 0) || v > s || !(c > 0)) {
      setErreur('Saisissez une note entre 0 et le barème, et un coefficient positif.');
      return;
    }
    setErreur('');
    const nom = matieres.find((m) => m.code === matiere)?.nom ?? matiere;
    onAjouter({
      id: idFictif--, devoir: 'Note fictive', codePeriode, codeMatiere: matiere, matiere: nom, type: '',
      date: dateLocale(), dateSaisie: dateLocale(), valeurTexte: nombre(v), valeur: v, noteSur: s, coef: c,
      nonSignificatif: false, commentaire: '', moyenneClasse: null, minClasse: null, maxClasse: null,
    });
    setValeur('');
  }

  return (
    <section className="carte simulateur">
      <div className="carte-titre">
        <h2>Simulateur</h2>
        <span className="discret petit">Ajoutez une note fictive pour voir son effet. Rien n'est envoyé à EcoleDirecte.</span>
      </div>
      <form onSubmit={ajouter} className="simulateur-form">
        <label>
          Matière
          <select value={matiere} onChange={(e) => setMatiere(e.target.value)}>
            {matieres.map((m) => (
              <option key={m.code} value={m.code}>{m.nom}</option>
            ))}
          </select>
        </label>
        <label>
          Note
          <input inputMode="decimal" value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="14,5" required size={5} />
        </label>
        <label>
          Sur
          <input inputMode="decimal" value={sur} onChange={(e) => setSur(e.target.value)} size={3} />
        </label>
        <label>
          Coef.
          <input inputMode="decimal" value={coef} onChange={(e) => setCoef(e.target.value)} size={3} />
        </label>
        <button type="submit">Ajouter</button>
      </form>
      {erreur && <p className="erreur">{erreur}</p>}
      {fictives.length > 0 && (
        <div className="fictives">
          {fictives.map((n) => (
            <span key={n.id} className="puce-note fictive">
              {n.matiere} : {n.valeurTexte}/{nombre(n.noteSur)}
              {n.coef !== 1 && <> ×{nombre(n.coef)}</>}
              <button className="lien" onClick={() => onRetirer(n.id)} aria-label="Retirer cette note fictive">✕</button>
            </span>
          ))}
          <button className="bouton-secondaire" onClick={onVider}>Tout effacer</button>
        </div>
      )}
    </section>
  );
}
