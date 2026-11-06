import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// Dev-only endpoint: the page can POST a PNG of the current frame (window.__earth.snap)
// and it lands in .snaps/<name>.png — used to verify scenes even when the browser pane is hidden.
function snapPlugin(): Plugin {
  const handler = (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => {
        const url = new URL(req.url ?? '/', 'http://local');
        const name = (url.searchParams.get('name') || 'snap').replace(/[^\w.-]/g, '_');
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const dir = path.join(root, '.snaps');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, name + '.png'), Buffer.concat(chunks));
          res.setHeader('content-type', 'text/plain');
          res.end('ok ' + name);
        });
  };
  return {
    name: 'earth-snap',
    // dev server and `vite preview` only — the endpoint never exists in the deployed build
    configureServer(server) { server.middlewares.use('/__snap', handler); },
    configurePreviewServer(server) { server.middlewares.use('/__snap', handler); },
  };
}

export default defineConfig({
  plugins: [snapPlugin()],
  server: { host: '127.0.0.1', port: 5317 },
  preview: { host: '127.0.0.1', port: 5318 },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
});
