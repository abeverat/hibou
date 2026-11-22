// Lanceur multiplateforme (macOS / Windows) : `node scripts/dev.mjs [--demo] [args electron-vite…]`
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const env = { ...process.env };
// Hérité de VS Code ou d'outils basés sur Electron : ferait démarrer Electron comme un simple Node.
delete env.ELECTRON_RUN_AS_NODE;
const iDemo = args.indexOf('--demo');
if (iDemo >= 0) {
  args.splice(iDemo, 1);
  env.DEMO = '1';
}

const enfant = spawn('npx', ['electron-vite', 'dev', '--watch', ...args], {
  cwd: fileURLToPath(new URL('../apps/desktop', import.meta.url)),
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
enfant.on('exit', (code) => process.exit(code ?? 0));
