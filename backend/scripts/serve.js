// A tiny static server for local use, on Node's built-in http module only: npm start
// It serves an explicit allowlist (the app, the shared rules module and the PDFs under docs/),
// never the rest of the repo, and mounts api/<name>.js functions at /api/<name>.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.pdf': 'application/pdf' };
const ALLOWED = new Map([['/', 'index.html'], ['/index.html', 'index.html'], ['/rules.js', 'rules.js']]);

// Only /docs/<name>.pdf, with a plain file name: no subdirectories, no dots except the extension.
const PDF = /^\/docs\/([A-Za-z0-9-]+)\.pdf$/;

function fileFor(pathname) {
  if (ALLOWED.has(pathname)) return ALLOWED.get(pathname);
  const m = PDF.exec(pathname);
  return m ? path.join('docs', `${m[1]}.pdf`) : null;
}

async function toRequest(req, base) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(new URL(req.url, base), {
    method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
  });
}

async function sendResponse(res, response) {
  const headers = {};
  for (const [k, v] of response.headers) headers[k] = v;
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length) headers['set-cookie'] = cookies;
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function createStaticServer({ env = process.env } = {}) {
  return http.createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://localhost');
      const api = /^\/api\/([a-z-]+)$/.exec(pathname);
      if (api) {
        const file = path.join(root, 'api', `${api[1]}.js`);
        const exists = await fs.stat(file).then(s => s.isFile(), () => false);
        const mod = exists ? await import(pathToFileURL(file).href) : null;
        const fn = mod && mod[req.method];
        if (!fn) { res.writeHead(404); return res.end('Not found'); }
        return sendResponse(res, await fn(await toRequest(req, 'http://localhost')));
      }
      const file = fileFor(pathname);
      if (!file) { res.writeHead(404); return res.end('Not found'); }
      const data = await fs.readFile(path.join(root, file));
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch (e) {
      if (e.code === 'ENOENT') { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(500); res.end('Server error');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3000;
  createStaticServer().listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
}
