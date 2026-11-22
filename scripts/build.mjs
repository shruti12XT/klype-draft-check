// Bundles the extension into dist/ with esbuild.
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const realConfig = resolve(root, 'firebase-config.js');
const exampleConfig = resolve(root, 'firebase-config.example.js');
const configPath = existsSync(realConfig) ? realConfig : exampleConfig;

if (configPath === exampleConfig) {
  console.warn('firebase-config.js not found: building with the example config. On-device checks work; the cloud fallback stays off until you fill it in.');
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const configAlias = {
  name: 'firebase-config',
  setup(b) {
    b.onResolve({ filter: /^firebase-config$/ }, () => ({ path: configPath }));
  }
};

await build({
  entryPoints: {
    checker: resolve(root, 'src/checker.js'),
    content: resolve(root, 'src/content.js'),
    background: resolve(root, 'src/background.js')
  },
  outdir: dist,
  bundle: true,
  format: 'iife',
  target: 'chrome139',
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  charset: 'ascii',
  plugins: [configAlias],
  logLevel: 'info'
});

cpSync(resolve(root, 'public'), dist, { recursive: true });
console.log('Built to dist/. Load it at chrome://extensions with "Load unpacked".');
