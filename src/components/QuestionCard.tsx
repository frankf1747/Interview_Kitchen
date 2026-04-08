import React, { useState, useCallback, useRef } from 'react';
import { QuestionItem } from '../types';
import * as api from '../services/api';
import { LoaderIcon, ListIcon, PencilIcon, CheckIcon, TrashIcon, PuzzleIcon } from './Icons';

interface QuestionCardProps {
  question: QuestionItem;
  onUpdateOutline: (id: string, outline: string[]) => void;
  onUpdateCloze: (id: string, clozeText: string) => void;
  onEditAnswer: (id: string, newAnswer: string) => void;
  onDelete?: (id: string) => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
  draggable?: boolean;
  onDragStart?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  onDragEnd?: React.DragEventHandler<HTMLDivElement>;
}

const ClozeBlank: React.FC<{ word: string }> = ({ word }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onClick={() => setRevealed(!revealed)}
      className={`inline-block whitespace-nowrap px-2 py-0.5 mx-0.5 rounded-md cursor-pointer transition-all duration-200 font-semibold text-[13px] ${
        revealed
          ? 'text-accent-700 bg-accent-50 border border-accent-200'
          : 'text-transparent bg-cream-200 border border-cream-300 hover:bg-cream-300 select-none'
      }`}
    >
      {word}
    </span>
  );
};

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  onUpdateOutline,
  onUpdateCloze,
  onEditAnswer,
  onDelete,
  isDragging = false,
  isDropTarget = false,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}) => {
  const [isLoadingOutline, setIsLoadingOutline] = useState(false);
  const [isLoadingCloze, setIsLoadingCloze] = useState(false);
  const [activeView, setActiveView] = useState<'none' | 'outline' | 'cloze'>('none');
  const [isEditing, setIsEditing] = useState(false);
  const [editedAnswer, setEditedAnswer] = useState(question.answer);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, editedAnswer]);

  const handleToggleOutline = useCallback(async () => {
    if (activeView === 'outline') { setActiveView('none'); return; }
    if (question.outline && question.outline.length > 0) { setActiveView('outline'); return; }

    setIsLoadingOutline(true);
    setActiveView('outline');
    try {
      const outline = await api.generateOutline(question.question, question.answer);
      onUpdateOutline(question.id, outline);
    } catch {
      alert('Failed to generate outline.');
      setActiveView('none');
    } finally {
      setIsLoadingOutline(false);
    }
  }, [question, activeView, onUpdateOutline]);

  const handleToggleCloze = useCallback(async () => {
    if (activeView === 'cloze') { setActiveView('none'); return; }
    if (question.clozeText) { setActiveView('cloze'); return; }

    setIsLoadingCloze(true);
    setActiveView('cloze');
    try {
      const cloze = await api.generateClozeText(question.answer);
      onUpdateCloze(question.id, cloze);
    } catch {
      alert('Failed to generate memory exercise.');
      setActiveView('none');
    } finally {
      setIsLoadingCloze(false);
    }
  }, [question, activeView, onUpdateCloze]);

  const handleSaveAnswer = () => {
    if (!editedAnswer.trim()) return;
    onEditAnswer(question.id, editedAnswer);
    setIsEditing(false);
    if (question.outline?.length || question.clozeText) {
      if (question.outline?.length) onUpdateOutline(question.id, []);
      if (question.clozeText) onUpdateCloze(question.id, '');
    }
    setActiveView('none');
  };

  return (
    <div
      className={`kitchen-card overflow-hidden group/card transition-all ${
        isDragging ? 'opacity-60 scale-[0.99]' : ''
      } ${
        isDropTarget ? 'ring-2 ring-brand-300 ring-offset-2 ring-offset-cream-50 shadow-lg shadow-brand-100/40' : ''
      }`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="p-5">
        <div className="flex justify-between items-start gap-3 mb-3.5">
          <h3 className="text-[15px] font-semibold text-wood-800 leading-relaxed min-w-0">
            {question.isCustom && (
              <span className="inline-block bg-brand-100 text-brand-700 text-[11px] px-2 py-0.5 rounded-md mr-2 align-middle font-semibold">
                Custom
              </span>
            )}
            {question.question}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleToggleCloze}
              disabled={isLoadingCloze}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-all disabled:opacity-50 ${
                activeView === 'cloze'
                  ? 'bg-accent-100 text-accent-700 shadow-sm'
                  : 'text-wood-500 bg-cream-100/80 hover:bg-accent-50 hover:text-accent-600'
              }`}
              title="Memorize with Fill-in-the-Blanks"
            >
              {isLoadingCloze ? <LoaderIcon className="w-3.5 h-3.5" /> : <PuzzleIcon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Memorize</span>
            </button>
            <button
              onClick={handleToggleOutline}
              disabled={isLoadingOutline}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-lg transition-all disabled:opacity-50 ${
                activeView === 'outline'
                  ? 'bg-brand-100 text-brand-700 shadow-sm'
                  : 'text-wood-500 bg-cream-100/80 hover:bg-brand-50 hover:text-brand-600'
              }`}
              title="Generate memorization outline"
            >
              {isLoadingOutline ? <LoaderIcon className="w-3.5 h-3.5" /> : <ListIcon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Outline</span>
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(question.id)}
                className="p-1.5 text-wood-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover/card:opacity-100"
                title="Delete Question"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="relative group">
          <div className="flex justify-between items-center mb-1.5">
            <h4 className="text-[11px] font-semibold text-wood-400 uppercase tracking-wider">Suggested Answer</h4>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-wood-400 hover:text-brand-600 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] font-medium"
              >
                <PencilIcon className="w-3 h-3" /> Edit
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <textarea
                ref={textareaRef}
                value={editedAnswer}
                onChange={(e) => setEditedAnswer(e.target.value)}
                className="w-full bg-cream-50/80 text-wood-800 p-3 border border-brand-300 rounded-xl text-sm outline-none resize-none min-h-[120px] overflow-hidden"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setIsEditing(false); setEditedAnswer(question.answer); }}
                  className="px-3 py-1.5 text-xs font-medium text-wood-500 hover:bg-cream-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAnswer}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg flex items-center gap-1 transition-colors shadow-sm"
                >
                  <CheckIcon className="w-3 h-3" /> Save
                </button>
              </div>
            </div>
          ) : (
            <p className="text-wood-600 text-[13px] leading-relaxed whitespace-pre-wrap">{question.answer}</p>
          )}
        </div>

        {/* Outline View */}
        {activeView === 'outline' && !isEditing && question.outline && question.outline.length > 0 && (
          <div className="mt-5 pt-4 border-t border-cream-200 bg-brand-50/50 -mx-5 px-5 pb-5">
            <h4 className="text-[13px] font-semibold text-brand-700 mb-3 flex items-center gap-2">
              <ListIcon className="w-4 h-4" /> Key Concepts Outline
            </h4>
            <ul className="space-y-2">
              {question.outline.map((point, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5.5 h-5.5 rounded-full bg-brand-200 text-brand-800 flex items-center justify-center text-[11px] font-semibold mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-[13px] text-wood-700 leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cloze View */}
        {activeView === 'cloze' && !isEditing && question.clozeText && (
          <div className="mt-5 pt-4 border-t border-cream-200 bg-accent-50/40 -mx-5 px-5 pb-5">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-[13px] font-semibold text-accent-700 flex items-center gap-2">
                <PuzzleIcon className="w-4 h-4" /> Fill-in-the-Blanks
              </h4>
            </div>
            <p className="text-[11px] text-accent-400 mb-3 font-medium">
              Click hidden boxes to reveal key words.
            </p>
            <div className="text-[13px] text-wood-700 leading-loose">
              {question.clozeText.split(/\{\{([^}]+)\}\}/g).map((part, i) => {
                if (i % 2 === 1) return <ClozeBlank key={i} word={part} />;
                return <span key={i}>{part}</span>;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
