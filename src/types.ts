export enum SectionType {
  BEHAVIORAL = 'BEHAVIORAL',
  TECHNICAL = 'TECHNICAL',
  RELEVANCE = 'RELEVANCE',
  ROLE_SPECIFIC = 'ROLE_SPECIFIC',
}

export type GeneralView = 'mindMap' | SectionType;

export interface QuestionItem {
  id: string;
  question: string;
  answer: string;
  outline?: string[];
  clozeText?: string;
  isCustom?: boolean;
}

export interface Experience {
  id: string;
  title: string;
  description: string;
  questions: QuestionItem[];
}

export interface MindMapNode {
  id: string;
  type: 'skill' | 'experience';
  label: string;
  note?: string;
  position: {
    x: number;
    y: number;
  };
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface MindMapData {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  edited: boolean;
}

export interface AppState {
  resumeText: string;
  jdText: string;
  additionalContext: string;
  questions: Record<SectionType, QuestionItem[]>;
  experiences: Experience[];
  activeTab: 'general' | 'experiences';
  activeSection: SectionType;
  activeGeneralView: GeneralView;
  isSetupComplete: boolean;
  mentorAnalysis?: string;
  mindMap: MindMapData;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
}

export const createEmptyMindMap = (): MindMapData => ({
  nodes: [],
  edges: [],
  edited: false,
});

export const createInitialAppState = (): AppState => ({
  resumeText: '',
  jdText: '',
  additionalContext: '',
  questions: {
    [SectionType.BEHAVIORAL]: [],
    [SectionType.TECHNICAL]: [],
    [SectionType.RELEVANCE]: [],
    [SectionType.ROLE_SPECIFIC]: [],
  },
  experiences: [],
  activeTab: 'general',
  activeSection: SectionType.BEHAVIORAL,
  activeGeneralView: 'mindMap',
  isSetupComplete: false,
  mentorAnalysis: '',
  mindMap: createEmptyMindMap(),
});

export function normalizeAppState(raw: Partial<AppState>): AppState {
  const initial = createInitialAppState();

  return {
    ...initial,
    ...raw,
    additionalContext: typeof raw.additionalContext === 'string' ? raw.additionalContext : initial.additionalContext,
    questions: {
      ...initial.questions,
      ...(raw.questions || {}),
    },
    experiences: Array.isArray(raw.experiences)
      ? raw.experiences.map((experience) => ({
          ...experience,
          questions: Array.isArray(experience.questions) ? experience.questions : [],
        }))
      : initial.experiences,
    activeGeneralView:
      raw.activeGeneralView === 'mindMap' || Object.values(SectionType).includes(raw.activeGeneralView as SectionType)
        ? (raw.activeGeneralView as GeneralView)
        : initial.activeGeneralView,
    activeSection: Object.values(SectionType).includes(raw.activeSection as SectionType)
      ? (raw.activeSection as SectionType)
      : initial.activeSection,
    mindMap: {
      nodes: Array.isArray(raw.mindMap?.nodes)
        ? raw.mindMap.nodes.map((node) => ({
            ...node,
            position: node.position || { x: 0, y: 0 },
          }))
        : initial.mindMap.nodes,
      edges: Array.isArray(raw.mindMap?.edges) ? raw.mindMap.edges : initial.mindMap.edges,
      edited: Boolean(raw.mindMap?.edited),
    },
  };
}
