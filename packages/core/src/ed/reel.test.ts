import { describe, expect, it } from 'vitest';
import { API_VERSION, encoderIdentifiant, ReelBackend, type RequeteHttp, type ReponseHttp } from './reel';
import { encodeBase64 } from './parsers';
import { HibouService } from '../service';

describe('encoderIdentifiant', () => {
  it('reproduit quote(s, safe="~()*!.\'%\\\\") de Python', () => {
    expect(encoderIdentifiant('JaimeLesK++kies&Ynotes')).toBe('JaimeLesK%2B%2Bkies%26Ynotes');
    expect(encoderIdentifiant('a b"c')).toBe('a%20b%22c');
    expect(encoderIdentifiant("~()*!.'%_-")).toBe("~()*!.'%_-");
    expect(encoderIdentifiant('é')).toBe('%C3%A9');
    expect(encoderIdentifiant('a\\b')).toBe('a\\\\b');
  });
});

const COMPTE = {
  accounts: [{
    idLogin: 1, id: 77, typeCompte: '1', main: true, prenom: 'P', nom: 'N', anneeScolaireCourante: '2026-2027',
    profile: { eleves: [{ id: 501, prenom: 'Léa', nom: 'N', classe: { libelle: '4B' } }] },
  }],
};

/** Faux serveur EcoleDirecte. */
function fauxServeur(options: { qcm?: boolean; expireApres?: number; jeton?: boolean } = {}) {
  const appels: RequeteHttp[] = [];
  let n = 0;
  let qcmResolu = false;
  let requetesDonnees = 0;
  const rep = (json: object, enTetes: Record<string, string> = {}, cookies: string[] = []): ReponseHttp => ({
    statut: 200, enTetes, cookies, texte: JSON.stringify(json),
  });
  const jetonsValides = new Set<string>();
  const avecJeton = () => {
    const at = `AT${jetonsValides.size + 1}`;
    jetonsValides.add(at);
    return { accounts: [{ ...COMPTE.accounts[0]!, accessToken: at }] };
  };
  const http = async (r: RequeteHttp): Promise<ReponseHttp> => {
    appels.push(r);
    const token = `T${++n}`;
    if (r.methode === 'GET' && r.url.includes('login.awp?gtk=1')) return rep({ code: 200 }, {}, [`GTK=gtk${n}; Path=/; Secure`]);
    if (r.url.includes('/login.awp')) {
      if (!r.enTetes['x-gtk'] || !r.enTetes.cookie?.includes('GTK=')) return rep({ code: 505, message: 'gtk' });
      // Reconnexion « se souvenir de moi » : jeton AT<n> valide s'il a été émis, mot de passe vide.
      if (r.corps!.includes('"isReLogin": true')) {
        const at = /"accesstoken": "([^"]+)"/.exec(r.corps!)?.[1];
        const ok = r.corps!.includes('"motdepasse":"???"') && r.corps!.includes('"uuid": "U-1"') && at && jetonsValides.has(at);
        if (!ok) return rep({ code: 505, message: 'jeton' });
        return rep({ code: 200, data: avecJeton() }, { 'x-token': token });
      }
      if (!r.corps!.includes('"motdepasse":"m%C3%B4t%26de"')) return rep({ code: 505, message: 'mdp' });
      if (options.qcm && !(qcmResolu && r.corps!.includes('"fa": [{"cn": "CN", "cv": "CV", "uniq": false}]'))) {
        return rep({ code: 250, token: '', data: { accounts: [] } }, { 'x-token': token, '2fa-token': 'F2A' });
      }
      return rep({ code: 200, data: options.jeton ? avecJeton() : COMPTE }, { 'x-token': token });
    }
    if (r.url.includes('doubleauth.awp?verbe=get')) {
      if (r.enTetes['2fa-token'] !== 'F2A') return rep({ code: 520 });
      return rep({ code: 200, data: { question: encodeBase64('Mois ?'), propositions: [encodeBase64('Avril'), encodeBase64('Mai')] } }, { 'x-token': token });
    }
    if (r.url.includes('doubleauth.awp?verbe=post')) {
      if (r.corps === `data={"choix": "${encodeBase64('Avril')}"}`) {
        qcmResolu = true;
        return rep({ code: 200, data: { cn: 'CN', cv: 'CV' } }, { 'x-token': token });
      }
      return rep({ code: 200, data: null }, { 'x-token': token });
    }
    if (r.url.includes('emploidutemps.awp')) {
      requetesDonnees++;
      if (options.expireApres && requetesDonnees === options.expireApres) return rep({ code: 525 });
      return rep({ code: 200, data: [], token: '' }, { 'x-token': token });
    }
    return rep({ code: 200, data: {} }, { 'x-token': token });
  };
  return { http, appels };
}

describe('ReelBackend', () => {
  it('connexion directe : GTK, login, puis requêtes avec le dernier token', async () => {
    const { http, appels } = fauxServeur();
    const service = new HibouService(new ReelBackend({ http }));
    const r = await service.connexion('moi', 'môt&de');
    expect(r.etat).toBe('connecte');
    expect(appels[0]!.url).toBe(`https://api.ecoledirecte.com/v3/login.awp?gtk=1&v=${API_VERSION}`);
    expect(appels[1]!.enTetes['x-gtk']).toBe('gtk1');

    await service.emploiDuTemps('2026-11-23', '2026-11-28');
    const edt = appels[2]!;
    expect(edt.url).toBe(`https://api.ecoledirecte.com/v3/E/501/emploidutemps.awp?verbe=get&v=${API_VERSION}`);
    expect(edt.enTetes['x-token']).toBe('T2');
    expect(edt.enTetes['x-gtk']).toBeUndefined();
    expect(edt.enTetes['user-agent']).toBe('Android EDMOBILE v7.0.1');
    expect(edt.corps).toBe('data={"dateDebut":"2026-11-23","dateFin":"2026-11-28","avecTrous":false}');

    await service.devoirs();
    expect(appels[3]!.enTetes['x-token']).toBe('T3'); // token renouvelé par la réponse précédente
  });

  it('QCM : question, mauvaise réponse, bonne réponse, puis login avec cn/cv mémorisables', async () => {
    const { http, appels } = fauxServeur({ qcm: true });
    let memorise: { cn: string; cv: string } | null = null;
    const service = new HibouService(new ReelBackend({ http, onDoubleAuth: (fa) => (memorise = fa) }));
    const q = await service.connexion('moi', 'môt&de');
    expect(q).toMatchObject({ etat: 'qcm', question: 'Mois ?' });
    if (q.etat !== 'qcm') return;
    const mai = q.propositions.find((p) => p.texte === 'Mai')!;
    expect((await service.repondreQcm(mai.valeur)).etat).toBe('qcm');
    const avril = q.propositions.find((p) => p.texte === 'Avril')!;
    const r = await service.repondreQcm(avril.valeur);
    expect(r.etat).toBe('connecte');
    expect(memorise).toEqual({ cn: 'CN', cv: 'CV' });
    expect(appels.at(-1)!.corps).toContain('"fa": [{"cn": "CN", "cv": "CV", "uniq": false}]');
  });

  it('cn/cv mémorisés : pas de QCM', async () => {
    const { http } = fauxServeur({ qcm: true });
    // Le faux serveur n'accepte cn/cv qu'après un QCM résolu dans la même instance : on simule
    // un premier passage, puis une nouvelle connexion avec les valeurs mémorisées.
    const b = new ReelBackend({ http });
    const q = await b.connexion('moi', 'môt&de');
    expect(q.etat).toBe('qcm');
    await b.repondreQcm(encodeBase64('Avril'));
    b.deconnexion();
    expect((await b.connexion('moi', 'môt&de')).etat).toBe('connecte');
  });

  it('mauvais mot de passe → erreur identifiants', async () => {
    const { http } = fauxServeur();
    await expect(new ReelBackend({ http }).connexion('moi', 'faux')).rejects.toMatchObject({ type: 'identifiants' });
  });

  it('token expiré (525) : reconnexion silencieuse et nouvelle tentative', async () => {
    const { http, appels } = fauxServeur({ expireApres: 1 });
    const service = new HibouService(new ReelBackend({ http }));
    await service.connexion('moi', 'môt&de');
    await expect(service.emploiDuTemps('2026-11-23', '2026-11-28')).resolves.toEqual([]);
    const urls = appels.map((a) => a.url.replace('https://api.ecoledirecte.com/v3/', '').split('?')[0]);
    expect(urls).toEqual(['login.awp', 'login.awp', 'E/501/emploidutemps.awp', 'login.awp', 'login.awp', 'E/501/emploidutemps.awp']);
  });

  it('réseau coupé → erreur indisponible', async () => {
    const b = new ReelBackend({ http: async () => { throw new Error('ECONNREFUSED'); } });
    await expect(b.connexion('a', 'b')).rejects.toMatchObject({ type: 'indisponible' });
  });

  describe('« se souvenir de moi » (jeton)', () => {
    const corpsLogin = (a: RequeteHttp[]) => a.filter((x) => x.methode === 'POST' && x.url.includes('/login.awp')).map((x) => x.corps!);

    it('connexion par mot de passe : demande un jeton, puis oublie le mot de passe', async () => {
      const { http, appels } = fauxServeur({ jeton: true, expireApres: 1 });
      const recus: string[] = [];
      const b = new ReelBackend({ http, uuid: () => 'U-1', onJeton: (j) => recus.push(j.accessToken) });
      const service = new HibouService(b);
      await service.connexion('moi', 'môt&de');
      expect(corpsLogin(appels)[0]).toContain('"sesouvenirdemoi": true');
      expect(corpsLogin(appels)[0]).toContain('"uuid": "U-1"');
      expect(service.jetonActuel()).toEqual({ identifiant: 'moi', uuid: 'U-1', typeCompte: '1', accessToken: 'AT1' });

      // Token expiré : la reconnexion silencieuse se fait avec le jeton, sans mot de passe.
      await expect(service.emploiDuTemps('2026-11-23', '2026-11-28')).resolves.toEqual([]);
      const relogin = corpsLogin(appels)[1]!;
      expect(relogin).toContain('"isReLogin": true');
      expect(relogin).toContain('"motdepasse":"???"');
      expect(relogin).not.toContain('m%C3%B4t');
      expect(recus).toEqual(['AT1', 'AT2']);
    });

    it('reprise avec un jeton enregistré, sans mot de passe', async () => {
      const { http, appels } = fauxServeur({ jeton: true });
      const premier = new HibouService(new ReelBackend({ http, uuid: () => 'U-1' }));
      await premier.connexion('moi', 'môt&de');
      const jeton = premier.jetonActuel()!;

      const service = new HibouService(new ReelBackend({ http }));
      const r = await service.reprendre(jeton);
      expect(r.etat).toBe('connecte');
      expect(corpsLogin(appels).at(-1)).toContain('"accesstoken": "AT1"');
      expect(corpsLogin(appels).at(-1)).toContain('"typeCompte": "1"');
      expect(service.jetonActuel()?.accessToken).toBe('AT2');
      await expect(service.devoirs()).resolves.toBeDefined();
    });

    it('jeton refusé → erreur session (retour à l’écran de connexion)', async () => {
      const { http } = fauxServeur({ jeton: true });
      const service = new HibouService(new ReelBackend({ http }));
      await expect(service.reprendre({ identifiant: 'moi', uuid: 'U-1', typeCompte: '1', accessToken: 'périmé' }))
        .rejects.toMatchObject({ type: 'session' });
      expect(service.jetonActuel()).toBeNull();
    });
  });
});
