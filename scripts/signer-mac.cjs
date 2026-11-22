/**
 * Signature macOS (hook « afterSign » d'electron-builder).
 *
 * Sans compte Apple Developer, Hibou est signé avec un certificat auto-signé STABLE :
 * macOS reconnaît ainsi la même appli d'une version à l'autre, et le trousseau
 * (« Hibou Safe Storage ») ne redemande pas le mot de passe du Mac à chaque mise à jour.
 *
 * Certificat (PKCS#12) fourni par l'environnement, jamais par le dépôt :
 *   HIBOU_MAC_P12       contenu base64 du .p12   (ou HIBOU_MAC_P12_FILE : chemin du .p12)
 *   HIBOU_MAC_P12_PASSWORD                        (ou HIBOU_MAC_P12_PASSWORD_FILE)
 * Sans certificat : signature « ad hoc » (fonctionne, mais le trousseau redemandera
 * l'autorisation après chaque nouvelle version).
 */
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString();

function lireCertificat() {
  const env = process.env;
  let p12 = env.HIBOU_MAC_P12 ? Buffer.from(env.HIBOU_MAC_P12, 'base64') : null;
  if (!p12 && env.HIBOU_MAC_P12_FILE) p12 = readFileSync(env.HIBOU_MAC_P12_FILE);
  let mdp = env.HIBOU_MAC_P12_PASSWORD ?? null;
  if (mdp === null && env.HIBOU_MAC_P12_PASSWORD_FILE) mdp = readFileSync(env.HIBOU_MAC_P12_PASSWORD_FILE, 'utf8').trim();
  return p12 && mdp !== null ? { p12, mdp } : null;
}

exports.default = async function signerMac(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appli = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const cert = lireCertificat();

  if (!cert) {
    console.log('  • signature ad hoc (pas de certificat Hibou fourni)');
    run('codesign', ['--force', '--deep', '--sign', '-', appli]);
    return;
  }

  // Trousseau temporaire, supprimé à la fin : rien n'est ajouté au trousseau de session.
  const dossier = mkdtempSync(join(tmpdir(), 'hibou-signature-'));
  const trousseau = join(dossier, 'signature.keychain-db');
  const mdpTrousseau = randomBytes(24).toString('hex');
  const fichierP12 = join(dossier, 'cert.p12');
  writeFileSync(fichierP12, cert.p12, { mode: 0o600 });
  try {
    run('security', ['create-keychain', '-p', mdpTrousseau, trousseau]);
    run('security', ['set-keychain-settings', trousseau]);
    run('security', ['unlock-keychain', '-p', mdpTrousseau, trousseau]);
    run('security', ['import', fichierP12, '-k', trousseau, '-P', cert.mdp, '-T', '/usr/bin/codesign']);
    run('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:', '-s', '-k', mdpTrousseau, trousseau]);
    // Le certificat est auto-signé (non approuvé) : on le désigne par son empreinte SHA-1.
    const identites = run('security', ['find-identity', '-p', 'codesigning', trousseau]);
    const sha1 = /\b([0-9A-F]{40})\b/.exec(identites)?.[1];
    if (!sha1) throw new Error('Certificat de signature Hibou introuvable dans le .p12');
    run('codesign', ['--force', '--deep', '--timestamp=none', '--keychain', trousseau, '--sign', sha1, appli]);
    console.log(`  • signé avec le certificat Hibou (${sha1.slice(0, 8)}…)`);
  } finally {
    try { run('security', ['delete-keychain', trousseau]); } catch { /* déjà supprimé */ }
    rmSync(dossier, { recursive: true, force: true });
  }
};
