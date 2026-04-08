import { MindMapData, MindMapEdge, MindMapNode } from '../types';

type IncomingNode = Partial<MindMapNode> & Pick<MindMapNode, 'id' | 'type' | 'label'>;
type IncomingEdge = Partial<MindMapEdge> & Pick<MindMapEdge, 'source' | 'target'>;
type RankedEdge = {
  skillId: string;
  experienceId: string;
  experienceIndex: number;
  score: number;
  label: string;
};

/* ── Layout constants ──────────────────────────────────────────────── */

const SKILL_X = 60;
const EXPERIENCE_X = 580;
const START_Y = 60;
const NODE_GAP_Y = 120;

/* ── Stopwords — keep aggressive to surface real skills ──────────── */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'for', 'from', 'has', 'have',
  'how', 'in', 'into', 'is', 'it', 'its', 'may', 'no', 'not', 'of', 'on', 'or', 'our', 'out',
  'own', 'per', 'so', 'the', 'to', 'too', 'up', 'via', 'was', 'who', 'why', 'will', 'with',
  'your', 'you', 'we', 'they', 'their', 'them', 'this', 'that', 'than', 'then', 'each', 'all',
  'any', 'both', 'but', 'few', 'more', 'most', 'new', 'now', 'old', 'one', 'other', 'such',
  'some', 'very', 'well', 'also', 'just', 'about', 'above', 'after', 'again',
  'using', 'use', 'used', 'experience', 'experiences', 'skilled', 'skills', 'skill',
  'knowledge', 'required', 'preferred', 'requirements', 'responsibilities', 'responsibility',
  'candidate', 'candidates', 'role', 'position', 'job',
  'team', 'teams', 'work', 'working', 'worked',
  'build', 'building', 'built', 'develop', 'developing', 'developed', 'development',
  'design', 'designing', 'designed',
  'support', 'supporting', 'supported',
  'strong', 'ability', 'abilities', 'able', 'capable',
  'across', 'within', 'between', 'including', 'include', 'includes',
  'ensure', 'help', 'make', 'making', 'manage', 'managing',
  'must', 'need', 'should', 'would', 'could',
  'years', 'year', 'plus', 'minimum', 'least',
  'company', 'business', 'organization', 'environment',
  'etc', 'e.g', 'i.e',
]);

/* ── Helpers ────────────────────────────────────────────────────────── */

function getFallbackPosition(type: MindMapNode['type'], index: number) {
  return {
    x: type === 'skill' ? SKILL_X : EXPERIENCE_X,
    y: START_Y + index * NODE_GAP_Y,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function titleCase(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#/.'-]+/)
    .map((token) => token.trim().replace(/^[.-]+|[.-]+$/g, ''))
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function buildEvidenceLabel(skillLabel: string, experience: { title: string; description: string }) {
  const skillTokens = new Set(tokenize(skillLabel));
  const experienceTokens = tokenize(`${experience.title} ${experience.description}`);
  const sharedTokens = Array.from(new Set(experienceTokens.filter((token) => skillTokens.has(token))));

  if (sharedTokens.length >= 2) return titleCase(sharedTokens.slice(0, 2).join(' '));
  if (sharedTokens.length === 1) return titleCase(sharedTokens[0]);

  const firstMeaningfulLine = experience.description
    .split('\n')
    .map((line) => line.trim().replace(/^[\s\-*•0-9.()]+/, ''))
    .find(Boolean);

  return firstMeaningfulLine ? titleCase(firstMeaningfulLine.split(/\s+/).slice(0, 3).join(' ')) : 'Best Fit';
}

function scoreSkillExperienceMatch(skillLabel: string, experience: { title: string; description: string }) {
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
  skillNodes: MindMapNode[],
  experienceNodes: MindMapNode[],
  experiences: { title: string; description: string }[],
) {
  const rankAllPairs: RankedEdge[] = skillNodes
    .flatMap((skillNode) =>
      experiences.map((experience, experienceIndex) => ({
        skillId: skillNode.id,
        experienceId: experienceNodes[experienceIndex]?.id || '',
        experienceIndex,
        score: scoreSkillExperienceMatch(skillNode.label, experience),
        label: buildEvidenceLabel(skillNode.label, experience),
      }))
    )
    .filter((pair) => pair.experienceId);

  const rankedPairs = rankAllPairs.sort((a, b) => b.score - a.score);
  const degreeBySkill = new Map<string, number>();
  const degreeByExperience = new Map<string, number>();
  const selected: MindMapEdge[] = [];
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

/**
 * Centre a column of nodes vertically so skill and experience columns
 * have a balanced visual weight even when counts differ.
 */
function centredPositions(
  count: number,
  xColumn: number,
  totalHeight: number,
): { x: number; y: number }[] {
  if (count === 0) return [];
  const gap = Math.min(NODE_GAP_Y, (totalHeight - 40) / Math.max(count, 1));
  const blockHeight = (count - 1) * gap;
  const startY = Math.max(START_Y, (totalHeight - blockHeight) / 2);
  return Array.from({ length: count }, (_, i) => ({
    x: xColumn,
    y: Math.round(startY + i * gap),
  }));
}

/* ── Skill extraction from JD ─────────────────────────────────────── */

/** Common tech / domain phrases the regex might split apart. */
const KNOWN_COMPOUNDS = [
  'machine learning', 'deep learning', 'natural language processing',
  'data science', 'data engineering', 'data analysis', 'data pipeline',
  'software engineering', 'software development',
  'front end', 'frontend', 'back end', 'backend', 'full stack', 'fullstack',
  'cloud computing', 'distributed systems', 'system design',
  'project management', 'product management', 'agile methodology',
  'ci/cd', 'ci cd', 'continuous integration', 'continuous delivery',
  'unit testing', 'integration testing', 'test driven',
  'cross functional', 'stakeholder management',
  'problem solving', 'critical thinking',
  'rest api', 'restful api', 'graphql api',
  'version control', 'object oriented',
];

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

function extractContextKeywords(jobContext: string) {
  const ranked = new Map<string, number>();
  const phrases = jobContext
    .split('\n')
    .map((line) => line.replace(/^[\s\-*•0-9.()]+/, '').trim())
    .filter((line) => line.length >= 3)
    .flatMap((line) => line.match(/\b[A-Za-z][A-Za-z0-9+/.-]*(?:\s+[A-Za-z][A-Za-z0-9+/.-]*){0,2}\b/g) || []);

  phrases.forEach((phrase, index) => {
    const cleaned = titleCase(phrase);
    if (tokenize(cleaned).length === 0) return;
    ranked.set(cleaned, (ranked.get(cleaned) || 0) + Math.max(1, 20 - index));
  });

  return [...ranked.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label)
    .slice(0, 8);
}

function extractSkillCandidates(jd: string, jobContext = ''): string[] {
  const responsibilityLines = extractResponsibilityLines(jd);
  const sourceText = responsibilityLines.length > 0 ? responsibilityLines.join('\n') : jd;
  const lower = sourceText.toLowerCase();
  const found = new Map<string, number>();
  const contextKeywords = extractContextKeywords(jobContext);

  // 1. Match known compound phrases first (highest priority)
  KNOWN_COMPOUNDS.forEach((compound) => {
    const escapedPattern = compound.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s/-]+');
    const re = new RegExp(`\\b${escapedPattern}\\b`, 'gi');
    const matches = sourceText.match(re);
    if (matches && matches.length > 0) {
      const label = titleCase(compound);
      found.set(label, (found.get(label) || 0) + matches.length * 25);
    }
  });

  // 2. Match 1–3 word phrases from the JD
  const phraseRe = /\b([A-Za-z][A-Za-z0-9+#/.']*(?:\s+[A-Za-z][A-Za-z0-9+#/.']*){0,2})\b/g;
  let match: RegExpExecArray | null;
  let phraseIndex = 0;
  while ((match = phraseRe.exec(sourceText)) !== null) {
    phraseIndex++;
    const raw = match[1].trim();
    if (raw.length < 2) continue;
    const cleaned = titleCase(raw);
    const tokens = tokenize(cleaned);
    if (tokens.length === 0) continue;

    // Bonus for shorter, punchier phrases (likely skill names)
    const brevityBonus = tokens.length <= 2 ? 5 : 0;
    // Bonus for phrases that appear early in the JD
    const positionBonus = Math.max(0, 20 - Math.floor(phraseIndex / 5));
    const responsibilityBoost = responsibilityLines.some((line) => line.toLowerCase().includes(cleaned.toLowerCase()))
      ? 25
      : 0;
    const cleanedTokens = tokenize(cleaned);
    const contextBoost = contextKeywords.some((keyword) => {
      const keywordTokens = tokenize(keyword);
      return keywordTokens.some((token) => cleanedTokens.includes(token));
    })
      ? 10
      : 0;
    const score = brevityBonus + positionBonus + 1 + responsibilityBoost + contextBoost;

    found.set(cleaned, (found.get(cleaned) || 0) + score);
  }

  // 3. Deduplicate: if a shorter phrase is a substring of a longer already-found one, merge scores
  const entries = [...found.entries()].sort((a, b) => b[1] - a[1]);
  const deduped = new Map<string, number>();
  for (const [label, score] of entries) {
    const lowerLabel = label.toLowerCase();
    let absorbed = false;
    for (const [existing] of deduped) {
      const lowerExisting = existing.toLowerCase();
      if (lowerExisting.includes(lowerLabel) && lowerExisting !== lowerLabel) {
        deduped.set(existing, (deduped.get(existing) || 0) + score);
        absorbed = true;
        break;
      }
    }
    if (!absorbed) {
      // Don't add if a substring of an existing entry
      let subsumed = false;
      for (const [existing] of deduped) {
        if (lowerLabel.includes(existing.toLowerCase()) && lowerLabel !== existing.toLowerCase()) {
          // Replace shorter with longer, carry score
          const existingScore = deduped.get(existing) || 0;
          deduped.delete(existing);
          deduped.set(label, score + existingScore);
          subsumed = true;
          break;
        }
      }
      if (!subsumed) {
        deduped.set(label, score);
      }
    }
  }

  // 4. Filter out single common words that slipped through
  const MIN_SCORE = 5;
  return [...deduped.entries()]
    .filter(([, score]) => score >= MIN_SCORE)
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label)
    .slice(0, 6);
}

/* ── Public builders ───────────────────────────────────────────────── */

/**
 * Build a positioned MindMapData from raw (possibly API-returned) nodes / edges.
 */
export function buildMindMap(
  rawNodes: IncomingNode[],
  rawEdges: IncomingEdge[],
  edited = false
): MindMapData {
  const skills = rawNodes.filter((n) => n.type === 'skill');
  const exps = rawNodes.filter((n) => n.type === 'experience');

  const totalHeight = Math.max(
    skills.length * NODE_GAP_Y,
    exps.length * NODE_GAP_Y,
    600,
  );

  const skillPositions = centredPositions(skills.length, SKILL_X, totalHeight);
  const expPositions = centredPositions(exps.length, EXPERIENCE_X, totalHeight);

  const positionedNodes: MindMapNode[] = [
    ...skills.map((node, i) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      note: node.note || '',
      position: node.position || skillPositions[i] || getFallbackPosition('skill', i),
    })),
    ...exps.map((node, i) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      note: node.note || '',
      position: node.position || expPositions[i] || getFallbackPosition('experience', i),
    })),
  ];

  const nodeIds = new Set(positionedNodes.map((n) => n.id));
  const sourceDegree = new Map<string, number>();
  const targetDegree = new Map<string, number>();
  const edges = rawEdges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e, i) => ({
      id: e.id || `edge-${i + 1}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      label: e.label || '',
    }))
    .filter((edge) => {
      const nextSourceDegree = (sourceDegree.get(edge.source) || 0) + 1;
      const nextTargetDegree = (targetDegree.get(edge.target) || 0) + 1;
      if (nextSourceDegree > 2 || nextTargetDegree > 2) return false;
      sourceDegree.set(edge.source, nextSourceDegree);
      targetDegree.set(edge.target, nextTargetDegree);
      return true;
    });

  return { nodes: positionedNodes, edges, edited };
}

/**
 * Build a deterministic mind map purely from the JD text + experience list.
 * Used when the AI call fails or returns nothing.
 */
export function buildFallbackMindMap(
  jd: string,
  experiences: { title: string; description: string }[],
  jobContext = '',
  edited = false
): MindMapData {
  const normalizedExperiences = experiences.filter(
    (exp) => exp.title.trim().length > 0 || exp.description.trim().length > 0,
  );

  const skillLabels = extractSkillCandidates(jd, jobContext);

  // If no skills found from JD, create generic placeholder skills
  const finalSkillLabels =
    skillLabels.length > 0
      ? skillLabels
      : ['Technical Skills', 'Domain Knowledge', 'Communication', 'Leadership'];

  const totalHeight = Math.max(
    finalSkillLabels.length * NODE_GAP_Y,
    normalizedExperiences.length * NODE_GAP_Y,
    600,
  );

  const skillPositions = centredPositions(finalSkillLabels.length, SKILL_X, totalHeight);
  const expPositions = centredPositions(normalizedExperiences.length, EXPERIENCE_X, totalHeight);

  const nodes: MindMapNode[] = [
    ...finalSkillLabels.map((label, i) => ({
      id: `skill-${slugify(label) || `s${i + 1}`}`,
      type: 'skill' as const,
      label,
      note: skillLabels.length > 0 ? 'Directly aligned to a JD responsibility' : 'Placeholder — regenerate for JD-specific skills',
      position: skillPositions[i] || getFallbackPosition('skill', i),
    })),
    ...normalizedExperiences.map((exp, i) => ({
      id: `experience-${slugify(exp.title || `experience-${i + 1}`) || `e${i + 1}`}`,
      type: 'experience' as const,
      label: exp.title || `Experience ${i + 1}`,
      note: exp.description.split('\n').map((l) => l.trim()).filter(Boolean)[0]?.slice(0, 140) || '',
      position: expPositions[i] || getFallbackPosition('experience', i),
    })),
  ];

  const experienceNodes = nodes.filter((n) => n.type === 'experience');

  const edges = buildBoundedEdges(
    nodes.filter((node): node is MindMapNode => node.type === 'skill'),
    experienceNodes,
    normalizedExperiences
  );

  return { nodes, edges, edited };
}
