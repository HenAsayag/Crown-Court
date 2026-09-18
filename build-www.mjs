/* Copies the playable game into www/ for the Android (Capacitor) build.
   Keeps node_modules, tools and the raw art out of the APK. */
import { cp, rm, mkdir } from 'node:fs/promises';
const OUT = 'www';
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
for (const f of ['index.html', 'arena.css', 'art.js', 'hoop-art.js', 'webgl-renderer.js', 'webgl-scene.js', 'game.js', 'mobile.js', 'manifest.webmanifest', 'sw.js', 'assets'])
  await cp(f, `${OUT}/${f}`, { recursive: true });
console.log('www/ built');
