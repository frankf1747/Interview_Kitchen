import { MindMapData, MindMapEdge, MindMapNode } from '../types';

type IncomingNode = Partial<MindMapNode> & Pick<MindMapNode, 'id' | 'type' | 'label'>;
type IncomingEdge = Partial<MindMapEdge> & Pick<MindMapEdge, 'source' | 'target'>;

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

function extractSkillCandidates(jd: string): string[] {
  const lower = jd.toLowerCase();
  const found = new Map<string, number>();

  // 1. Match known compound phrases first (highest priority)
  KNOWN_COMPOUNDS.forEach((compound) => {
    const escapedPattern = compound.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s/-]+');
    const re = new RegExp(`\\b${escapedPattern}\\b`, 'gi');
    const matches = jd.match(re);
    if (matches && matches.length > 0) {
      const label = titleCase(compound);
      found.set(label, (found.get(label) || 0) + matches.length * 25);
    }
  });

  // 2. Match 1–3 word phrases from the JD
  const phraseRe = /\b([A-Za-z][A-Za-z0-9+#/.']*(?:\s+[A-Za-z][A-Za-z0-9+#/.']*){0,2})\b/g;
  let match: RegExpExecArray | null;
  let phraseIndex = 0;
  while ((match = phraseRe.exec(jd)) !== null) {
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
    const score = brevityBonus + positionBonus + 1;

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
    .slice(0, 8);
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
  const edges = rawEdges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e, i) => ({
      id: e.id || `edge-${i + 1}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      label: e.label || '',
    }));

  return { nodes: positionedNodes, edges, edited };
}

/**
 * Build a deterministic mind map purely from the JD text + experience list.
 * Used when the AI call fails or returns nothing.
 */
export function buildFallbackMindMap(
  jd: string,
  experiences: { title: string; description: string }[],
  edited = false
): MindMapData {
  const normalizedExperiences = experiences.filter(
    (exp) => exp.title.trim().length > 0 || exp.description.trim().length > 0,
  );

  const skillLabels = extractSkillCandidates(jd);

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
      note: skillLabels.length > 0 ? 'Key JD topic' : 'Placeholder — regenerate for JD-specific skills',
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

  const edges: MindMapEdge[] = nodes
    .filter((n) => n.type === 'skill')
    .flatMap((skillNode) => {
      const skillTokens = new Set(tokenize(skillNode.label));

      const ranked = normalizedExperiences
        .map((exp, idx) => {
          const haystack = `${exp.title} ${exp.description}`;
          const haystackTokens = tokenize(haystack);
          // Exact token overlap
          let overlap = haystackTokens.filter((t) => skillTokens.has(t)).length;
          // Partial substring matching for compound skills
          if (overlap === 0) {
            const skillLower = skillNode.label.toLowerCase();
            if (haystack.toLowerCase().includes(skillLower)) {
              overlap = 3;
            } else {
              for (const token of skillTokens) {
                if (haystack.toLowerCase().includes(token)) {
                  overlap += 1;
                }
              }
            }
          }
          return { idx, score: overlap };
        })
        .sort((a, b) => b.score - a.score);

      const selected = ranked.some((e) => e.score > 0)
        ? ranked.filter((e) => e.score > 0).slice(0, 3)
        : ranked.slice(0, Math.min(2, ranked.length));

      return selected.map((m, edgeIdx) => ({
        id: `edge-${skillNode.id}-${experienceNodes[m.idx]?.id || 'unknown'}-${edgeIdx + 1}`,
        source: skillNode.id,
        target: experienceNodes[m.idx]?.id || experienceNodes[0]?.id || '',
        label: m.score > 0 ? '' : '',
      }));
    })
    .filter((e) => e.target);

  return { nodes, edges, edited };
}
