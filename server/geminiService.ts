import { GoogleGenAI, Type } from '@google/genai';
import { getPrompt, fillTemplate } from './promptStore.js';

function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenAI({ apiKey });
}

function getModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-04-17';
}

export async function extractTextFromDocument(base64Data: string, mimeType: string): Promise<string> {
  const ai = getAI();
  const prompt = getPrompt('extractDocument');
  const text = prompt?.template || 'Extract all readable text from this document.';

  const response = await ai.models.generateContent({
    model: getModel(),
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType } },
        { text },
      ],
    },
  });
  return response.text || '';
}

export async function analyzeProfile(resume: string, jd: string): Promise<string> {
  const ai = getAI();
  const prompt = getPrompt('analyzeProfile');
  const text = fillTemplate(prompt?.template || '', { resume, jd });

  const response = await ai.models.generateContent({
    model: getModel(),
    contents: text,
  });
  return response.text || "Let's prepare for your interview!";
}

export async function extractExperiences(resume: string): Promise<{ title: string; description: string }[]> {
  const ai = getAI();
  const prompt = getPrompt('extractExperiences');
  const text = fillTemplate(prompt?.template || '', { resume });

  const response = await ai.models.generateContent({
    model: getModel(),
    contents: text,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'The role/title and company or project name.' },
            description: { type: Type.STRING, description: 'The combined bullet points and achievements for this role.' },
          },
          required: ['title', 'description'],
        },
      },
    },
  });

  if (!response.text) return [];
  return JSON.parse(response.text);
}

const SECTION_FOCUS: Record<string, string> = {
  BEHAVIORAL:
    'soft skills, past behavior, leadership, conflict resolution, and cultural fit based on the company\'s presumed values in the JD.',
  TECHNICAL:
    'hard skills, tools, frameworks, and domain-specific knowledge explicitly mentioned or implied in the JD that the candidate needs to know.',
  RELEVANCE:
    'connecting specific projects, metrics, or experiences listed on the candidate\'s resume directly to the core responsibilities of the JD. Ask them to prove they can do the job based on past work.',
  ROLE_SPECIFIC:
    'hypothetical scenarios, day-to-day challenges, and specific outcomes expected for THIS exact role as described in the JD.',
};

export async function generateQuestions(
  resume: string,
  jd: string,
  section: string
): Promise<{ question: string; answer: string }[]> {
  const ai = getAI();
  const prompt = getPrompt('generateQuestions');
  const sectionFocus = SECTION_FOCUS[section] || SECTION_FOCUS.BEHAVIORAL;
  const text = fillTemplate(prompt?.template || '', { resume, jd, sectionFocus });

  const response = await ai.models.generateContent({
    model: getModel(),
    contents: text,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: 'The interview question.' },
            answer: { type: Type.STRING, description: 'The optimal, tailored answer using candidate\'s background.' },
          },
          required: ['question', 'answer'],
        },
      },
    },
  });

  if (!response.text) return [];
  return JSON.parse(response.text);
}

export async function generateExperienceQuestions(
  jd: string,
  expTitle: string,
  expDesc: string
): Promise<{ question: string; answer: string }[]> {
  const ai = getAI();
  const prompt = getPrompt('generateExperienceQuestions');
  const text = fillTemplate(prompt?.template || '', { jd, expTitle, expDesc });

  const response = await ai.models.generateContent({
    model: getModel(),
    contents: text,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: 'The targeted interview question.' },
            answer: { type: Type.STRING, description: 'The optimal, tailored answer.' },
          },
          required: ['question', 'answer'],
        },
      },
    },
  });

  if (!response.text) return [];
  return JSON.parse(response.text);
}

export async function generateCustomAnswer(question: string, resume: string, jd: string): Promise<string> {
  const ai = getAI();
  const prompt = getPrompt('generateCustomAnswer');
  const text = fillTemplate(prompt?.template || '', { question, resume, jd });

  const response = await ai.models.generateContent({
    model: getModel(),
    contents: text,
  });
  return response.text?.trim() || 'Failed to generate an answer.';
}

export async function generateOutline(question: string, answer: string): Promise<string[]> {
  const ai = getAI();
  const prompt = getPrompt('generateOutline');
  const text = fillTemplate(prompt?.template || '', { question, answer });

  const response = await ai.models.generateContent({
    model: getModel(),
    contents: text,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING, description: 'A short, punchy bullet point.' },
      },
    },
  });

  if (!response.text) return [];
  return JSON.parse(response.text);
}

export async function generateClozeText(answer: string): Promise<string> {
  const ai = getAI();
  const prompt = getPrompt('generateCloze');
  const text = fillTemplate(prompt?.template || '', { answer });

  const response = await ai.models.generateContent({
    model: getModel(),
    contents: text,
  });
  return response.text?.trim() || 'Error generating memory exercise.';
}
