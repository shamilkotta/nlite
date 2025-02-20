import express from 'express';
import fs from 'node:fs/promises';
import { Transform } from 'node:stream';
// import { collectCss, componentsModules } from './collectCss';

// Create http server
const app = express();

const base = process.env.BASE || '/';
const ABORT_DELAY = 10000;

// Add Vite or respective production middlewares
const { createServer } = await import('vite');
const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  base
});
app.use(vite.middlewares);

// Serve HTML
app.use('*all', async (req, res) => {
  try {
    const url = req.originalUrl;

    let template = await fs.readFile('./index.html', 'utf-8');
    template = await vite!.transformIndexHtml(url, template);
    const render = (await vite!.ssrLoadModule('/src/entry-server.tsx')).render;
    const findMatchingRoute = (await vite!.ssrLoadModule('src/utils/index.ts'))
      .findMatchingRoute;
    const routes = (await vite!.ssrLoadModule('src/route.tsx')).default;
    const App = findMatchingRoute(url, routes);

    // load css
    // const matchedModules = componentsModules(componentsPath, vite);
    // const css = collectCss(matchedModules);
    // template.replace('<!--dev-ssr-css-->', css);

    let didError = false;
    const { pipe, abort } = render(url, App, {
      onShellError() {
        res.status(500);
        res.set({ 'Content-Type': 'text/html' });
        res.send('<h1>Something went wrong</h1>');
      },
      onShellReady() {
        res.status(didError ? 500 : 200);
        res.set({ 'Content-Type': 'text/html' });

        const transformStream = new Transform({
          transform(chunk, encoding, callback) {
            res.write(chunk, encoding);
            callback();
          }
        });

        const [htmlStart, htmlEnd] = template.split(`<!--app-html-->`);

        res.write(htmlStart);

        transformStream.on('finish', () => {
          res.end(htmlEnd);
        });

        pipe(transformStream);
      },
      onError(error: unknown) {
        didError = true;
        console.error(error);
      }
    });

    setTimeout(() => {
      abort();
    }, ABORT_DELAY);
  } catch (e) {
    vite?.ssrFixStacktrace(e as Error);
    res.status(500).end((e as Error).stack);
  }
});

export default app;
