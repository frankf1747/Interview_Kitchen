import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_FILE = path.resolve(__dirname, '..', 'prompts.json');

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
}

const DEFAULT_PROMPTS: PromptTemplate[] = [
  {
    id: 'extractDocument',
    name: 'Extract Document Text',
    description: 'Extracts readable text from uploaded PDF documents via multimodal API.',
    template: `Extract all the readable text from this document accurately. Do not include any conversational filler, markdown formatting (like \`\`\`), or commentary. Just return the raw extracted text content.`,
  },
  {
    id: 'analyzeProfile',
    name: 'Coach\'s Note (Profile Analysis)',
    description: 'Generates a 3-sentence mentor-style summary of resume fit vs. job description.',
    template: `You are an expert Senior HR and Hiring Manager.
Analyze the following candidate's Resume against the provided Job Description.
Provide a brief, encouraging, and professional 3-sentence summary of their fit, highlighting one key strength and one potential area to focus on during the interview.

Resume:
{{resume}}

Job Description:
{{jd}}`,
  },
  {
    id: 'extractExperiences',
    name: 'Extract Experiences from Resume',
    description: 'Pulls out individual jobs, internships, and projects as structured entries.',
    template: `You are an expert recruiter. Extract the candidate's professional experiences from the provided resume.
Specifically focus on Internships, Jobs, and Major Projects.
For each, extract a concise 'title' (e.g., "Software Engineering Intern at Google") and a 'description' containing their key bullet points and achievements.

Resume:
{{resume}}`,
  },
  {
    id: 'generateQuestions',
    name: 'Generate Interview Questions',
    description: 'Generates 3 interview Q&As for a given section type (behavioral, technical, etc.).',
    template: `Act as a Senior HR and Hiring Manager preparing an interview for a candidate.
Based on the provided Resume and Job Description, generate exactly 3 highly likely interview questions focusing on: {{sectionFocus}}.
For each question, also provide the "best possible answer" that the candidate should give. This answer MUST explicitly connect their specific resume experience to the job requirements. Use the STAR method where appropriate.

Resume:
{{resume}}

Job Description:
{{jd}}`,
  },
  {
    id: 'generateExperienceQuestions',
    name: 'Generate Experience-Specific Questions',
    description: 'Generates 3 targeted Q&As diving into a specific past experience.',
    template: `Act as a Senior HR and Hiring Manager.
The candidate is applying for a role with this Job Description:
{{jd}}

They have the following specific past experience (such as an internship or project):
Title: {{expTitle}}
Description: {{expDesc}}

Generate exactly 3 highly targeted interview questions diving specifically into THIS experience. Aim to see how this exact experience proves they are a fit for the target Job Description.
For each question, also provide the "best possible answer" that the candidate should give, strictly connecting their specific actions/results in this experience to what the new company needs.`,
  },
  {
    id: 'generateCustomAnswer',
    name: 'Generate Custom Answer',
    description: 'Generates an optimal answer for a user-provided custom question.',
    template: `Act as a Senior HR and Hiring Manager preparing an interview for a candidate.
The candidate has provided a specific custom interview question they want to prepare for.
Based on the provided Resume and Job Description, generate the "best possible answer" that the candidate should give.
This answer MUST explicitly connect their specific resume experience to the job requirements.
Use the STAR method where appropriate. Keep the answer well-structured, concise, and highly relevant.

Custom Question:
{{question}}

Resume:
{{resume}}

Job Description:
{{jd}}`,
  },
  {
    id: 'generateOutline',
    name: 'Generate Answer Outline',
    description: 'Creates a 3-5 bullet point outline of key concepts from an answer.',
    template: `You are an expert interview coach. I need to memorize the core concepts of my interview answer.
Create a highly memorable, concise bullet-point outline (3-5 points) for the following answer to the given question.
Focus on extracting the key logical steps, specific metrics, or the STAR (Situation, Task, Action, Result) components if present.
Keep each bullet point short and punchy.

Question: {{question}}
Answer: {{answer}}`,
  },
  {
    id: 'generateCloze',
    name: 'Generate Fill-in-the-Blanks',
    description: 'Converts an answer into a cloze (fill-in-the-blanks) memorization exercise.',
    template: `You are an expert learning coach. Take the following interview answer and convert it into a fill-in-the-blanks (cloze) exercise to help the candidate memorize it.
Identify the most important key phrases, metrics, action verbs, and core nouns, and wrap them EXACTLY in double curly braces, like {{this}}.
Leave the rest of the text completely unchanged. Do not add any extra text, markdown, or explanations.
Target hiding about 30% to 40% of the meaningful words.

Answer: {{answer}}`,
  },
  {
    id: 'generateSkillMap',
    name: 'Generate JD Skill Map',
    description: 'Creates a compact skill-to-experience graph connecting JD topics to the candidate’s extracted experiences.',
    template: `You are an expert interview coach helping a candidate understand how their resume aligns to a job description.
Extract the skill/topic nodes primarily from the Job Description's "Key Responsibilities" or equivalent responsibilities section, then connect each one to the single best proving experience from the candidate's background.

Return JSON only with this shape:
{
  "nodes": [
    { "id": "skill-1", "type": "skill", "label": "Skill name", "note": "short why it matters" },
    { "id": "exp-1", "type": "experience", "label": "Experience title", "note": "short evidence summary" }
  ],
  "edges": [
    { "id": "edge-1", "source": "skill-1", "target": "exp-1", "label": "keyword or short rationale" }
  ]
}

Rules:
- Only include node types "skill" and "experience".
- Focus on skill -> experience connections only.
- Include 4 to 6 skill/topic nodes.
- Derive skill/topic nodes from the responsibility bullets first, not from generic qualifications or broad boilerplate.
- If role and company context is provided, use it to prioritize and sharpen the responsibility-derived nodes so they reflect what matters most in this specific job.
- Keep each skill node very close to the language of a key responsibility, but concise enough to scan quickly in an interview prep map.
- Reuse only the provided experiences; do not invent new experience nodes.
- Every skill node must connect to exactly one best-fit experience node.
- Include all provided experiences as experience nodes, even if some are weaker evidence.
- Keep the graph sparse: no node should have more than 2 total connections.
- Prefer themes that a hiring manager would naturally ask about from the responsibilities section. Good examples: process optimization, analytics, automation, experimentation, product judgment, stakeholder communication.
- Avoid generic or weak themes unless they are clearly central to the role.
- Keep labels concise and human-readable.
- Skill notes should explain why the theme matters for the target role.
- Experience notes should summarize the strongest evidence from that experience.
- Edge labels should be short proof phrases that would help the candidate tell the interview story.

Key Responsibilities excerpt:
{{responsibilities}}

Resume:
{{resume}}

Job Description:
{{jd}}

Experiences:
{{experiences}}`,
  },
];

export function getDefaults(): PromptTemplate[] {
  return DEFAULT_PROMPTS;
}

export function loadPrompts(): PromptTemplate[] {
  const defaults = [...DEFAULT_PROMPTS];
  try {
    if (fs.existsSync(PROMPTS_FILE)) {
      const data = fs.readFileSync(PROMPTS_FILE, 'utf-8');
      const saved = JSON.parse(data) as PromptTemplate[];
      const savedById = new Map(saved.map((prompt) => [prompt.id, prompt]));
      return defaults.map((prompt) => savedById.get(prompt.id) || prompt);
    }
  } catch {
    // fall through to defaults
  }
  return defaults;
}

export function savePrompts(prompts: PromptTemplate[]): void {
  fs.writeFileSync(PROMPTS_FILE, JSON.stringify(prompts, null, 2), 'utf-8');
}

export function getPrompt(id: string): PromptTemplate | undefined {
  const prompts = loadPrompts();
  return prompts.find((p) => p.id === id);
}

export function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
