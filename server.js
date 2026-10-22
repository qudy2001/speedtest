import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';

const PORT = Number(process.env.PORT || 3000);
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const MAX_BYTES = 64 * 1024 * 1024;
const root = path.dirname(fileURLToPath(import.meta.url));
const html = await readFile(path.join(root, 'public/index.html'));
const css = await readFile(path.join(root, 'public/style.css'));
const js = await readFile(path.join(root, 'public/app.js'));
const chunk = Buffer.allocUnsafe(64 * 1024);
for (let i = 0; i < chunk.length; i++) chunk[i] = i % 251;

function clientIp(req) {
  let ip = req.socket.remoteAddress || '';
  if (TRUST_PROXY) {
    const forwarded = req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] ||
      req.headers['x-forwarded-for']?.split(',').at(-1)?.trim();
    if (typeof forwarded === 'string' && net.isIP(forwarded)) ip = forwarded;
  }
  return ip.replace(/^::ffff:/, '');
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/info') {
    return send(res, 200, JSON.stringify({ ip: clientIp(req), serverTime: new Date().toISOString() }));
  }
  if (req.method === 'GET' && url.pathname === '/api/ping') {
    return send(res, 200, '{}');
  }
  if (req.method === 'GET' && url.pathname === '/api/download') {
    const bytes = Number(url.searchParams.get('bytes'));
    if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_BYTES) {
      return send(res, 400, JSON.stringify({ error: 'bytes must be between 1 and 67108864' }));
    }
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': bytes,
      'Cache-Control': 'no-store, no-transform',
      'Content-Encoding': 'identity',
      'X-Content-Type-Options': 'nosniff',
    });
    let left = bytes;
    const write = () => {
      while (left > 0 && !res.destroyed) {
        const n = Math.min(chunk.length, left);
        left -= n;
        if (!res.write(chunk.subarray(0, n))) return;
      }
      if (left === 0 && !res.destroyed) res.end();
    };
    res.on('drain', write);
    write();
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/upload') {
    let bytes = 0;
    for await (const part of req) {
      bytes += part.length;
      if (bytes > MAX_BYTES) {
        return send(res, 413, JSON.stringify({ error: 'upload too large' }));
      }
    }
    return send(res, 200, JSON.stringify({ bytes }));
  }
  if (req.method === 'GET') {
    const asset = {
      '/': [html, 'text/html; charset=utf-8'],
      '/style.css': [css, 'text/css; charset=utf-8'],
      '/app.js': [js, 'text/javascript; charset=utf-8'],
    }[url.pathname];
    if (asset) return send(res, 200, asset[0], asset[1]);
  }
  send(res, 404, JSON.stringify({ error: 'not found' }));
});

server.requestTimeout = 30_000;
server.listen(PORT, '0.0.0.0', () => console.log(`Speedtest listening on ${PORT}`));
