/* Tiny dev server for CROWN COURT.
   Serves the game over http:// (needed for localStorage + PWA install)
   and accepts POST /save so the offline asset-prep page can write
   optimised sprites into assets/. Dev only - not part of the game. */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.css': 'text/css', '.svg': 'image/svg+xml'
};
const root = process.cwd();

createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { path: p, dataUrl } = JSON.parse(body);
        const target = resolve(root, p);
        if (!target.startsWith(root + sep)) throw new Error('outside root');
        const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, Buffer.from(b64, 'base64'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: p, bytes: Buffer.from(b64, 'base64').length }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  try {
    const buf = await readFile(join(root, p));
    res.writeHead(200, {
      'Content-Type': TYPES[extname(p).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(buf);
  } catch (e) {
    res.writeHead(404); res.end('not found');
  }
}).listen(Number(process.env.COURT_PORT || 8123), () => console.log(`CROWN COURT dev server: http://localhost:${process.env.COURT_PORT || 8123}`));
