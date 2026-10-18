// Show the built report over http, so links to it can be clicked from other
// pages (browsers do not follow links from a web page to a local file).
// It sends the file `cca build` wrote, and rebuilds it when the page asks.
import http from 'node:http';
import fs from 'node:fs/promises';

export const DEFAULT_PORT = 7319;
// Another site cannot send this header without a preflight, which is refused,
// so only the report itself can ask for a rebuild.
export const REFRESH_HEADER = 'x-cca-refresh';

export function createViewer(file, {rebuild} = {}) {
  // Clicks while a rebuild runs wait for that one rather than start another.
  let running = null;
  return http.createServer(async (req, res) => {
    const send = (status, type, body) => {
      res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
      res.end(body);
    };
    const {pathname} = new URL(req.url, 'http://localhost');
    if (pathname === '/refresh' && req.method === 'POST') {
      if (!rebuild) return send(404, 'text/plain', 'Not found');
      if (req.headers[REFRESH_HEADER] !== '1') return send(403, 'text/plain', 'Forbidden');
      running ||= rebuild().finally(() => { running = null; });
      try { return send(200, 'application/json', JSON.stringify(await running)); }
      catch (error) { return send(500, 'text/plain', String(error.message)); }
    }
    if (req.method !== 'GET') return send(405, 'text/plain', 'Method not allowed');
    if (pathname !== '/' && pathname !== '/index.html') return send(404, 'text/plain', 'Not found');
    try {
      send(200, 'text/html; charset=utf-8', await fs.readFile(file));
    } catch (error) {
      if (error.code !== 'ENOENT') return send(500, 'text/plain', String(error.message));
      send(404, 'text/plain', 'No report yet. Run: cca build');
    }
  });
}

// Link parameters the page understands (see applyLink in web/app.js).
export const LINK_KEYS = ['project', 'period', 'date', 'metrics', 'tool', 'session', 'focus', 'item'];

export function reportLink(base, params) {
  const q = new URLSearchParams();
  for (const key of LINK_KEYS) if (params[key]) q.set(key, params[key]);
  const hash = q.toString().replace(/\+/g, '%20');
  return hash ? `${base}#${hash}` : base;
}

export async function viewerRunning(port, timeoutMs = 800) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, {signal: AbortSignal.timeout(timeoutMs)});
    return res.ok && /Cost Adviser For Claude/.test(await res.text());
  } catch { return false; }
}
