import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import catalogRouter from './routes/catalog.js';
import generatorRouter from './routes/generator.js';
import nlpRouter from './routes/nlp.js';
import requestsRouter from './routes/requests.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3456;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/catalog', catalogRouter);
app.use('/api/generate', generatorRouter);
app.use('/api/nlp', nlpRouter);
app.use('/api/requests', requestsRouter);

// Serve static files in production
const clientDist = path.join(__dirname, '../dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Platform UI server running on port ${PORT}`);
});

export default app;
