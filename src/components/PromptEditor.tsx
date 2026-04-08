import React, { useState, useEffect } from 'react';
import { PromptTemplate } from '../types';
import * as api from '../services/api';
import { LoaderIcon, XIcon, CheckIcon, SparklesIcon } from './Icons';

interface PromptEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: string;
  onModelChange: (model: string) => void;
  personalContext: string;
  onPersonalContextChange: (value: string) => void;
  activeJobTitle: string;
  jobContext: string;
  onJobContextChange: (value: string) => void;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  isOpen,
  onClose,
  currentModel,
  onModelChange,
  personalContext,
  onPersonalContextChange,
  activeJobTitle,
  jobContext,
  onJobContextChange,
}) => {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [defaults, setDefaults] = useState<PromptTemplate[]>([]);
  const [activePromptId, setActivePromptId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [modelInput, setModelInput] = useState(currentModel);
  const [personalContextInput, setPersonalContextInput] = useState(personalContext);
  const [jobContextInput, setJobContextInput] = useState(jobContext);
  const [activePanel, setActivePanel] = useState<'personal-context' | 'job-context' | 'prompts'>('personal-context');

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    Promise.all([api.getPrompts(), api.getDefaultPrompts()])
      .then(([p, d]) => {
        setPrompts(p);
        setDefaults(d);
        if (p.length > 0 && !activePromptId) setActivePromptId(p[0].id);
      })
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  useEffect(() => {
    setModelInput(currentModel);
  }, [currentModel]);

  useEffect(() => {
    setPersonalContextInput(personalContext);
  }, [personalContext]);

  useEffect(() => {
    setJobContextInput(jobContext);
  }, [jobContext]);

  const activePrompt = prompts.find((p) => p.id === activePromptId);
  const defaultForActive = defaults.find((d) => d.id === activePromptId);
  const isModified = activePrompt && defaultForActive && activePrompt.template !== defaultForActive.template;

  const handleTemplateChange = (value: string) => {
    setPrompts((prev) => prev.map((p) => (p.id === activePromptId ? { ...p, template: value } : p)));
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.savePrompts(prompts);
      if (modelInput !== currentModel) {
        await api.updateModel(modelInput);
        onModelChange(modelInput);
      }
      if (personalContextInput !== personalContext) {
        onPersonalContextChange(personalContextInput);
      }
      if (jobContextInput !== jobContext) {
        onJobContextChange(jobContextInput);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetOne = () => {
    if (!defaultForActive) return;
    setPrompts((prev) => prev.map((p) => (p.id === activePromptId ? { ...p, template: defaultForActive.template } : p)));
    setSaved(false);
  };

  const handleResetAll = async () => {
    if (!confirm('Reset all prompts to defaults? Your customizations will be lost.')) return;
    setIsLoading(true);
    try {
      const fresh = await api.resetPrompts();
      setPrompts(fresh);
      setSaved(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-card-border shadow-2xl shadow-wood-900/15">
        {/* Header */}
        <div className="recipe-stripe"></div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200/80 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-wood-800">Recipe Editor & Settings</h2>
            <p className="text-sm text-wood-400">Customize the prompts sent to the OpenAI API.</p>
          </div>
          <button onClick={onClose} className="p-2 text-wood-400 hover:text-wood-700 rounded-lg hover:bg-cream-100 transition-all">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <LoaderIcon className="w-7 h-7 text-accent-500 animate-gentle-pulse" />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-60 border-r border-cream-200/80 overflow-y-auto shrink-0 bg-cream-50/50">
              <div className="p-4 border-b border-cream-200/80">
                <label className="block text-[11px] font-semibold text-wood-400 uppercase tracking-wider mb-1.5">Model</label>
                <input
                  type="text"
                  value={modelInput}
                  onChange={(e) => { setModelInput(e.target.value); setSaved(false); }}
                  className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm outline-none bg-cream-50/60 text-wood-800"
                  placeholder="gpt-4o"
                />
              </div>

              <div className="p-2">
                <div className="text-[11px] font-semibold text-wood-400 uppercase tracking-wider px-2 py-2">Context</div>
                <button
                  onClick={() => setActivePanel('personal-context')}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] transition-all mb-1 ${
                    activePanel === 'personal-context'
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-600/25'
                      : 'text-wood-600 hover:bg-card hover:shadow-sm'
                  }`}
                >
                  <span className="font-medium truncate">Personal Context</span>
                </button>
                <button
                  onClick={() => setActivePanel('job-context')}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] transition-all mb-2 ${
                    activePanel === 'job-context'
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-600/25'
                      : 'text-wood-600 hover:bg-card hover:shadow-sm'
                  }`}
                >
                  <span className="font-medium truncate">Job Context</span>
                </button>

                <div className="text-[11px] font-semibold text-wood-400 uppercase tracking-wider px-2 py-2">Prompts</div>
                {prompts.map((p) => {
                  const isActive = activePanel === 'prompts' && p.id === activePromptId;
                  const defaultP = defaults.find((d) => d.id === p.id);
                  const modified = defaultP && p.template !== defaultP.template;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActivePromptId(p.id);
                        setActivePanel('prompts');
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-[13px] transition-all mb-1 ${
                        isActive
                          ? 'bg-brand-500 text-white shadow-md shadow-brand-600/25'
                          : 'text-wood-600 hover:bg-card hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{p.name}</span>
                        {modified && (
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-brand-200' : 'bg-accent-400'}`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {activePanel === 'personal-context' ? (
                <>
                  <div className="px-6 py-4 border-b border-cream-200/80 shrink-0">
                    <h3 className="text-[15px] font-bold text-wood-800">Personal Context</h3>
                    <p className="text-sm text-wood-400">
                      Add fresh context about your latest work, priorities, wins, tools, stakeholders, and current scope.
                    </p>
                  </div>
                  <div className="flex-1 overflow-hidden p-5">
                    <textarea
                      value={personalContextInput}
                      onChange={(e) => { setPersonalContextInput(e.target.value); setSaved(false); }}
                      className="w-full h-full bg-cream-50/60 text-wood-800 p-4 border border-cream-300 rounded-xl text-[13px] leading-relaxed outline-none resize-none"
                      placeholder="Add current projects, recent wins, scope, ownership, tools, stakeholders, and anything that should make your interview answers sound up to date."
                    />
                  </div>
                </>
              ) : activePanel === 'job-context' ? (
                <>
                  <div className="px-6 py-4 border-b border-cream-200/80 shrink-0">
                    <h3 className="text-[15px] font-bold text-wood-800">Job & Company Context</h3>
                    <p className="text-sm text-wood-400">
                      Tailor the active role with extra context about the company, team, product, hiring priorities, or why the role matters.
                    </p>
                    <div className="mt-2">
                      <span className="text-[11px] bg-cream-200/80 text-wood-500 px-2 py-0.5 rounded-md font-mono">
                        {activeJobTitle || 'No active role selected'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden p-5">
                    <textarea
                      value={jobContextInput}
                      onChange={(e) => { setJobContextInput(e.target.value); setSaved(false); }}
                      className="w-full h-full bg-cream-50/60 text-wood-800 p-4 border border-cream-300 rounded-xl text-[13px] leading-relaxed outline-none resize-none"
                      placeholder="Add company strategy, team goals, role nuance, target product area, interview emphasis, or what this employer likely cares most about."
                    />
                  </div>
                </>
              ) : activePrompt ? (
                <>
                  <div className="px-6 py-4 border-b border-cream-200/80 shrink-0">
                    <h3 className="text-[15px] font-bold text-wood-800">{activePrompt.name}</h3>
                    <p className="text-sm text-wood-400">{activePrompt.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] bg-cream-200/80 text-wood-500 px-2 py-0.5 rounded-md font-mono">
                        {activePrompt.id}
                      </span>
                      {isModified && (
                        <span className="text-[11px] bg-accent-50 text-accent-600 px-2 py-0.5 rounded-md font-semibold">
                          Modified
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden p-5">
                    <textarea
                      value={activePrompt.template}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="w-full h-full bg-cream-50/60 text-wood-800 p-4 border border-cream-300 rounded-xl text-[13px] font-mono leading-relaxed outline-none resize-none"
                      spellCheck={false}
                    />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center flex-1 text-wood-400 text-sm">
                  Select a prompt to edit
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-cream-200/80 shrink-0 bg-cream-50/50">
          <div className="flex items-center gap-2">
            {isModified && (
              <button
                onClick={handleResetOne}
                className="px-3 py-1.5 text-[13px] font-medium text-wood-500 hover:bg-cream-200/80 rounded-lg transition-colors"
              >
                Reset This Prompt
              </button>
            )}
            <button
              onClick={handleResetAll}
              className="px-3 py-1.5 text-[13px] font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              Reset All to Defaults
            </button>
          </div>

          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-[13px] text-brand-600 font-medium flex items-center gap-1">
                <CheckIcon className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 kitchen-btn shadow-sm shadow-brand-500/20"
            >
              {isSaving ? <LoaderIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
              {isSaving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
