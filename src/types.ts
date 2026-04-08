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

export type ExperienceQuestionMap = Record<string, QuestionItem[]>;

export interface JobWorkspace {
  id: string;
  title: string;
  jdText: string;
  jobContext: string;
  questions: Record<SectionType, QuestionItem[]>;
  experienceQuestions: ExperienceQuestionMap;
  activeSection: SectionType;
  activeGeneralView: GeneralView;
  mindMap: MindMapData;
}

export interface AppState {
  resumeText: string;
  additionalContext: string;
  experiences: Experience[];
  jobDescriptions: JobWorkspace[];
  activeJobId: string;
  activeTab: 'general' | 'experiences';
  isSetupComplete: boolean;
  mentorAnalysis?: string;
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

export const createEmptyQuestions = (): Record<SectionType, QuestionItem[]> => ({
  [SectionType.BEHAVIORAL]: [],
  [SectionType.TECHNICAL]: [],
  [SectionType.RELEVANCE]: [],
  [SectionType.ROLE_SPECIFIC]: [],
});

export const createEmptyJobWorkspace = (title = '', jdText = ''): JobWorkspace => ({
  id: crypto.randomUUID(),
  title,
  jdText,
  jobContext: '',
  questions: createEmptyQuestions(),
  experienceQuestions: {},
  activeSection: SectionType.BEHAVIORAL,
  activeGeneralView: 'mindMap',
  mindMap: createEmptyMindMap(),
});

export const createInitialAppState = (): AppState => ({
  resumeText: '',
  additionalContext: '',
  experiences: [],
  jobDescriptions: [],
  activeJobId: '',
  activeTab: 'general',
  isSetupComplete: false,
  mentorAnalysis: '',
});

export function normalizeAppState(raw: Partial<AppState>): AppState {
  const initial = createInitialAppState();
  const legacyQuestions = {
    ...createEmptyQuestions(),
    ...(raw as AppState & { questions?: Record<SectionType, QuestionItem[]> }).questions,
  };
  const legacyMindMap = (raw as AppState & { mindMap?: MindMapData }).mindMap;
  const legacyExperiences = Array.isArray(raw.experiences)
    ? raw.experiences.map((experience) => ({
        id: experience.id || crypto.randomUUID(),
        title: experience.title,
        description: experience.description,
      }))
    : initial.experiences;

  const normalizedJobDescriptions = Array.isArray(raw.jobDescriptions)
    ? raw.jobDescriptions
        .filter((job) => typeof job?.jdText === 'string')
        .map((job, jobIndex) => ({
          id: typeof job.id === 'string' && job.id.trim().length > 0 ? job.id : crypto.randomUUID(),
          title:
            typeof job.title === 'string' && job.title.trim().length > 0
              ? job.title
              : `Role ${jobIndex + 1}`,
          jdText: job.jdText,
          jobContext: typeof job.jobContext === 'string' ? job.jobContext : '',
          questions: {
            ...createEmptyQuestions(),
            ...(job.questions || {}),
          },
          experienceQuestions:
            job.experienceQuestions && typeof job.experienceQuestions === 'object'
              ? Object.fromEntries(
                  Object.entries(job.experienceQuestions).map(([experienceId, questions]) => [
                    experienceId,
                    Array.isArray(questions) ? questions : [],
                  ])
                )
              : {},
          activeGeneralView:
            job.activeGeneralView === 'mindMap' || Object.values(SectionType).includes(job.activeGeneralView as SectionType)
              ? (job.activeGeneralView as GeneralView)
              : 'mindMap',
          activeSection: Object.values(SectionType).includes(job.activeSection as SectionType)
            ? (job.activeSection as SectionType)
            : SectionType.BEHAVIORAL,
          mindMap: {
            nodes: Array.isArray(job.mindMap?.nodes)
              ? job.mindMap.nodes.map((node) => ({
                  ...node,
                  position: node.position || { x: 0, y: 0 },
                }))
              : [],
            edges: Array.isArray(job.mindMap?.edges) ? job.mindMap.edges : [],
            edited: Boolean(job.mindMap?.edited),
          },
        }))
    : [];

  const migratedLegacyJob =
    normalizedJobDescriptions.length === 0 &&
    typeof (raw as AppState & { jdText?: string }).jdText === 'string' &&
    (raw as AppState & { jdText?: string }).jdText!.trim().length > 0
      ? [
          {
            id: crypto.randomUUID(),
            title: 'Role 1',
            jdText: (raw as AppState & { jdText?: string }).jdText!,
            jobContext: '',
            questions: legacyQuestions,
            experienceQuestions: Array.isArray(raw.experiences)
              ? Object.fromEntries(
                  raw.experiences.map((experience) => [
                    experience.id || crypto.randomUUID(),
                    Array.isArray((experience as Experience & { questions?: QuestionItem[] }).questions)
                      ? (experience as Experience & { questions?: QuestionItem[] }).questions!
                      : [],
                  ])
                )
              : {},
            activeSection: Object.values(SectionType).includes((raw as AppState & { activeSection?: SectionType }).activeSection as SectionType)
              ? ((raw as AppState & { activeSection?: SectionType }).activeSection as SectionType)
              : SectionType.BEHAVIORAL,
            activeGeneralView:
              (raw as AppState & { activeGeneralView?: GeneralView }).activeGeneralView === 'mindMap' ||
              Object.values(SectionType).includes((raw as AppState & { activeGeneralView?: SectionType }).activeGeneralView as SectionType)
                ? ((raw as AppState & { activeGeneralView?: GeneralView }).activeGeneralView as GeneralView)
                : 'mindMap',
            mindMap: {
              nodes: Array.isArray(legacyMindMap?.nodes)
                ? legacyMindMap.nodes.map((node) => ({
                    ...node,
                    position: node.position || { x: 0, y: 0 },
                  }))
                : [],
              edges: Array.isArray(legacyMindMap?.edges) ? legacyMindMap.edges : [],
              edited: Boolean(legacyMindMap?.edited),
            },
          },
        ]
      : [];

  const jobDescriptions = normalizedJobDescriptions.length > 0 ? normalizedJobDescriptions : migratedLegacyJob;
  const activeJobId =
    typeof raw.activeJobId === 'string' && jobDescriptions.some((job) => job.id === raw.activeJobId)
      ? raw.activeJobId
      : jobDescriptions[0]?.id || '';

  return {
    ...initial,
    ...raw,
    additionalContext: typeof raw.additionalContext === 'string' ? raw.additionalContext : initial.additionalContext,
    experiences: legacyExperiences,
    jobDescriptions,
    activeJobId,
    isSetupComplete: Boolean(raw.isSetupComplete || jobDescriptions.length > 0),
  };
}

export function getActiveJob(state: AppState): JobWorkspace | null {
  return state.jobDescriptions.find((job) => job.id === state.activeJobId) || state.jobDescriptions[0] || null;
}
