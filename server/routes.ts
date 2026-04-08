import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import * as openai from './openaiService.js';
import { loadPrompts, savePrompts, getDefaults, PromptTemplate } from './promptStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, '..', '.env');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Status & Setup ──────────────────────────────────────────────

router.get('/status', (_req: Request, res: Response) => {
  const hasKey = !!process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o';
  res.json({ configured: hasKey, model });
});

router.post('/setup', (req: Request, res: Response) => {
  const { apiKey, model } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    res.status(400).json({ error: 'Invalid API key' });
    return;
  }

  const modelName = (model && typeof model === 'string') ? model.trim() : 'gpt-4o';

  // Write .env file
  const envContent = `OPENAI_API_KEY=${apiKey.trim()}\nOPENAI_MODEL=${modelName}\n`;
  fs.writeFileSync(ENV_PATH, envContent, 'utf-8');

  // Update process.env for current session
  process.env.OPENAI_API_KEY = apiKey.trim();
  process.env.OPENAI_MODEL = modelName;

  res.json({ success: true, model: modelName });
});

router.post('/update-model', (req: Request, res: Response) => {
  const { model } = req.body;
  if (!model || typeof model !== 'string') {
    res.status(400).json({ error: 'Invalid model name' });
    return;
  }

  process.env.OPENAI_MODEL = model.trim();

  // Update .env if it exists
  if (fs.existsSync(ENV_PATH)) {
    let env = fs.readFileSync(ENV_PATH, 'utf-8');
    if (env.includes('OPENAI_MODEL=')) {
      env = env.replace(/OPENAI_MODEL=.*/, `OPENAI_MODEL=${model.trim()}`);
    } else {
      env += `\nOPENAI_MODEL=${model.trim()}\n`;
    }
    fs.writeFileSync(ENV_PATH, env, 'utf-8');
  }

  res.json({ success: true, model: model.trim() });
});

// ─── Prompts ─────────────────────────────────────────────────────

router.get('/prompts', (_req: Request, res: Response) => {
  res.json(loadPrompts());
});

router.get('/prompts/defaults', (_req: Request, res: Response) => {
  res.json(getDefaults());
});

router.put('/prompts', (req: Request, res: Response) => {
  const prompts = req.body as PromptTemplate[];
  if (!Array.isArray(prompts)) {
    res.status(400).json({ error: 'Expected array of prompts' });
    return;
  }
  savePrompts(prompts);
  res.json({ success: true });
});

router.post('/prompts/reset', (_req: Request, res: Response) => {
  savePrompts(getDefaults());
  res.json(getDefaults());
});

// ─── Document Extraction ─────────────────────────────────────────

router.post('/extract-document', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Handle DOCX locally
    if (file.originalname.endsWith('.docx') ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const mammoth = await import('mammoth');
      const result = await mammoth.default.extractRawText({ buffer: file.buffer });
      res.json({ text: result.value });
      return;
    }

    // Handle plain text
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      res.json({ text: file.buffer.toString('utf-8') });
      return;
    }

    // Handle PDF via pdf-parse
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: file.buffer });

      try {
        const data = await parser.getText();
        res.json({ text: data.text });
      } finally {
        await parser.destroy();
      }
      return;
    }

    res.status(400).json({ error: 'Unsupported file type' });
  } catch (err: any) {
    console.error('Extract document error:', err);
    res.status(500).json({ error: err.message || 'Failed to extract document text' });
  }
});

// ─── AI Endpoints ────────────────────────────────────────────────

router.post('/analyze-profile', async (req: Request, res: Response) => {
  try {
    const { resume, jd } = req.body;
    const analysis = await openai.analyzeProfile(resume, jd);
    res.json({ analysis });
  } catch (err: any) {
    console.error('Analyze profile error:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze profile' });
  }
});

router.post('/extract-experiences', async (req: Request, res: Response) => {
  try {
    const { resume } = req.body;
    const experiences = await openai.extractExperiences(resume);
    res.json({ experiences });
  } catch (err: any) {
    console.error('Extract experiences error:', err);
    res.status(500).json({ error: err.message || 'Failed to extract experiences' });
  }
});

router.post('/generate-skill-map', async (req: Request, res: Response) => {
  try {
    const { resume, jd, experiences, personalContext, jobContext } = req.body;
    const skillMap = await openai.generateSkillMap(
      resume,
      jd,
      Array.isArray(experiences) ? experiences : [],
      personalContext,
      jobContext
    );
    res.json(skillMap);
  } catch (err: any) {
    console.error('Generate skill map error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate skill map' });
  }
});

router.post('/generate-questions', async (req: Request, res: Response) => {
  try {
    const { resume, jd, section, personalContext, jobContext } = req.body;
    const questions = await openai.generateQuestions(resume, jd, section, personalContext, jobContext);
    res.json({ questions });
  } catch (err: any) {
    console.error('Generate questions error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate questions' });
  }
});

router.post('/generate-experience-questions', async (req: Request, res: Response) => {
  try {
    const { jd, expTitle, expDesc, personalContext, jobContext } = req.body;
    const questions = await openai.generateExperienceQuestions(jd, expTitle, expDesc, personalContext, jobContext);
    res.json({ questions });
  } catch (err: any) {
    console.error('Generate experience questions error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate experience questions' });
  }
});

router.post('/generate-custom-answer', async (req: Request, res: Response) => {
  try {
    const { question, resume, jd, personalContext, jobContext } = req.body;
    const answer = await openai.generateCustomAnswer(question, resume, jd, personalContext, jobContext);
    res.json({ answer });
  } catch (err: any) {
    console.error('Generate custom answer error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate custom answer' });
  }
});

router.post('/generate-outline', async (req: Request, res: Response) => {
  try {
    const { question, answer } = req.body;
    const outline = await openai.generateOutline(question, answer);
    res.json({ outline });
  } catch (err: any) {
    console.error('Generate outline error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate outline' });
  }
});

router.post('/generate-cloze', async (req: Request, res: Response) => {
  try {
    const { answer } = req.body;
    const clozeText = await openai.generateClozeText(answer);
    res.json({ clozeText });
  } catch (err: any) {
    console.error('Generate cloze error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate cloze text' });
  }
});

export default router;
