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

type RankedEdge = {
  skillId: string;
  experienceId: string;
  experienceIndex: number;
  score: number;
  label: string;
};

const RESPONSIBILITY_HEADINGS = [
  'key responsibilities',
  'responsibilities',
  'what you will do',
  'what you’ll do',
  'what you will be doing',
  'what you\'ll be doing',
  'job duties',
  'duties',
  'core responsibilities',
  'role responsibilities',
];

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

function appendPromptContexts(prompt: string, personalContext = '', jobContext = ''): string {
  let nextPrompt = prompt;

  if (personalContext.trim()) {
    nextPrompt = appendAdditionalContext(nextPrompt, personalContext);
  }

  if (jobContext.trim()) {
    nextPrompt = `${nextPrompt}

Role and company context to use when generating the response:
${jobContext.trim()}

Important:
- Use this to tailor the answer to the target role, team, company, or hiring context.
- Apply it when it sharpens prioritization, terminology, examples, or interview framing.
- Do not mention this section explicitly in the output.`;
  }

  return nextPrompt;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#/.-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function extractResponsibilityLines(jd: string): string[] {
  const lines = jd
    .split('\n')
    .map((line) => line.replace(/\r/g, '').trim())
    .filter(Boolean);

  let inResponsibilities = false;
  const collected: string[] = [];

  for (const rawLine of lines) {
    const normalized = rawLine.toLowerCase().replace(/[:\-–—]+$/, '').trim();
    const isHeading = RESPONSIBILITY_HEADINGS.includes(normalized);
    const looksLikeSectionHeading =
      rawLine.length <= 60 &&
      !/^[\s\-*•0-9.()]+/.test(rawLine) &&
      /^[A-Za-z/&,\-–—' ]+$/.test(rawLine);

    if (isHeading) {
      inResponsibilities = true;
      continue;
    }

    if (inResponsibilities && looksLikeSectionHeading && !isHeading) {
      break;
    }

    if (inResponsibilities) {
      const cleaned = rawLine.replace(/^[\s\-*•0-9.()]+/, '').trim();
      if (cleaned) collected.push(cleaned);
    }
  }

  return collected.slice(0, 12);
}

function extractContextKeywords(jobContext: string): string[] {
  const ranked = new Map<string, number>();
  const phrases = jobContext
    .split('\n')
    .map((line) => line.replace(/^[\s\-*•0-9.()]+/, '').trim())
    .filter((line) => line.length >= 3)
    .flatMap((line) => line.match(/\b[A-Za-z][A-Za-z0-9+/.-]*(?:\s+[A-Za-z][A-Za-z0-9+/.-]*){0,2}\b/g) || []);

  phrases.forEach((phrase, index) => {
    const cleaned = sentenceCase(phrase);
    if (tokenize(cleaned).length === 0) return;
    ranked.set(cleaned, (ranked.get(cleaned) || 0) + Math.max(1, 20 - index));
  });

  return [...ranked.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label)
    .slice(0, 8);
}

function buildEvidenceLabel(skillLabel: string, experience: { title: string; description: string }): string {
  const skillTokens = new Set(tokenize(skillLabel));
  const experienceTokens = tokenize(`${experience.title} ${experience.description}`);
  const sharedTokens = Array.from(new Set(experienceTokens.filter((token) => skillTokens.has(token))));

  if (sharedTokens.length >= 2) {
    return sentenceCase(sharedTokens.slice(0, 2).join(' '));
  }

  if (sharedTokens.length === 1) {
    return sentenceCase(sharedTokens[0]);
  }

  const descriptionLead = experience.description
    .split('\n')
    .map((line) => line.trim().replace(/^[\s\-*•0-9.()]+/, ''))
    .find(Boolean);

  if (descriptionLead) {
    return sentenceCase(descriptionLead.split(/\s+/).slice(0, 3).join(' '));
  }

  return 'Best fit';
}

function scoreSkillExperienceMatch(skillLabel: string, experience: { title: string; description: string }): number {
  const skillTokens = new Set(tokenize(skillLabel));
  const haystack = `${experience.title} ${experience.description}`.toLowerCase();
  const experienceTokens = tokenize(haystack);
  let score = experienceTokens.filter((token) => skillTokens.has(token)).length * 3;

  if (score === 0) {
    const skillLower = skillLabel.toLowerCase();
    if (haystack.includes(skillLower)) {
      score += 4;
    } else {
      for (const token of skillTokens) {
        if (haystack.includes(token)) score += 1;
      }
    }
  }

  return score;
}

function buildBoundedEdges(
  skillNodes: SkillMapNode[],
  experienceNodes: SkillMapNode[],
  experiences: { title: string; description: string }[]
): SkillMapEdge[] {
  const rankAllPairs: RankedEdge[] = skillNodes.flatMap((skillNode) =>
    experiences.map((experience, experienceIndex) => ({
      skillId: skillNode.id,
      experienceId: experienceNodes[experienceIndex]?.id || '',
      experienceIndex,
      score: scoreSkillExperienceMatch(skillNode.label, experience),
      label: buildEvidenceLabel(skillNode.label, experience),
    }))
  ).filter((pair) => pair.experienceId);

  const rankedPairs = rankAllPairs.sort((a, b) => b.score - a.score);
  const degreeBySkill = new Map<string, number>();
  const degreeByExperience = new Map<string, number>();
  const selected: SkillMapEdge[] = [];
  const selectedKeys = new Set<string>();

  const trySelect = (pair: RankedEdge) => {
    if ((degreeBySkill.get(pair.skillId) || 0) >= 2) return false;
    if ((degreeByExperience.get(pair.experienceId) || 0) >= 2) return false;
    const key = `${pair.skillId}:${pair.experienceId}`;
    if (selectedKeys.has(key)) return false;

    selected.push({
      id: `edge-${pair.skillId}-${pair.experienceId}-${selected.length + 1}`,
      source: pair.skillId,
      target: pair.experienceId,
      label: pair.label,
    });
    selectedKeys.add(key);
    degreeBySkill.set(pair.skillId, (degreeBySkill.get(pair.skillId) || 0) + 1);
    degreeByExperience.set(pair.experienceId, (degreeByExperience.get(pair.experienceId) || 0) + 1);
    return true;
  };

  experienceNodes.forEach((experienceNode) => {
    const bestForExperience =
      rankedPairs.find((pair) => pair.experienceId === experienceNode.id && pair.score > 0) ||
      rankedPairs.find((pair) => pair.experienceId === experienceNode.id);
    if (bestForExperience) trySelect(bestForExperience);
  });

  skillNodes.forEach((skillNode) => {
    if ((degreeBySkill.get(skillNode.id) || 0) > 0) return;
    const bestForSkill =
      rankedPairs.find((pair) => pair.skillId === skillNode.id && pair.score > 0) ||
      rankedPairs.find((pair) => pair.skillId === skillNode.id);
    if (bestForSkill) trySelect(bestForSkill);
  });

  rankedPairs
    .filter((pair) => pair.score > 0)
    .forEach((pair) => {
      trySelect(pair);
    });

  return selected;
}

function extractSkillCandidates(jd: string, jobContext = ''): string[] {
  const responsibilityLines = extractResponsibilityLines(jd);
  const sourceText = responsibilityLines.length > 0 ? responsibilityLines.join('\n') : jd;

  const lineCandidates = sourceText
    .split('\n')
    .map((line) => line.replace(/^[\s\-*•0-9.()]+/, '').trim())
    .filter((line) => line.length >= 3 && line.length <= 80)
    .filter((line) => /[A-Za-z]/.test(line))
    .filter((line) => !/[.?!]$/.test(line) || line.split(/\s+/).length <= 5);

  const phraseCandidates = Array.from(
    new Set(
      sourceText.match(/\b[A-Za-z][A-Za-z0-9+/.-]*(?:\s+[A-Za-z][A-Za-z0-9+/.-]*){0,2}\b/g) || []
    )
  )
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length >= 4 && phrase.length <= 32)
    .filter((phrase) => {
      const words = phrase.toLowerCase().split(/\s+/);
      return words.some((word) => !STOPWORDS.has(word)) && !words.every((word) => STOPWORDS.has(word));
    });

  const ranked = new Map<string, number>();
  const contextKeywords = extractContextKeywords(jobContext);

  [...lineCandidates, ...phraseCandidates].forEach((candidate, index) => {
    const cleaned = sentenceCase(candidate);
    if (!cleaned) return;
    const current = ranked.get(cleaned) || 0;
    const responsibilityBoost = responsibilityLines.some((line) =>
      line.toLowerCase().includes(cleaned.toLowerCase())
    )
      ? 25
      : 0;
    const cleanedTokens = tokenize(cleaned);
    const contextBoost = contextKeywords.some((keyword) => {
      const keywordTokens = tokenize(keyword);
      return keywordTokens.some((token) => cleanedTokens.includes(token));
    })
      ? 10
      : 0;
    ranked.set(cleaned, current + Math.max(1, 30 - index) + responsibilityBoost + contextBoost);
  });

  return [...ranked.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([candidate]) => candidate)
    .filter((candidate) => tokenize(candidate).length > 0)
    .slice(0, 6);
}

function buildFallbackSkillMap(
  jd: string,
  experiences: { title: string; description: string }[],
  jobContext = ''
): SkillMapData {
  const normalizedExperiences = experiences.filter(
    (experience) => experience.title.trim().length > 0 || experience.description.trim().length > 0
  );

  const skillLabels = extractSkillCandidates(jd, jobContext);
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
    note: 'Directly aligned to a JD responsibility',
  }));
  const edges = buildBoundedEdges(skillNodes, experienceNodes, normalizedExperiences);

  return {
    nodes: [...skillNodes, ...experienceNodes],
    edges,
  };
}

function sanitizeSkillMap(
  skillMap: SkillMapData,
  jd: string,
  experiences: { title: string; description: string }[],
  jobContext = ''
): SkillMapData {
  const fallback = buildFallbackSkillMap(jd, experiences, jobContext);
  const experienceLookup = new Map(
    fallback.nodes.filter((node) => node.type === 'experience').map((node) => [node.label.toLowerCase(), node.id])
  );
  const fallbackExperienceNodes = fallback.nodes.filter((node) => node.type === 'experience');

  const nodes = Array.isArray(skillMap.nodes) ? skillMap.nodes : [];

  const normalizedSkillNodes: SkillMapNode[] = nodes
    .filter((node): node is SkillMapNode => Boolean(node?.id && node?.type && node?.label))
    .filter((node) => node.type === 'skill')
    .map((node) => ({
      id: node.id,
      type: 'skill',
      label: sentenceCase(node.label),
      note: node.note?.trim() || '',
    }));

  if (normalizedSkillNodes.length === 0 || fallbackExperienceNodes.length === 0) {
    return fallback;
  }

  const finalNodes: SkillMapNode[] = [...normalizedSkillNodes, ...fallbackExperienceNodes];
  const edges = buildBoundedEdges(normalizedSkillNodes, fallbackExperienceNodes, experiences);

  return {
    nodes: finalNodes,
    edges: edges.length > 0 ? edges : fallback.edges,
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
  personalContext = '',
  jobContext = ''
): Promise<{ question: string; answer: string }[]> {
  const prompt = getPrompt('generateQuestions');
  const sectionFocus = SECTION_FOCUS[section] || SECTION_FOCUS.BEHAVIORAL;
  const baseTemplate = prompt?.template || '';
  const text = appendPromptContexts(
    fillTemplate(baseTemplate, { resume, jd, sectionFocus }) +
      '\n\nRespond with a JSON object with a single key "items" containing an array of objects, each with "question" and "answer" string fields.',
    personalContext,
    jobContext
  );

  const result = await generateJSON<{ items?: { question: string; answer: string }[] }>(text);
  return result.items || [];
}

export async function generateExperienceQuestions(
  jd: string,
  expTitle: string,
  expDesc: string,
  personalContext = '',
  jobContext = ''
): Promise<{ question: string; answer: string }[]> {
  const prompt = getPrompt('generateExperienceQuestions');
  const baseTemplate = prompt?.template || '';
  const text = appendPromptContexts(
    fillTemplate(baseTemplate, { jd, expTitle, expDesc }) +
      '\n\nRespond with a JSON object with a single key "items" containing an array of objects, each with "question" and "answer" string fields.',
    personalContext,
    jobContext
  );

  const result = await generateJSON<{ items?: { question: string; answer: string }[] }>(text);
  return result.items || [];
}

export async function generateCustomAnswer(
  question: string,
  resume: string,
  jd: string,
  personalContext = '',
  jobContext = ''
): Promise<string> {
  const prompt = getPrompt('generateCustomAnswer');
  const text = appendPromptContexts(
    fillTemplate(prompt?.template || '', { question, resume, jd }),
    personalContext,
    jobContext
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
  experiences: { title: string; description: string }[],
  personalContext = '',
  jobContext = ''
): Promise<SkillMapData> {
  if (experiences.length === 0) {
    return { nodes: [], edges: [] };
  }

  try {
    const prompt = getPrompt('generateSkillMap');
    const responsibilityExcerpt = extractResponsibilityLines(jd).join('\n');
    const text = appendPromptContexts(
      fillTemplate(prompt?.template || '', {
        resume,
        jd,
        experiences: JSON.stringify(experiences, null, 2),
        responsibilities: responsibilityExcerpt || 'No explicit Key Responsibilities section found.',
      }),
      personalContext,
      jobContext
    );

    const result = await generateJSON<SkillMapData>(text);
    return sanitizeSkillMap(result, jd, experiences, jobContext);
  } catch (error) {
    console.error('Falling back to deterministic skill map:', error);
    return buildFallbackSkillMap(jd, experiences, jobContext);
  }
}
