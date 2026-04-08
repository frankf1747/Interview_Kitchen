import { MindMapEdge, MindMapNode, PromptTemplate } from '../types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Status & Setup ──────────────────────────────────────────────

export async function getStatus(): Promise<{ configured: boolean; model: string }> {
  return request('/status');
}

export async function setupApiKey(apiKey: string, model?: string): Promise<{ success: boolean; model: string }> {
  return request('/setup', {
    method: 'POST',
    body: JSON.stringify({ apiKey, model }),
  });
}

export async function updateModel(model: string): Promise<void> {
  await request('/update-model', { method: 'POST', body: JSON.stringify({ model }) });
}

// ─── Prompts ─────────────────────────────────────────────────────

export async function getPrompts(): Promise<PromptTemplate[]> {
  return request('/prompts');
}

export async function getDefaultPrompts(): Promise<PromptTemplate[]> {
  return request('/prompts/defaults');
}

export async function savePrompts(prompts: PromptTemplate[]): Promise<void> {
  await request('/prompts', { method: 'PUT', body: JSON.stringify(prompts) });
}

export async function resetPrompts(): Promise<PromptTemplate[]> {
  return request('/prompts/reset', { method: 'POST' });
}

// ─── Document Extraction ─────────────────────────────────────────

export async function extractDocument(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/extract-document`, { method: 'POST', body: formData });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to extract document');
  }
  const data = await res.json();
  return data.text;
}

// ─── AI Endpoints ────────────────────────────────────────────────

export async function analyzeProfile(resume: string, jd: string): Promise<string> {
  const data = await request<{ analysis: string }>('/analyze-profile', {
    method: 'POST',
    body: JSON.stringify({ resume, jd }),
  });
  return data.analysis;
}

export async function extractExperiences(resume: string): Promise<{ title: string; description: string }[]> {
  const data = await request<{ experiences: { title: string; description: string }[] }>('/extract-experiences', {
    method: 'POST',
    body: JSON.stringify({ resume }),
  });
  return data.experiences;
}

export async function generateSkillMap(
  resume: string,
  jd: string,
  experiences: { title: string; description: string }[],
  personalContext = '',
  jobContext = ''
): Promise<{ nodes: Omit<MindMapNode, 'position'>[]; edges: MindMapEdge[] }> {
  return request('/generate-skill-map', {
    method: 'POST',
    body: JSON.stringify({ resume, jd, experiences, personalContext, jobContext }),
  });
}

export async function generateQuestions(
  resume: string,
  jd: string,
  section: string,
  personalContext = '',
  jobContext = ''
): Promise<{ question: string; answer: string }[]> {
  const data = await request<{ questions: { question: string; answer: string }[] }>('/generate-questions', {
    method: 'POST',
    body: JSON.stringify({ resume, jd, section, personalContext, jobContext }),
  });
  return data.questions;
}

export async function generateExperienceQuestions(
  jd: string,
  expTitle: string,
  expDesc: string,
  personalContext = '',
  jobContext = ''
): Promise<{ question: string; answer: string }[]> {
  const data = await request<{ questions: { question: string; answer: string }[] }>(
    '/generate-experience-questions',
    { method: 'POST', body: JSON.stringify({ jd, expTitle, expDesc, personalContext, jobContext }) }
  );
  return data.questions;
}

export async function generateCustomAnswer(
  question: string,
  resume: string,
  jd: string,
  personalContext = '',
  jobContext = ''
): Promise<string> {
  const data = await request<{ answer: string }>('/generate-custom-answer', {
    method: 'POST',
    body: JSON.stringify({ question, resume, jd, personalContext, jobContext }),
  });
  return data.answer;
}

export async function generateOutline(question: string, answer: string): Promise<string[]> {
  const data = await request<{ outline: string[] }>('/generate-outline', {
    method: 'POST',
    body: JSON.stringify({ question, answer }),
  });
  return data.outline;
}

export async function generateClozeText(answer: string): Promise<string> {
  const data = await request<{ clozeText: string }>('/generate-cloze', {
    method: 'POST',
    body: JSON.stringify({ answer }),
  });
  return data.clozeText;
}
