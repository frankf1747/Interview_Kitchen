import OpenAI from 'openai';
import { getPrompt, fillTemplate } from './promptStore.js';

export interface SkillMapNode {
  id: string;
  type: 'skill' | 'experience';
  label: string;
  note?: string;
}

export interface SkillMapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface SkillMapData {
  nodes: SkillMapNode[];
  edges: SkillMapEdge[];
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'build', 'by', 'for', 'from', 'in', 'into', 'is', 'of', 'on', 'or',
  'our', 'the', 'to', 'with', 'you', 'your', 'will', 'we', 'their', 'this', 'that', 'using', 'use', 'used',
  'ability', 'abilities', 'experience', 'experienced', 'including', 'plus', 'such', 'across', 'through',
  'strong', 'excellent', 'preferred', 'required', 'requirements', 'responsibilities', 'knowledge', 'skills',
  'skill', 'team', 'teams', 'work', 'working', 'role', 'position', 'candidate', 'support', 'develop', 'design',
  'builds', 'building', 'deliver', 'delivering', 'lead', 'leading'
]);

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  return new OpenAI({ apiKey });
}

function getModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-4o';
}

async function generateText(prompt: string): Promise<string> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: getModel(),
    messages: [{ role: 'user', content: prompt }],
  });
  return response.choices[0]?.message?.content?.trim() || '';
}

async function generateJSON<T>(prompt: string): Promise<T> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: getModel(),
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });
  const text = response.choices[0]?.message?.content?.trim() || '{}';
  return JSON.parse(text) as T;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function sentenceCase(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function appendAdditionalContext(prompt: string, additionalContext?: string): string {
  const trimmed = additionalContext?.trim();
  if (!trimmed) return prompt;

  return `${prompt}

Additional candidate context to use when generating the response:
${trimmed}

Important:
- Use this context when it improves relevance and accuracy.
- Prioritize the most recent work and responsibilities when they strengthen the answer.
- Do not mention this section explicitly in the output.`;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#/.-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function extractSkillCandidates(jd: string): string[] {
  const lineCandidates = jd
    .split('\n')
    .map((line) => line.replace(/^[\s\-*•0-9.()]+/, '').trim())
    .filter((line) => line.length >= 3 && line.length <= 80)
    .filter((line) => /[A-Za-z]/.test(line))
    .filter((line) => !/[.?!]$/.test(line) || line.split(/\s+/).length <= 5);

  const phraseCandidates = Array.from(
    new Set(
      jd.match(/\b[A-Za-z][A-Za-z0-9+/.-]*(?:\s+[A-Za-z][A-Za-z0-9+/.-]*){0,2}\b/g) || []
    )
  )
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length >= 4 && phrase.length <= 32)
    .filter((phrase) => {
      const words = phrase.toLowerCase().split(/\s+/);
      return words.some((word) => !STOPWORDS.has(word)) && !words.every((word) => STOPWORDS.has(word));
    });

  const ranked = new Map<string, number>();
  [...lineCandidates, ...phraseCandidates].forEach((candidate, index) => {
    const cleaned = sentenceCase(candidate);
    if (!cleaned) return;
    const current = ranked.get(cleaned) || 0;
    ranked.set(cleaned, current + Math.max(1, 30 - index));
  });

  return [...ranked.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([candidate]) => candidate)
    .filter((candidate) => tokenize(candidate).length > 0)
    .slice(0, 8);
}

function buildFallbackSkillMap(
  jd: string,
  experiences: { title: string; description: string }[]
): SkillMapData {
  const normalizedExperiences = experiences.filter(
    (experience) => experience.title.trim().length > 0 || experience.description.trim().length > 0
  );

  const skillLabels = extractSkillCandidates(jd);
  const experienceNodes: SkillMapNode[] = normalizedExperiences.map((experience, index) => ({
    id: `experience-${slugify(experience.title || `experience-${index + 1}`) || index + 1}`,
    type: 'experience',
    label: experience.title || `Experience ${index + 1}`,
    note: experience.description.split('\n').map((line) => line.trim()).filter(Boolean)[0]?.slice(0, 140) || '',
  }));

  const skillNodes: SkillMapNode[] = skillLabels.map((skill, index) => ({
    id: `skill-${slugify(skill) || index + 1}`,
    type: 'skill',
    label: skill,
    note: 'Key JD topic',
  }));

  const edges: SkillMapEdge[] = [];

  skillNodes.forEach((skillNode) => {
    const skillTokens = new Set(tokenize(skillNode.label));

    const rankedMatches = normalizedExperiences
      .map((experience, index) => {
        const haystack = `${experience.title} ${experience.description}`;
        const tokens = tokenize(haystack);
        const overlap = tokens.filter((token) => skillTokens.has(token)).length;
        const partial = overlap > 0
          ? overlap
          : tokens.some((token) => skillNode.label.toLowerCase().includes(token) || token.includes(skillNode.label.toLowerCase()))
            ? 1
            : 0;
        return { index, experience, score: partial };
      })
      .sort((a, b) => b.score - a.score);

    const matches = rankedMatches.filter((match) => match.score > 0).slice(0, 3);
    const selected = matches.length > 0 ? matches : rankedMatches.slice(0, Math.min(2, rankedMatches.length));

    selected.forEach((match, edgeIndex) => {
      const targetNode = experienceNodes[match.index];
      if (!targetNode) return;
      edges.push({
        id: `edge-${skillNode.id}-${targetNode.id}-${edgeIndex + 1}`,
        source: skillNode.id,
        target: targetNode.id,
        label: match.score > 0 ? 'Relevant overlap' : 'Potential example',
      });
    });
  });

  return {
    nodes: [...skillNodes, ...experienceNodes],
    edges,
  };
}

function sanitizeSkillMap(
  skillMap: SkillMapData,
  jd: string,
  experiences: { title: string; description: string }[]
): SkillMapData {
  const fallback = buildFallbackSkillMap(jd, experiences);
  const fallbackExperienceIds = new Set(fallback.nodes.filter((node) => node.type === 'experience').map((node) => node.id));
  const experienceLookup = new Map(
    fallback.nodes.filter((node) => node.type === 'experience').map((node) => [node.label.toLowerCase(), node.id])
  );

  const nodes = Array.isArray(skillMap.nodes) ? skillMap.nodes : [];
  const edges = Array.isArray(skillMap.edges) ? skillMap.edges : [];

  const normalizedNodes: SkillMapNode[] = nodes
    .filter((node): node is SkillMapNode => Boolean(node?.id && node?.type && node?.label))
    .filter((node) => node.type === 'skill' || node.type === 'experience')
    .map((node) => ({
      id: node.type === 'experience'
        ? experienceLookup.get(node.label.toLowerCase()) || node.id
        : node.id,
      type: node.type,
      label: sentenceCase(node.label),
      note: node.note?.trim() || '',
    }));

  const nodeIds = new Set(normalizedNodes.map((node) => node.id));
  const normalizedEdges: SkillMapEdge[] = edges
    .filter((edge): edge is SkillMapEdge => Boolean(edge?.source && edge?.target))
    .map((edge, index) => ({
      id: edge.id || `edge-${index + 1}`,
      source: edge.source,
      target: edge.target,
      label: edge.label?.trim() || '',
    }))
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .filter((edge) => {
      const source = normalizedNodes.find((node) => node.id === edge.source);
      const target = normalizedNodes.find((node) => node.id === edge.target);
      return source?.type === 'skill' && target?.type === 'experience';
    });

  if (normalizedNodes.filter((node) => node.type === 'skill').length === 0 || !fallbackExperienceIds.size) {
    return fallback;
  }

  if (normalizedEdges.length === 0) {
    return {
      nodes: normalizedNodes,
      edges: fallback.edges.filter((edge) => nodeIds.has(edge.source)),
    };
  }

  return {
    nodes: normalizedNodes,
    edges: normalizedEdges,
  };
}

export async function analyzeProfile(resume: string, jd: string): Promise<string> {
  const prompt = getPrompt('analyzeProfile');
  const text = fillTemplate(prompt?.template || '', { resume, jd });
  return generateText(text) || "Let's prepare for your interview!";
}

export async function extractExperiences(resume: string): Promise<{ title: string; description: string }[]> {
  const prompt = getPrompt('extractExperiences');
  const baseTemplate = prompt?.template || '';
  const text = fillTemplate(baseTemplate, { resume }) +
    '\n\nRespond with a JSON object with a single key "items" containing an array of objects, each with "title" and "description" string fields.';

  const result = await generateJSON<{ items?: { title: string; description: string }[] }>(text);
  return result.items || [];
}

const SECTION_FOCUS: Record<string, string> = {
  BEHAVIORAL:
    "soft skills, past behavior, leadership, conflict resolution, and cultural fit based on the company's presumed values in the JD.",
  TECHNICAL:
    'hard skills, tools, frameworks, and domain-specific knowledge explicitly mentioned or implied in the JD that the candidate needs to know.',
  RELEVANCE:
    "connecting specific projects, metrics, or experiences listed on the candidate's resume directly to the core responsibilities of the JD. Ask them to prove they can do the job based on past work.",
  ROLE_SPECIFIC:
    'hypothetical scenarios, day-to-day challenges, and specific outcomes expected for THIS exact role as described in the JD.',
};

export async function generateQuestions(
  resume: string,
  jd: string,
  section: string,
  additionalContext = ''
): Promise<{ question: string; answer: string }[]> {
  const prompt = getPrompt('generateQuestions');
  const sectionFocus = SECTION_FOCUS[section] || SECTION_FOCUS.BEHAVIORAL;
  const baseTemplate = prompt?.template || '';
  const text = appendAdditionalContext(
    fillTemplate(baseTemplate, { resume, jd, sectionFocus }) +
      '\n\nRespond with a JSON object with a single key "items" containing an array of objects, each with "question" and "answer" string fields.',
    additionalContext
  );

  const result = await generateJSON<{ items?: { question: string; answer: string }[] }>(text);
  return result.items || [];
}

export async function generateExperienceQuestions(
  jd: string,
  expTitle: string,
  expDesc: string,
  additionalContext = ''
): Promise<{ question: string; answer: string }[]> {
  const prompt = getPrompt('generateExperienceQuestions');
  const baseTemplate = prompt?.template || '';
  const text = appendAdditionalContext(
    fillTemplate(baseTemplate, { jd, expTitle, expDesc }) +
      '\n\nRespond with a JSON object with a single key "items" containing an array of objects, each with "question" and "answer" string fields.',
    additionalContext
  );

  const result = await generateJSON<{ items?: { question: string; answer: string }[] }>(text);
  return result.items || [];
}

export async function generateCustomAnswer(
  question: string,
  resume: string,
  jd: string,
  additionalContext = ''
): Promise<string> {
  const prompt = getPrompt('generateCustomAnswer');
  const text = appendAdditionalContext(
    fillTemplate(prompt?.template || '', { question, resume, jd }),
    additionalContext
  );
  return (await generateText(text)) || 'Failed to generate an answer.';
}

export async function generateOutline(question: string, answer: string): Promise<string[]> {
  const prompt = getPrompt('generateOutline');
  const baseTemplate = prompt?.template || '';
  const text = fillTemplate(baseTemplate, { question, answer }) +
    '\n\nRespond with a JSON object with a single key "items" containing an array of short bullet point strings.';

  const result = await generateJSON<{ items?: string[] }>(text);
  return result.items || [];
}

export async function generateClozeText(answer: string): Promise<string> {
  const prompt = getPrompt('generateCloze');
  const text = fillTemplate(prompt?.template || '', { answer });
  return (await generateText(text)) || 'Error generating memory exercise.';
}

export async function generateSkillMap(
  resume: string,
  jd: string,
  experiences: { title: string; description: string }[]
): Promise<SkillMapData> {
  if (experiences.length === 0) {
    return { nodes: [], edges: [] };
  }

  try {
    const prompt = getPrompt('generateSkillMap');
    const text = fillTemplate(prompt?.template || '', {
      resume,
      jd,
      experiences: JSON.stringify(experiences, null, 2),
    });

    const result = await generateJSON<SkillMapData>(text);
    return sanitizeSkillMap(result, jd, experiences);
  } catch (error) {
    console.error('Falling back to deterministic skill map:', error);
    return buildFallbackSkillMap(jd, experiences);
  }
}
