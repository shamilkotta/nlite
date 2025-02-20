import express from 'express';
import fs from 'node:fs/promises';
import { Transform } from 'node:stream';

const base = process.env.BASE || '/';
const ABORT_DELAY = 10000;

const app = express();

const compression = (await import('compression')).default;
const sirv = (await import('sirv')).default;
app.use(compression());
app.use(base, sirv('./dist/client', { extensions: [] }));

app.use('*all', async (req, res) => {
  try {
    const url = req.originalUrl;

    const template = await fs.readFile('./dist/client/index.html', 'utf-8');
    const render = (await import('./dist/server/entry-server.js')).render;

    let didError = false;

    const { pipe, abort } = render(url, null, {
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
    res.status(500).end((e as Error).stack);
  }
});

export default app;
