import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/') path = '/index.html';
    const target = resolve(root, '.' + path);
    const local = relative(root, target);
    const allowed = ['index.html','login.html','cadastro.html','contatos.html','nova-campanha.html','campanhas.html','canais.html','configuracoes.html','perfil.html','config.js'].includes(local) || ['src','vendor','supabase' + sep + 'functions' + sep + '_shared'].some(p=>local.startsWith(p + sep));
    if (local.startsWith('..') || !allowed || !(await stat(target)).isFile()) { res.writeHead(404); res.end('Não encontrado'); return; }
    res.writeHead(200, { 'Content-Type':mime[extname(target)] || 'text/plain; charset=utf-8', 'Cache-Control':'no-store' });
    res.end(await readFile(target));
  } catch { res.writeHead(404); res.end('Não encontrado'); }
});
const port = Number(process.env.PORT || 5173);
server.listen(port, '127.0.0.1', () => console.log(`DevNox: http://127.0.0.1:${port} — Demonstração: http://127.0.0.1:${port}/?demo=1`));

