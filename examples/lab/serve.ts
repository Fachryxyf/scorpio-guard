/**
 * A static file server, so a shipped site can be a lab target. M2.1.
 *
 * The two extra targets are builds that already exist on disk: the landing page
 * deployed at aufsicht.dev and the `dist/` build deployed at talkhere.life. Neither
 * needs its own runtime to be observed, and pulling in a build tool to serve a
 * directory would be one more thing between the measurement and the site.
 *
 * A missing file answers 404, which matters: the observer reads that as evidence,
 * and it should, because from the origin's point of view the request was refused.
 */
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2',
};

export type StaticServer = {
  readonly listen: (port: number) => Promise<number>;
  readonly close: () => Promise<void>;
};

export function createStaticServer(root: string): StaticServer {
  const base = resolve(root);
  const server = createServer((request, response) => {
    const path = (request.url ?? '/').split('?')[0] ?? '/';
    let file = join(base, normalize(path));
    if (!file.startsWith(base)) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Forbidden');
      return;
    }

    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      const stats = statSync(file);
      if (!stats.isFile()) throw new Error('not a file');
      response.writeHead(200, {
        'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'content-length': String(stats.size),
      });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<!doctype html><title>404</title><h1>Not found</h1>');
    }
  });

  return {
    listen: (port) =>
      new Promise<number>((done) => server.listen(port, '127.0.0.1', () => done(port))),
    close: () => new Promise<void>((done) => server.close(() => done())),
  };
}
