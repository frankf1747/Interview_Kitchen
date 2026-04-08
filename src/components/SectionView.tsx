import React, { useState, useCallback } from 'react';
import { SectionType, QuestionItem } from '../types';
import { SECTION_DETAILS } from '../constants';
import * as api from '../services/api';
import { QuestionCard } from './QuestionCard';
import { CustomQuestionForm } from './CustomQuestionForm';
import { SparklesIcon, LoaderIcon } from './Icons';

interface SectionViewProps {
  sectionType: SectionType;
  resumeText: string;
  jdText: string;
  personalContext: string;
  jobContext: string;
  questions: QuestionItem[];
  onUpdateQuestions: (section: SectionType, questions: QuestionItem[]) => void;
  onUpdateOutline: (section: SectionType, questionId: string, outline: string[]) => void;
  onUpdateCloze: (section: SectionType, questionId: string, clozeText: string) => void;
  onEditAnswer: (section: SectionType, questionId: string, newAnswer: string) => void;
  onDeleteQuestion: (section: SectionType, questionId: string) => void;
}

export const SectionView: React.FC<SectionViewProps> = ({
  sectionType,
  resumeText,
  jdText,
  personalContext,
  jobContext,
  questions,
  onUpdateQuestions,
  onUpdateOutline,
  onUpdateCloze,
  onEditAnswer,
  onDeleteQuestion,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const details = SECTION_DETAILS[sectionType];

  const reorderQuestions = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      const sourceIndex = questions.findIndex((question) => question.id === sourceId);
      const targetIndex = questions.findIndex((question) => question.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return;

      const reorderedQuestions = [...questions];
      const [movedQuestion] = reorderedQuestions.splice(sourceIndex, 1);
      reorderedQuestions.splice(targetIndex, 0, movedQuestion);
      onUpdateQuestions(sectionType, reorderedQuestions);
    },
    [questions, onUpdateQuestions, sectionType]
  );

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const newQuestionsRaw = await api.generateQuestions(
        resumeText,
        jdText,
        sectionType,
        personalContext,
        jobContext
      );
      const newQuestions: QuestionItem[] = newQuestionsRaw.map((q) => ({
        ...q,
        id: crypto.randomUUID(),
        isCustom: false,
      }));
      onUpdateQuestions(sectionType, [...questions, ...newQuestions]);
    } catch {
      alert('Failed to generate questions. Please check your API key and try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [jdText, jobContext, personalContext, questions, onUpdateQuestions, resumeText, sectionType]);

  const handleAddCustom = useCallback(
    (question: string, answer: string) => {
      const newQuestion: QuestionItem = { id: crypto.randomUUID(), question, answer, isCustom: true };
      onUpdateQuestions(sectionType, [...questions, newQuestion]);
    },
    [sectionType, questions, onUpdateQuestions]
  );

  const handleOutlineUpdate = useCallback(
    (questionId: string, outline: string[]) => onUpdateOutline(sectionType, questionId, outline),
    [sectionType, onUpdateOutline]
  );

  const handleClozeUpdate = useCallback(
    (questionId: string, clozeText: string) => onUpdateCloze(sectionType, questionId, clozeText),
    [sectionType, onUpdateCloze]
  );

  const handleAnswerEdit = useCallback(
    (questionId: string, newAnswer: string) => onEditAnswer(sectionType, questionId, newAnswer),
    [sectionType, onEditAnswer]
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
    <div className="kitchen-card overflow-hidden mb-6">
      <div className="recipe-stripe"></div>
      <div className="p-5 bg-card flex items-center justify-between border-b border-cream-200/80">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-gradient-to-br from-brand-100 to-brand-50 rounded-xl flex items-center justify-center text-brand-600 shrink-0">
            <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={details.icon} />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-wood-800 flex items-center gap-2">
              {details.title}
              {questions.length > 0 && (
                <span className="bg-accent-100 text-accent-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                  {questions.length}
                </span>
              )}
            </h2>
            <p className="text-wood-400 text-sm">{details.description}</p>
          </div>
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent-500 to-accent-400 hover:from-accent-600 hover:to-accent-500 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed shrink-0 kitchen-btn shadow-md shadow-accent-500/20"
        >
          {isGenerating ? <LoaderIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4" />}
          {isGenerating ? 'Cooking...' : 'Generate 3 Qs'}
        </button>
      </div>

      <div className="p-5 bg-cream-50/50 space-y-4 min-h-[400px]">
        {questions.length === 0 && (
          <div className="text-center py-14 bg-card/60 rounded-xl border border-dashed border-cream-300">
            <div className="text-3xl mb-3">🥘</div>
            <h3 className="text-[15px] font-semibold text-wood-700 mb-1">No questions yet</h3>
            <p className="text-wood-400 text-sm max-w-xs mx-auto">
              Generate AI questions or add your own custom ones below.
            </p>
          </div>
        )}

        {questions.length > 0 && (
          <div className="space-y-3.5">
            {questions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                onUpdateOutline={handleOutlineUpdate}
                onUpdateCloze={handleClozeUpdate}
                onEditAnswer={handleAnswerEdit}
                onDelete={() => onDeleteQuestion(sectionType, q.id)}
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
    </div>
  );
};
