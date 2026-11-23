import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const publicDir = resolve('public');
const port = Number.parseInt(process.env.PORT || '4173', 10);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp' };
const server = http.createServer(async (req,res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const path = resolve(publicDir, '.' + pathname);
    if (path !== publicDir && !path.startsWith(publicDir + sep)) { res.writeHead(403); res.end(); return; }
    const meta = await stat(path);
    if (!meta.isFile()) { res.writeHead(404); res.end(); return; }
    const data = await readFile(path);
    res.writeHead(200, {'Content-Type': mime[extname(path)] || 'application/octet-stream','Content-Length':data.byteLength,'Cache-Control':'no-store'});
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Turning 4 Success preview: http://127.0.0.1:${port}`));
