import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, MindMapData, QuestionItem, SectionType, normalizeAppState } from '../types';
import { SectionView } from './SectionView';
import { ResumeRelevancePage } from './ResumeRelevancePage';
import { PromptEditor } from './PromptEditor';
import { MindMapView } from './MindMapView';
import * as api from '../services/api';
import { buildFallbackMindMap, buildMindMap } from '../utils/mindMap';
import { SECTION_DETAILS } from '../constants';
import { BriefcaseIcon, DownloadIcon, FolderIcon, PuzzleIcon, SettingsIcon } from './Icons';

interface DashboardProps {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  currentModel: string;
  onModelChange: (model: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ state, setState, currentModel, onModelChange }) => {
  const [isExtractingExp, setIsExtractingExp] = useState(false);
  const [isGeneratingMap, setIsGeneratingMap] = useState(false);
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoMindMapAttemptedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const loadExperiences = async () => {
      if (state.experiences.length === 0) setIsExtractingExp(true);

      try {
        const extractedExps = state.experiences.length === 0 ? await api.extractExperiences(state.resumeText) : [];

        if (isMounted) {
          setState((prev) => {
            const newExperiences =
              extractedExps.length > 0
                ? extractedExps.map((exp) => ({ id: crypto.randomUUID(), title: exp.title, description: exp.description, questions: [] }))
                : prev.experiences;
            return { ...prev, experiences: newExperiences };
          });
        }
      } catch (error) {
        console.error('Error extracting experiences:', error);
      } finally {
        if (isMounted) {
          setIsExtractingExp(false);
        }
      }
    };

    loadExperiences();
    return () => { isMounted = false; };
  }, [state.resumeText, state.experiences.length, setState]);

  const generateMindMap = useCallback(async (force = false) => {
    if (state.experiences.length === 0) return;
    if (force && state.mindMap.edited) {
      const shouldOverwrite = window.confirm('Regenerating will replace your edited mind map. Continue?');
      if (!shouldOverwrite) return;
    }

    setIsGeneratingMap(true);
    try {
      const rawMap = await api.generateSkillMap(
        state.resumeText,
        state.jdText,
        state.experiences.map((experience) => ({
          title: experience.title,
          description: experience.description,
        }))
      );

      const nextMindMap = rawMap.nodes.length > 0
        ? buildMindMap(rawMap.nodes, rawMap.edges, false)
        : buildFallbackMindMap(
            state.jdText,
            state.experiences.map((experience) => ({
              title: experience.title,
              description: experience.description,
            })),
            false
          );
      setState((prev) => ({ ...prev, mindMap: nextMindMap }));
    } catch (error) {
      console.error('Error generating skill map:', error);
      const nextMindMap = buildFallbackMindMap(
        state.jdText,
        state.experiences.map((experience) => ({
          title: experience.title,
          description: experience.description,
        })),
        false
      );
      setState((prev) => ({ ...prev, mindMap: nextMindMap }));
    } finally {
      setIsGeneratingMap(false);
    }
  }, [state.experiences, state.jdText, state.resumeText, state.mindMap.edited, setState]);

  // Keep a ref to the latest generateMindMap so the auto-generation effect never has a stale closure
  const generateMindMapRef = useRef(generateMindMap);
  useEffect(() => { generateMindMapRef.current = generateMindMap; }, [generateMindMap]);

  useEffect(() => {
    if (state.experiences.length === 0 || state.mindMap.nodes.length > 0 || isExtractingExp || autoMindMapAttemptedRef.current) {
      return;
    }

    autoMindMapAttemptedRef.current = true;
    void generateMindMapRef.current(false);
  }, [state.experiences.length, state.mindMap.nodes.length, isExtractingExp]);

  const handleExportSession = () => {
    const dataStr = JSON.stringify(state, null, 2);
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
        if (parsedState && parsedState.resumeText !== undefined && parsedState.jdText !== undefined) {
          setState(normalizeAppState(parsedState));
        } else {
          alert('Invalid session file format.');
        }
      } catch {
        alert('Could not load session.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpdateQuestions = (section: SectionType, questions: QuestionItem[]) => {
    setState((prev) => ({ ...prev, questions: { ...prev.questions, [section]: questions } }));
  };
  const handleUpdateOutline = (section: SectionType, questionId: string, outline: string[]) => {
    setState((prev) => ({
      ...prev,
      questions: { ...prev.questions, [section]: prev.questions[section].map((q) => (q.id === questionId ? { ...q, outline } : q)) },
    }));
  };
  const handleUpdateCloze = (section: SectionType, questionId: string, clozeText: string) => {
    setState((prev) => ({
      ...prev,
      questions: { ...prev.questions, [section]: prev.questions[section].map((q) => (q.id === questionId ? { ...q, clozeText } : q)) },
    }));
  };
  const handleEditAnswer = (section: SectionType, questionId: string, newAnswer: string) => {
    setState((prev) => ({
      ...prev,
      questions: { ...prev.questions, [section]: prev.questions[section].map((q) => (q.id === questionId ? { ...q, answer: newAnswer } : q)) },
    }));
  };
  const handleDeleteQuestion = (section: SectionType, questionId: string) => {
    setState((prev) => ({
      ...prev,
      questions: { ...prev.questions, [section]: prev.questions[section].filter((q) => q.id !== questionId) },
    }));
  };

  const handleAddExperience = (title: string, description: string) => {
    setState((prev) => ({ ...prev, experiences: [...prev.experiences, { id: crypto.randomUUID(), title, description, questions: [] }] }));
  };
  const handleDeleteExperience = (id: string) => {
    setState((prev) => ({ ...prev, experiences: prev.experiences.filter((exp) => exp.id !== id) }));
  };
  const handleUpdateExpQuestions = (expId: string, questions: QuestionItem[]) => {
    setState((prev) => ({ ...prev, experiences: prev.experiences.map((exp) => (exp.id === expId ? { ...exp, questions } : exp)) }));
  };
  const handleUpdateExpOutline = (expId: string, questionId: string, outline: string[]) => {
    setState((prev) => ({
      ...prev,
      experiences: prev.experiences.map((exp) =>
        exp.id === expId ? { ...exp, questions: exp.questions.map((q) => (q.id === questionId ? { ...q, outline } : q)) } : exp
      ),
    }));
  };
  const handleUpdateExpCloze = (expId: string, questionId: string, clozeText: string) => {
    setState((prev) => ({
      ...prev,
      experiences: prev.experiences.map((exp) =>
        exp.id === expId ? { ...exp, questions: exp.questions.map((q) => (q.id === questionId ? { ...q, clozeText } : q)) } : exp
      ),
    }));
  };
  const handleEditExpAnswer = (expId: string, questionId: string, newAnswer: string) => {
    setState((prev) => ({
      ...prev,
      experiences: prev.experiences.map((exp) =>
        exp.id === expId ? { ...exp, questions: exp.questions.map((q) => (q.id === questionId ? { ...q, answer: newAnswer } : q)) } : exp
      ),
    }));
  };
  const handleDeleteExpQuestion = (expId: string, questionId: string) => {
    setState((prev) => ({
      ...prev,
      experiences: prev.experiences.map((exp) =>
        exp.id === expId ? { ...exp, questions: exp.questions.filter((q) => q.id !== questionId) } : exp
      ),
    }));
  };

  const handleMindMapChange = (mindMap: MindMapData) => {
    setState((prev) => ({ ...prev, mindMap }));
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden kitchen-bg">
      {/* Top Navbar - glassmorphism */}
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

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-5 md:p-8 lg:p-10">
        <div className="max-w-6xl mx-auto">
          {state.activeTab === 'general' ? (
            <div className="flex flex-col lg:flex-row gap-7">
              {/* Sidebar */}
              <div className="w-full lg:w-60 shrink-0 space-y-2">
                <div className="text-[11px] font-bold text-wood-400 uppercase tracking-widest mb-1.5 px-1">Workspace</div>
                <button
                  onClick={() => setState((prev) => ({ ...prev, activeGeneralView: 'mindMap' }))}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-3 text-[13px] ${
                    state.activeGeneralView === 'mindMap'
                      ? 'bg-accent-500 text-white shadow-md shadow-accent-600/25 kitchen-btn-active'
                      : 'bg-card/80 text-wood-600 hover:bg-accent-50 hover:text-accent-700 border border-transparent hover:border-accent-200'
                  }`}
                >
                  <PuzzleIcon className={`w-4.5 h-4.5 ${state.activeGeneralView === 'mindMap' ? 'text-accent-100' : 'text-wood-400'}`} />
                  Mind Map
                </button>

                <div className="text-[11px] font-bold text-wood-400 uppercase tracking-widest mb-1.5 mt-4 px-1">Sections</div>
                {(Object.values(SectionType) as SectionType[]).map((type) => {
                  const isActive = state.activeGeneralView !== 'mindMap' && state.activeSection === type;
                  const details = SECTION_DETAILS[type];
                  return (
                    <button
                      key={type}
                      onClick={() => setState((prev) => ({ ...prev, activeGeneralView: type, activeSection: type }))}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-3 text-[13px] ${
                        isActive
                          ? 'bg-brand-500 text-white shadow-md shadow-brand-600/25 kitchen-btn-active'
                          : 'bg-card/80 text-wood-600 hover:bg-brand-50 hover:text-brand-700 border border-transparent hover:border-brand-200'
                      }`}
                    >
                      <svg className={`w-4.5 h-4.5 ${isActive ? 'text-brand-200' : 'text-wood-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={details.icon} />
                      </svg>
                      {details.title}
                    </button>
                  );
                })}
              </div>

              {/* Active Section */}
              <div className="flex-1 min-w-0">
                {state.activeGeneralView === 'mindMap' ? (
                  <MindMapView
                    mindMap={state.mindMap}
                    hasExperiences={state.experiences.length > 0}
                    isGenerating={isGeneratingMap}
                    onChange={handleMindMapChange}
                    onRegenerate={() => void generateMindMap(true)}
                  />
                ) : (
                  <SectionView
                    key={state.activeSection}
                    sectionType={state.activeSection}
                    state={state}
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
              state={state}
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
        additionalContext={state.additionalContext}
        onAdditionalContextChange={(value) => setState((prev) => ({ ...prev, additionalContext: value }))}
      />
    </div>
  );
};
