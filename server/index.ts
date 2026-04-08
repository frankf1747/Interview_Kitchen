import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API routes
app.use('/api', apiRoutes);

// Serve static files in production
const distPath = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  const hasKey = !!process.env.OPENAI_API_KEY;
  console.log(`\n  Interview Kitchen server running at http://localhost:${PORT}`);
  if (!hasKey) {
    console.log('  ⚠  No OPENAI_API_KEY found — the app will prompt you to set one up.\n');
  } else {
    console.log(`  ✓  API key loaded. Model: ${process.env.OPENAI_MODEL || 'gpt-4o'}\n`);
  }
});
