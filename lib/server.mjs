// Serve the Web view. Data is collected again on each page load, reusing
// transcripts that have not changed.
import http from 'node:http';
import fs from 'node:fs/promises';
import {collect, createCache} from './aggregate.mjs';
import {readChanges} from './changes.mjs';

const WEB = new URL('../web/', import.meta.url);
const STATIC = {'/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8']};

export function createServer({root, dataDir, days}) {
  const cache = createCache();
  return http.createServer(async (req, res) => {
    const send = (status, type, body) => {
      res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
      res.end(body);
    };
    try {
      if (req.method !== 'GET') return send(405, 'text/plain', 'Method not allowed');
      const {pathname} = new URL(req.url, 'http://localhost');
      if (STATIC[pathname]) {
        const [file, type] = STATIC[pathname];
        return send(200, type, await fs.readFile(new URL(file, WEB)));
      }
      if (pathname === '/data.js') {
        const data = await collect({root, days, cache});
        return send(200, 'text/javascript; charset=utf-8', `window.CCA=${JSON.stringify(data).replace(/</g, '\\u003c')};\n`);
      }
      if (pathname === '/changes.json') return send(200, 'application/json', JSON.stringify(await readChanges(dataDir)));
      return send(404, 'text/plain', 'Not found');
    } catch (error) {
      return send(500, 'text/plain', String(error?.message || error));
    }
  });
}
