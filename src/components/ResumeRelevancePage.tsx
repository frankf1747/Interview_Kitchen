import React, { useState } from 'react';
import { AppState, QuestionItem } from '../types';
import { ExperienceSectionView } from './ExperienceSectionView';
import { PlusIcon, LoaderIcon } from './Icons';

interface ResumeRelevancePageProps {
  state: AppState;
  isExtracting: boolean;
  onAddExperience: (title: string, description: string) => void;
  onDeleteExperience: (id: string) => void;
  onUpdateQuestions: (expId: string, questions: QuestionItem[]) => void;
  onUpdateOutline: (expId: string, questionId: string, outline: string[]) => void;
  onUpdateCloze: (expId: string, questionId: string, clozeText: string) => void;
  onEditAnswer: (expId: string, questionId: string, newAnswer: string) => void;
  onDeleteQuestion: (expId: string, questionId: string) => void;
}

export const ResumeRelevancePage: React.FC<ResumeRelevancePageProps> = ({
  state,
  isExtracting,
  onAddExperience,
  onDeleteExperience,
  onUpdateQuestions,
  onUpdateOutline,
  onUpdateCloze,
  onEditAnswer,
  onDeleteQuestion,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;
    onAddExperience(newTitle, newDesc);
    setNewTitle('');
    setNewDesc('');
    setIsAdding(false);
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-wood-800 mb-1.5">Experience Deep Dive</h1>
        <p className="text-wood-400 text-sm leading-relaxed">
          Break down your resume into specific roles, internships, or achievements. Generate custom questions tailored to
          connect each exact experience to the Job Description.
        </p>
      </div>

      <div className="space-y-5">
        {isExtracting && state.experiences.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 kitchen-card">
            <LoaderIcon className="w-7 h-7 text-accent-500 mb-4 animate-gentle-pulse" />
            <h3 className="text-[15px] font-semibold text-wood-700 mb-1">Extracting Experiences...</h3>
            <p className="text-wood-400 text-sm">Automatically pulling your roles from your resume.</p>
          </div>
        )}

        {!isExtracting && state.experiences.length === 0 && !isAdding && (
          <div className="text-center py-16 kitchen-card">
            <div className="text-3xl mb-3">🧑‍🍳</div>
            <h3 className="text-[15px] font-semibold text-wood-700 mb-2">No experiences found or added</h3>
            <p className="text-wood-400 text-sm max-w-sm mx-auto mb-6">
              Add specific roles or projects from your resume to start generating targeted interview questions.
            </p>
            <button
              onClick={() => setIsAdding(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-accent-500 to-accent-400 text-white rounded-xl text-sm font-semibold hover:from-accent-600 hover:to-accent-500 transition-all inline-flex items-center gap-2 kitchen-btn shadow-md shadow-accent-500/20"
            >
              <PlusIcon className="w-4 h-4" /> Add Your First Experience
            </button>
          </div>
        )}

        {state.experiences.map((exp) => (
          <ExperienceSectionView
            key={exp.id}
            experience={exp}
            jdText={state.jdText}
            resumeText={state.resumeText}
            additionalContext={state.additionalContext}
            onUpdateQuestions={onUpdateQuestions}
            onUpdateOutline={onUpdateOutline}
            onUpdateCloze={onUpdateCloze}
            onEditAnswer={onEditAnswer}
            onDeleteQuestion={onDeleteQuestion}
            onDelete={onDeleteExperience}
          />
        ))}

        {isAdding ? (
          <div className="kitchen-card overflow-hidden">
            <div className="recipe-stripe"></div>
            <div className="p-6">
              <h3 className="text-lg font-bold text-wood-800 mb-4">Add New Experience</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-wood-400 uppercase tracking-wider mb-1.5">Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-cream-50/60 text-wood-800 placeholder-wood-300 px-4 py-2.5 border border-cream-300 rounded-xl outline-none text-sm"
                    placeholder="e.g., Software Engineering Intern at TechCorp"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-wood-400 uppercase tracking-wider mb-1.5">Description / Bullet Points</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={4}
                    className="w-full bg-cream-50/60 text-wood-800 placeholder-wood-300 px-4 py-2.5 border border-cream-300 rounded-xl outline-none text-sm resize-y"
                    placeholder="List the key responsibilities, technologies used, and outcomes achieved..."
                    required
                  />
                </div>
                <div className="flex justify-end gap-2.5 pt-1">
                  <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm font-medium text-wood-500 hover:bg-cream-200/80 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-accent-500 hover:bg-accent-600 rounded-lg transition-all flex items-center gap-2 kitchen-btn shadow-sm shadow-accent-500/20"
                  >
                    <PlusIcon className="w-4 h-4" /> Save Experience
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          state.experiences.length > 0 &&
          !isExtracting && (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-4 border border-dashed border-cream-300 rounded-xl text-wood-400 font-medium hover:border-accent-300 hover:text-accent-600 transition-all flex items-center justify-center gap-2 hover:bg-accent-50/30 text-sm"
            >
              <PlusIcon className="w-4 h-4" /> Add Another Experience
            </button>
          )
        )}
      </div>
    </div>
  );
};
