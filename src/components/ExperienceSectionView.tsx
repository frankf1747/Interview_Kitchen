import React, { useState, useCallback } from 'react';
import { Experience, QuestionItem } from '../types';
import * as api from '../services/api';
import { QuestionCard } from './QuestionCard';
import { CustomQuestionForm } from './CustomQuestionForm';
import { SparklesIcon, LoaderIcon, ChevronDownIcon, ChevronUpIcon, BriefcaseIcon, TrashIcon } from './Icons';

interface ExperienceSectionViewProps {
  experience: Experience;
  questions: QuestionItem[];
  jdText: string;
  resumeText: string;
  personalContext: string;
  jobContext: string;
  onUpdateQuestions: (expId: string, questions: QuestionItem[]) => void;
  onUpdateOutline: (expId: string, questionId: string, outline: string[]) => void;
  onUpdateCloze: (expId: string, questionId: string, clozeText: string) => void;
  onEditAnswer: (expId: string, questionId: string, newAnswer: string) => void;
  onDeleteQuestion: (expId: string, questionId: string) => void;
  onDelete: (expId: string) => void;
}

export const ExperienceSectionView: React.FC<ExperienceSectionViewProps> = ({
  experience,
  questions,
  jdText,
  resumeText,
  personalContext,
  jobContext,
  onUpdateQuestions,
  onUpdateOutline,
  onUpdateCloze,
  onEditAnswer,
  onDeleteQuestion,
  onDelete,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const reorderQuestions = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      const sourceIndex = questions.findIndex((question) => question.id === sourceId);
      const targetIndex = questions.findIndex((question) => question.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return;

      const reorderedQuestions = [...questions];
      const [movedQuestion] = reorderedQuestions.splice(sourceIndex, 1);
      reorderedQuestions.splice(targetIndex, 0, movedQuestion);
      onUpdateQuestions(experience.id, reorderedQuestions);
    },
    [experience.id, onUpdateQuestions, questions]
  );

  const handleGenerate = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isExpanded) setIsExpanded(true);
      setIsGenerating(true);
      try {
        const newQuestionsRaw = await api.generateExperienceQuestions(
          jdText,
          experience.title,
          experience.description,
          personalContext,
          jobContext
        );
        const newQuestions: QuestionItem[] = newQuestionsRaw.map((q) => ({
          ...q,
          id: crypto.randomUUID(),
          isCustom: false,
        }));
        onUpdateQuestions(experience.id, [...questions, ...newQuestions]);
      } catch {
        alert('Failed to generate questions.');
      } finally {
        setIsGenerating(false);
      }
    },
    [experience, isExpanded, jdText, jobContext, onUpdateQuestions, personalContext, questions]
  );

  const handleAddCustom = useCallback(
    (question: string, answer: string) => {
      const newQuestion: QuestionItem = { id: crypto.randomUUID(), question, answer, isCustom: true };
      onUpdateQuestions(experience.id, [...questions, newQuestion]);
    },
    [experience.id, questions, onUpdateQuestions]
  );

  const createHandleDragStart = useCallback(
    (questionId: string) => (event: React.DragEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest('button, textarea, input, select, a, label')) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', questionId);
      setDraggedQuestionId(questionId);
      setDropTargetId(questionId);
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDraggedQuestionId(null);
    setDropTargetId(null);
  }, []);

  const createHandleDragOver = useCallback(
    (questionId: string) => (event: React.DragEvent<HTMLDivElement>) => {
      if (!draggedQuestionId || draggedQuestionId === questionId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (dropTargetId !== questionId) setDropTargetId(questionId);
    },
    [draggedQuestionId, dropTargetId]
  );

  const createHandleDrop = useCallback(
    (questionId: string) => (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const sourceId = draggedQuestionId || event.dataTransfer.getData('text/plain');
      if (!sourceId) return;
      reorderQuestions(sourceId, questionId);
      setDraggedQuestionId(null);
      setDropTargetId(null);
    },
    [draggedQuestionId, reorderQuestions]
  );

  return (
    <div className="kitchen-card overflow-hidden mb-5">
      <div className="recipe-stripe"></div>
      <div
        className="p-5 bg-card hover:bg-cream-50/60 cursor-pointer transition-all flex items-center justify-between border-b border-cream-200/80 group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-gradient-to-br from-accent-100 to-accent-50 rounded-xl flex items-center justify-center text-accent-600 shrink-0">
            <BriefcaseIcon className="w-5.5 h-5.5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-wood-800 flex items-center gap-2">
              {experience.title}
              {questions.length > 0 && (
                <span className="bg-accent-100 text-accent-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                  {questions.length}
                </span>
              )}
            </h2>
            <p className="text-wood-400 text-sm line-clamp-1 max-w-lg">{experience.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(experience.id); }}
            className="p-2 text-cream-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
            title="Delete Experience"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent-500 to-accent-400 hover:from-accent-600 hover:to-accent-500 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed kitchen-btn shadow-md shadow-accent-500/20"
          >
            {isGenerating ? <LoaderIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
            {isGenerating ? 'Cooking...' : 'Generate 3 Qs'}
          </button>
          <div className="text-wood-400 p-1.5">
            {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-5 bg-cream-50/50 space-y-4">
          <div className="bg-accent-50/40 p-4 rounded-xl border border-accent-100/80">
            <h4 className="text-[11px] font-semibold text-accent-700 uppercase tracking-wider mb-2">Experience Details</h4>
            <p className="text-[13px] text-wood-600 whitespace-pre-wrap leading-relaxed">{experience.description}</p>
          </div>

          {questions.length === 0 && (
            <div className="text-center py-10 bg-card/60 rounded-xl border border-dashed border-cream-300">
              <div className="text-2xl mb-2">🥘</div>
              <h3 className="text-[15px] font-semibold text-wood-700 mb-1">No specific questions yet</h3>
              <p className="text-wood-400 text-sm max-w-xs mx-auto">
                Generate AI questions focused on this role, or add your own below.
              </p>
            </div>
          )}

          {questions.length > 0 && (
            <div className="space-y-3.5">
              {questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  onUpdateOutline={(qId, outline) => onUpdateOutline(experience.id, qId, outline)}
                  onUpdateCloze={(qId, clozeText) => onUpdateCloze(experience.id, qId, clozeText)}
                  onEditAnswer={(qId, newAnswer) => onEditAnswer(experience.id, qId, newAnswer)}
                  onDelete={() => onDeleteQuestion(experience.id, q.id)}
                  draggable
                  onDragStart={createHandleDragStart(q.id)}
                  isDragging={draggedQuestionId === q.id}
                  isDropTarget={dropTargetId === q.id && draggedQuestionId !== q.id}
                  onDragOver={createHandleDragOver(q.id)}
                  onDrop={createHandleDrop(q.id)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}

          <div className="pt-1">
            <CustomQuestionForm
              onAdd={handleAddCustom}
              resumeText={resumeText}
              jdText={jdText}
              personalContext={personalContext}
              jobContext={jobContext}
            />
          </div>
        </div>
      )}
    </div>
  );
};
