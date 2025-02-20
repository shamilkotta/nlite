import { type Express } from 'express';

// Constants
const isProduction = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 5173;

let app: Express;
if (!isProduction) {
  app = (await import('./dev')).default;
} else {
  app = (await import('./prod')).default;
}

// Start http server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
