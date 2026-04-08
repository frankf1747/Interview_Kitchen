import React, { useState, useRef } from 'react';
import { PlusIcon, SparklesIcon, LoaderIcon } from './Icons';
import * as api from '../services/api';

interface CustomQuestionFormProps {
  onAdd: (question: string, answer: string) => void;
  resumeText: string;
  jdText: string;
  personalContext: string;
  jobContext: string;
}

export const CustomQuestionForm: React.FC<CustomQuestionFormProps> = ({
  onAdd,
  resumeText,
  jdText,
  personalContext,
  jobContext,
}) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [answer, isOpen]);

  const handleGenerateAnswer = async () => {
    if (!question.trim()) {
      alert('Please enter a question first.');
      return;
    }
    setIsGenerating(true);
    try {
      const generatedAnswer = await api.generateCustomAnswer(question, resumeText, jdText, personalContext, jobContext);
      setAnswer(generatedAnswer);
    } catch {
      alert('Failed to generate answer.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    onAdd(question, answer);
    setQuestion('');
    setAnswer('');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full py-3.5 border border-dashed border-cream-300 rounded-xl text-wood-400 font-medium hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50/30 transition-all flex items-center justify-center gap-2 text-sm"
      >
        <PlusIcon className="w-4 h-4" /> Add Custom Question & Answer
      </button>
    );
  }

  return (
    <div className="kitchen-card overflow-hidden">
      <div className="recipe-stripe"></div>
      <div className="p-5">
        <h3 className="text-sm font-semibold text-wood-800 mb-4">Add Custom Q&A</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-wood-400 uppercase tracking-wider mb-1.5">Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full bg-cream-50/60 text-wood-800 placeholder-wood-300 px-3.5 py-2.5 border border-cream-300 rounded-xl outline-none text-sm"
              placeholder="e.g., Why do you want to work here?"
              required
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[11px] font-semibold text-wood-400 uppercase tracking-wider">Your Answer</label>
              <button
                type="button"
                onClick={handleGenerateAnswer}
                disabled={isGenerating || !question.trim()}
                className="text-[11px] font-semibold text-accent-600 hover:text-accent-700 flex items-center gap-1 disabled:opacity-50 transition-colors"
              >
                {isGenerating ? <LoaderIcon className="w-3 h-3" /> : <SparklesIcon className="w-3 h-3" />}
                {isGenerating ? 'Cooking...' : 'Generate Answer'}
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              className="w-full bg-cream-50/60 text-wood-800 placeholder-wood-300 px-3.5 py-2.5 border border-cream-300 rounded-xl outline-none text-sm resize-none overflow-hidden min-h-[100px]"
              placeholder="Write down your planned answer or click 'Generate Answer'..."
              required
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm font-medium text-wood-500 hover:bg-cream-200/80 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg flex items-center gap-2 kitchen-btn shadow-sm shadow-brand-500/20"
            >
              <PlusIcon className="w-4 h-4" /> Save Q&A
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
