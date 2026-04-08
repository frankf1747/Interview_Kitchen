import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AppState,
  MindMapData,
  QuestionItem,
  SectionType,
  normalizeAppState,
  getActiveJob,
  JobWorkspace,
  createEmptyJobWorkspace,
} from '../types';
import { SectionView } from './SectionView';
import { ResumeRelevancePage } from './ResumeRelevancePage';
import { PromptEditor } from './PromptEditor';
import { MindMapView } from './MindMapView';
import * as api from '../services/api';
import { buildFallbackMindMap, buildMindMap } from '../utils/mindMap';
import { SECTION_DETAILS } from '../constants';
import {
  BriefcaseIcon,
  ChevronDownIcon,
  DownloadIcon,
  FolderIcon,
  PuzzleIcon,
  SettingsIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from './Icons';

interface DashboardProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  currentModel: string;
  onModelChange: (model: string) => void;
}

function inferJobTitle(text: string, fallback: string) {
  const firstMeaningfulLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return (firstMeaningfulLine || fallback).slice(0, 80);
}

export const Dashboard: React.FC<DashboardProps> = ({ state, setState, currentModel, onModelChange }) => {
  const [isExtractingExp, setIsExtractingExp] = useState(false);
  const [isGeneratingMap, setIsGeneratingMap] = useState(false);
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleMode, setNewRoleMode] = useState<'text' | 'file'>('text');
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [newRoleText, setNewRoleText] = useState('');
  const [isAddingRoleFile, setIsAddingRoleFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addRoleFileInputRef = useRef<HTMLInputElement>(null);
  const autoMindMapAttemptedRef = useRef(new Set<string>());

  const activeJob = getActiveJob(state);
  const activeExperienceQuestions = activeJob?.experienceQuestions || {};

  const updateActiveJob = useCallback(
    (updater: (job: JobWorkspace) => JobWorkspace) => {
      setState((prev) => {
        const currentActiveJob = getActiveJob(prev);
        if (!currentActiveJob) return prev;

        return {
          ...prev,
          activeJobId: currentActiveJob.id,
          jobDescriptions: prev.jobDescriptions.map((job) =>
            job.id === currentActiveJob.id ? updater(job) : job
          ),
        };
      });
    },
    [setState]
  );

  useEffect(() => {
    if (state.jobDescriptions.length > 0 && !state.jobDescriptions.some((job) => job.id === state.activeJobId)) {
      setState((prev) => ({ ...prev, activeJobId: prev.jobDescriptions[0]?.id || '' }));
    }
  }, [setState, state.activeJobId, state.jobDescriptions]);

  useEffect(() => {
    let isMounted = true;
    const loadExperiences = async () => {
      if (!state.resumeText.trim()) return;
      if (state.experiences.length === 0) setIsExtractingExp(true);

      try {
        const extractedExps = state.experiences.length === 0 ? await api.extractExperiences(state.resumeText) : [];

        if (isMounted && extractedExps.length > 0) {
          setState((prev) => ({
            ...prev,
            experiences: extractedExps.map((exp) => ({
              id: crypto.randomUUID(),
              title: exp.title,
              description: exp.description,
            })),
          }));
        }
      } catch (error) {
        console.error('Error extracting experiences:', error);
      } finally {
        if (isMounted) {
          setIsExtractingExp(false);
        }
      }
    };

    void loadExperiences();
    return () => {
      isMounted = false;
    };
  }, [setState, state.experiences.length, state.resumeText]);

  const generateMindMap = useCallback(
    async (force = false) => {
      if (!activeJob || state.experiences.length === 0) return;
      if (force && activeJob.mindMap.edited) {
        const shouldOverwrite = window.confirm('Regenerating will replace your edited mind map. Continue?');
        if (!shouldOverwrite) return;
      }

      setIsGeneratingMap(true);
      try {
        const rawMap = await api.generateSkillMap(
          state.resumeText,
          activeJob.jdText,
          state.experiences.map((experience) => ({
            title: experience.title,
            description: experience.description,
          })),
          state.additionalContext,
          activeJob.jobContext
        );

        const nextMindMap =
          rawMap.nodes.length > 0
            ? buildMindMap(rawMap.nodes, rawMap.edges, false)
            : buildFallbackMindMap(
                activeJob.jdText,
                state.experiences.map((experience) => ({
                  title: experience.title,
                  description: experience.description,
                })),
                activeJob.jobContext,
                false
              );

        updateActiveJob((job) => ({ ...job, mindMap: nextMindMap }));
      } catch (error) {
        console.error('Error generating skill map:', error);
        const nextMindMap = buildFallbackMindMap(
          activeJob.jdText,
          state.experiences.map((experience) => ({
            title: experience.title,
            description: experience.description,
          })),
          activeJob.jobContext,
          false
        );
        updateActiveJob((job) => ({ ...job, mindMap: nextMindMap }));
      } finally {
        setIsGeneratingMap(false);
      }
    },
    [activeJob, state.experiences, state.resumeText, updateActiveJob]
  );

  const generateMindMapRef = useRef(generateMindMap);
  useEffect(() => {
    generateMindMapRef.current = generateMindMap;
  }, [generateMindMap]);

  useEffect(() => {
    if (!activeJob || state.experiences.length === 0 || isExtractingExp) return;
    if (activeJob.mindMap.nodes.length > 0) return;
    if (autoMindMapAttemptedRef.current.has(activeJob.id)) return;

    autoMindMapAttemptedRef.current.add(activeJob.id);
    void generateMindMapRef.current(false);
  }, [activeJob, isExtractingExp, state.experiences.length]);

  const handleExportSession = () => {
    const dataStr = JSON.stringify(state);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `interview-session-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportSession = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result as string;
        const parsedState = JSON.parse(result) as AppState;
        const normalized = normalizeAppState(parsedState);
        if (normalized.resumeText && normalized.jobDescriptions.length > 0) {
          autoMindMapAttemptedRef.current.clear();
          setState(normalized);
        } else {
          alert('Invalid session file format. Expected a resume and at least one job workspace.');
        }
      } catch {
        alert('Could not load session.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpdateQuestions = (section: SectionType, questions: QuestionItem[]) => {
    updateActiveJob((job) => ({ ...job, questions: { ...job.questions, [section]: questions } }));
  };

  const handleUpdateOutline = (section: SectionType, questionId: string, outline: string[]) => {
    updateActiveJob((job) => ({
      ...job,
      questions: {
        ...job.questions,
        [section]: job.questions[section].map((q) => (q.id === questionId ? { ...q, outline } : q)),
      },
    }));
  };

  const handleUpdateCloze = (section: SectionType, questionId: string, clozeText: string) => {
    updateActiveJob((job) => ({
      ...job,
      questions: {
        ...job.questions,
        [section]: job.questions[section].map((q) => (q.id === questionId ? { ...q, clozeText } : q)),
      },
    }));
  };

  const handleEditAnswer = (section: SectionType, questionId: string, newAnswer: string) => {
    updateActiveJob((job) => ({
      ...job,
      questions: {
        ...job.questions,
        [section]: job.questions[section].map((q) => (q.id === questionId ? { ...q, answer: newAnswer } : q)),
      },
    }));
  };

  const handleDeleteQuestion = (section: SectionType, questionId: string) => {
    updateActiveJob((job) => ({
      ...job,
      questions: { ...job.questions, [section]: job.questions[section].filter((q) => q.id !== questionId) },
    }));
  };

  const handleAddExperience = (title: string, description: string) => {
    const newExperienceId = crypto.randomUUID();
    setState((prev) => ({
      ...prev,
      experiences: [...prev.experiences, { id: newExperienceId, title, description }],
      jobDescriptions: prev.jobDescriptions.map((job) => ({
        ...job,
        experienceQuestions: { ...job.experienceQuestions, [newExperienceId]: [] },
      })),
    }));
  };

  const handleDeleteExperience = (id: string) => {
    setState((prev) => ({
      ...prev,
      experiences: prev.experiences.filter((exp) => exp.id !== id),
      jobDescriptions: prev.jobDescriptions.map((job) => {
        const nextExperienceQuestions = { ...job.experienceQuestions };
        delete nextExperienceQuestions[id];
        return { ...job, experienceQuestions: nextExperienceQuestions };
      }),
    }));
  };

  const handleUpdateExpQuestions = (expId: string, questions: QuestionItem[]) => {
    updateActiveJob((job) => ({
      ...job,
      experienceQuestions: { ...job.experienceQuestions, [expId]: questions },
    }));
  };

  const handleUpdateExpOutline = (expId: string, questionId: string, outline: string[]) => {
    updateActiveJob((job) => ({
      ...job,
      experienceQuestions: {
        ...job.experienceQuestions,
        [expId]: (job.experienceQuestions[expId] || []).map((q) => (q.id === questionId ? { ...q, outline } : q)),
      },
    }));
  };

  const handleUpdateExpCloze = (expId: string, questionId: string, clozeText: string) => {
    updateActiveJob((job) => ({
      ...job,
      experienceQuestions: {
        ...job.experienceQuestions,
        [expId]: (job.experienceQuestions[expId] || []).map((q) => (q.id === questionId ? { ...q, clozeText } : q)),
      },
    }));
  };

  const handleEditExpAnswer = (expId: string, questionId: string, newAnswer: string) => {
    updateActiveJob((job) => ({
      ...job,
      experienceQuestions: {
        ...job.experienceQuestions,
        [expId]: (job.experienceQuestions[expId] || []).map((q) => (q.id === questionId ? { ...q, answer: newAnswer } : q)),
      },
    }));
  };

  const handleDeleteExpQuestion = (expId: string, questionId: string) => {
    updateActiveJob((job) => ({
      ...job,
      experienceQuestions: {
        ...job.experienceQuestions,
        [expId]: (job.experienceQuestions[expId] || []).filter((q) => q.id !== questionId),
      },
    }));
  };

  const handleMindMapChange = (mindMap: MindMapData) => {
    updateActiveJob((job) => ({ ...job, mindMap }));
  };

  const handleRenameActiveRole = () => {
    if (!activeJob) return;
    const nextTitle = window.prompt('Rename this role', activeJob.title);
    if (!nextTitle || !nextTitle.trim()) return;
    updateActiveJob((job) => ({ ...job, title: nextTitle.trim() }));
  };

  const handleDeleteActiveRole = () => {
    if (!activeJob) return;
    const shouldDelete = window.confirm(`Delete "${activeJob.title}" and its saved prep?`);
    if (!shouldDelete) return;

    setState((prev) => {
      const remainingJobs = prev.jobDescriptions.filter((job) => job.id !== activeJob.id);
      return {
        ...prev,
        jobDescriptions: remainingJobs,
        activeJobId: remainingJobs[0]?.id || '',
        isSetupComplete: true,
      };
    });
  };

  const handleAddRoleFromText = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newRoleText.trim()) return;

    const title = newRoleTitle.trim() || inferJobTitle(newRoleText, `Role ${state.jobDescriptions.length + 1}`);
    const newJob = createEmptyJobWorkspace(title, newRoleText.trim());
    autoMindMapAttemptedRef.current.delete(newJob.id);

    setState((prev) => ({
      ...prev,
      jobDescriptions: [...prev.jobDescriptions, newJob],
      activeJobId: newJob.id,
    }));

    setNewRoleTitle('');
    setNewRoleText('');
    setIsAddingRole(false);
  };

  const handleAddRoleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAddingRoleFile(true);
    try {
      const jdText = file.type === 'text/plain' || file.name.endsWith('.txt') ? await file.text() : await api.extractDocument(file);
      const title = file.name.replace(/\.[^.]+$/, '') || `Role ${state.jobDescriptions.length + 1}`;
      const newJob = createEmptyJobWorkspace(title, jdText);
      autoMindMapAttemptedRef.current.delete(newJob.id);

      setState((prev) => ({
        ...prev,
        jobDescriptions: [...prev.jobDescriptions, newJob],
        activeJobId: newJob.id,
      }));
      setIsAddingRole(false);
    } catch (error: any) {
      alert(`Could not add the Job Description: ${error.message || 'Please try another file.'}`);
    } finally {
      setIsAddingRoleFile(false);
      if (addRoleFileInputRef.current) addRoleFileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden kitchen-bg">
      <header className="glass-navbar border-b border-wood-800/30 px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between shrink-0 z-10 gap-4 md:gap-0">
        <div className="flex items-center gap-3 md:w-1/3">
          <div className="w-8 h-8 bg-gradient-to-br from-accent-400 to-accent-500 rounded-lg flex items-center justify-center shrink-0 shadow-sm shadow-accent-600/30">
            <span className="text-sm">🍳</span>
          </div>
          <span className="font-display font-bold text-xl text-cream-100 tracking-tight truncate">Interview Kitchen</span>
          <span className="text-[11px] bg-white/10 text-cream-300 px-2 py-0.5 rounded-md font-mono hidden lg:inline backdrop-blur-sm">{currentModel}</span>
        </div>

        <div className="flex bg-white/8 p-1 rounded-xl w-full md:w-auto overflow-hidden backdrop-blur-sm border border-white/10">
          <button
            onClick={() => setState((prev) => ({ ...prev, activeTab: 'general' }))}
            className={`flex-1 md:flex-none px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
              state.activeTab === 'general'
                ? 'bg-brand-500 text-white shadow-md shadow-brand-600/30'
                : 'text-cream-300 hover:text-cream-100 hover:bg-white/10'
            }`}
          >
            General Prep
          </button>
          <button
            onClick={() => setState((prev) => ({ ...prev, activeTab: 'experiences' }))}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
              state.activeTab === 'experiences'
                ? 'bg-accent-500 text-white shadow-md shadow-accent-600/30'
                : 'text-cream-300 hover:text-cream-100 hover:bg-white/10'
            }`}
          >
            <BriefcaseIcon className="w-4 h-4" />
            Experience Deep Dive
          </button>
        </div>

        <div className="flex items-center gap-1 md:w-1/3 md:justify-end">
          <button
            onClick={() => setIsPromptEditorOpen(true)}
            className="p-2 text-cream-400/80 hover:text-cream-100 hover:bg-white/10 rounded-lg transition-all flex items-center gap-2 text-sm font-medium"
            title="Edit Prompts & Settings"
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden lg:inline">Prompts</span>
          </button>
          <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleImportSession} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-cream-400/80 hover:text-cream-100 hover:bg-white/10 rounded-lg transition-all flex items-center gap-2 text-sm font-medium"
            title="Load Session"
          >
            <FolderIcon className="w-4 h-4" />
            <span className="hidden lg:inline">Load</span>
          </button>
          <button
            onClick={handleExportSession}
            className="p-2 text-accent-300/80 hover:text-accent-200 hover:bg-white/10 rounded-lg transition-all flex items-center gap-2 text-sm font-medium"
            title="Save Session"
          >
            <DownloadIcon className="w-4 h-4" />
            <span className="hidden lg:inline">Save</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 md:p-8 lg:p-10">
        <div className="max-w-6xl mx-auto">
          {state.activeTab === 'general' ? (
            <div className="flex flex-col lg:flex-row gap-7">
              <div className="w-full lg:w-72 shrink-0 space-y-3">
                <div className="bg-card/80 border border-card-border rounded-2xl p-4 space-y-3">
                  <div className="text-[11px] font-bold text-wood-400 uppercase tracking-widest">Focused Role</div>
                  <div className="relative">
                    <select
                      value={activeJob?.id || ''}
                      onChange={(e) => setState((prev) => ({ ...prev, activeJobId: e.target.value }))}
                      className="w-full appearance-none bg-cream-50/80 border border-cream-300 rounded-xl px-3.5 py-3 text-sm font-medium text-wood-700 outline-none"
                    >
                      {state.jobDescriptions.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="w-4 h-4 text-wood-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsAddingRole((prev) => !prev)}
                      className="flex-1 px-3 py-2.5 bg-accent-50 text-accent-700 rounded-xl text-sm font-semibold hover:bg-accent-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <PlusIcon className="w-4 h-4" /> Add
                    </button>
                    <button
                      onClick={handleRenameActiveRole}
                      disabled={!activeJob}
                      className="flex-1 px-3 py-2.5 bg-brand-50 text-brand-700 rounded-xl text-sm font-semibold hover:bg-brand-100 transition-colors disabled:opacity-50"
                    >
                      Rename
                    </button>
                    <button
                      onClick={handleDeleteActiveRole}
                      disabled={!activeJob}
                      className="px-3 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                      title="Delete active role"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {(isAddingRole || state.jobDescriptions.length === 0) && (
                    <div className="pt-2 border-t border-cream-200 space-y-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setNewRoleMode('text')}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            newRoleMode === 'text' ? 'bg-brand-500 text-white' : 'bg-cream-100 text-wood-500'
                          }`}
                        >
                          Paste Text
                        </button>
                        <button
                          onClick={() => setNewRoleMode('file')}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            newRoleMode === 'file' ? 'bg-brand-500 text-white' : 'bg-cream-100 text-wood-500'
                          }`}
                        >
                          Upload File
                        </button>
                      </div>

                      {newRoleMode === 'text' ? (
                        <form onSubmit={handleAddRoleFromText} className="space-y-3">
                          <input
                            type="text"
                            value={newRoleTitle}
                            onChange={(e) => setNewRoleTitle(e.target.value)}
                            className="w-full bg-cream-50/80 border border-cream-300 rounded-xl px-3 py-2.5 text-sm outline-none"
                            placeholder="Role title"
                          />
                          <textarea
                            value={newRoleText}
                            onChange={(e) => setNewRoleText(e.target.value)}
                            className="w-full min-h-[120px] bg-cream-50/80 border border-cream-300 rounded-xl px-3 py-2.5 text-sm outline-none resize-y"
                            placeholder="Paste another job description..."
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="flex-1 px-3 py-2.5 bg-accent-500 text-white rounded-xl text-sm font-semibold hover:bg-accent-600 transition-colors"
                            >
                              Save Role
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingRole(false);
                                setNewRoleTitle('');
                                setNewRoleText('');
                              }}
                              className="px-3 py-2.5 bg-cream-100 text-wood-500 rounded-xl text-sm font-medium hover:bg-cream-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="space-y-3">
                          <input
                            type="file"
                            accept=".pdf,.docx,.txt"
                            ref={addRoleFileInputRef}
                            onChange={handleAddRoleFile}
                            className="hidden"
                          />
                          <button
                            onClick={() => addRoleFileInputRef.current?.click()}
                            disabled={isAddingRoleFile}
                            className="w-full px-3 py-3 border border-dashed border-cream-300 rounded-xl text-sm font-medium text-wood-600 hover:border-brand-300 hover:bg-brand-50/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            <UploadIcon className="w-4 h-4" />
                            {isAddingRoleFile ? 'Reading file...' : 'Choose Job Description File'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-wood-400 uppercase tracking-widest mb-1.5 px-1">Workspace</div>
                  <button
                    onClick={() => updateActiveJob((job) => ({ ...job, activeGeneralView: 'mindMap' }))}
                    disabled={!activeJob}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-3 text-[13px] ${
                      activeJob?.activeGeneralView === 'mindMap'
                        ? 'bg-accent-500 text-white shadow-md shadow-accent-600/25 kitchen-btn-active'
                        : 'bg-card/80 text-wood-600 hover:bg-accent-50 hover:text-accent-700 border border-transparent hover:border-accent-200'
                    } disabled:opacity-50`}
                  >
                    <PuzzleIcon className={`w-4.5 h-4.5 ${activeJob?.activeGeneralView === 'mindMap' ? 'text-accent-100' : 'text-wood-400'}`} />
                    Mind Map
                  </button>

                  <div className="text-[11px] font-bold text-wood-400 uppercase tracking-widest mb-1.5 mt-4 px-1">Sections</div>
                  {(Object.values(SectionType) as SectionType[]).map((type) => {
                    const isActive = activeJob?.activeGeneralView !== 'mindMap' && activeJob?.activeSection === type;
                    const details = SECTION_DETAILS[type];
                    return (
                      <button
                        key={type}
                        onClick={() => updateActiveJob((job) => ({ ...job, activeGeneralView: type, activeSection: type }))}
                        disabled={!activeJob}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-3 text-[13px] ${
                          isActive
                            ? 'bg-brand-500 text-white shadow-md shadow-brand-600/25 kitchen-btn-active'
                            : 'bg-card/80 text-wood-600 hover:bg-brand-50 hover:text-brand-700 border border-transparent hover:border-brand-200'
                        } disabled:opacity-50`}
                      >
                        <svg className={`w-4.5 h-4.5 ${isActive ? 'text-brand-200' : 'text-wood-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={details.icon} />
                        </svg>
                        {details.title}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                {!activeJob ? (
                  <div className="kitchen-card p-8 text-center">
                    <h2 className="text-xl font-bold text-wood-800 mb-2">Add a role to keep going</h2>
                    <p className="text-wood-500 text-sm mb-6">
                      Your resume is loaded, but there are no Job Descriptions in this session yet.
                    </p>
                    <button
                      onClick={() => setIsAddingRole(true)}
                      className="px-5 py-3 bg-accent-500 text-white rounded-xl font-semibold hover:bg-accent-600 transition-colors inline-flex items-center gap-2"
                    >
                      <PlusIcon className="w-4 h-4" /> Add Job Description
                    </button>
                  </div>
                ) : activeJob.activeGeneralView === 'mindMap' ? (
                  <MindMapView
                    key={activeJob.id}
                    mindMap={activeJob.mindMap}
                    hasExperiences={state.experiences.length > 0}
                    isGenerating={isGeneratingMap}
                    onChange={handleMindMapChange}
                    onRegenerate={() => void generateMindMap(true)}
                  />
                ) : (
                  <SectionView
                    key={`${activeJob.id}-${activeJob.activeSection}`}
                    sectionType={activeJob.activeSection}
                    resumeText={state.resumeText}
                    jdText={activeJob.jdText}
                    personalContext={state.additionalContext}
                    jobContext={activeJob.jobContext}
                    questions={activeJob.questions[activeJob.activeSection] || []}
                    onUpdateQuestions={handleUpdateQuestions}
                    onUpdateOutline={handleUpdateOutline}
                    onUpdateCloze={handleUpdateCloze}
                    onEditAnswer={handleEditAnswer}
                    onDeleteQuestion={handleDeleteQuestion}
                  />
                )}
              </div>
            </div>
          ) : (
            <ResumeRelevancePage
              experiences={state.experiences}
              experienceQuestions={activeExperienceQuestions}
              jdText={activeJob?.jdText || ''}
              resumeText={state.resumeText}
              personalContext={state.additionalContext}
              jobContext={activeJob?.jobContext || ''}
              isExtracting={isExtractingExp}
              onAddExperience={handleAddExperience}
              onDeleteExperience={handleDeleteExperience}
              onUpdateQuestions={handleUpdateExpQuestions}
              onUpdateOutline={handleUpdateExpOutline}
              onUpdateCloze={handleUpdateExpCloze}
              onEditAnswer={handleEditExpAnswer}
              onDeleteQuestion={handleDeleteExpQuestion}
            />
          )}
        </div>
      </div>

      <PromptEditor
        isOpen={isPromptEditorOpen}
        onClose={() => setIsPromptEditorOpen(false)}
        currentModel={currentModel}
        onModelChange={onModelChange}
        personalContext={state.additionalContext}
        onPersonalContextChange={(value) => setState((prev) => ({ ...prev, additionalContext: value }))}
        activeJobTitle={activeJob?.title || ''}
        jobContext={activeJob?.jobContext || ''}
        onJobContextChange={(value) => updateActiveJob((job) => ({ ...job, jobContext: value }))}
      />
    </div>
  );
};
