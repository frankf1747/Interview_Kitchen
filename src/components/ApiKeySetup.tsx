import React, { useState } from 'react';
import { setupApiKey } from '../services/api';
import { SparklesIcon, LoaderIcon } from './Icons';

const OPENAI_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'o1', label: 'o1' },
  { value: 'o1-mini', label: 'o1 Mini' },
  { value: 'o3-mini', label: 'o3 Mini' },
];

interface ApiKeySetupProps {
  onConfigured: () => void;
}

export const ApiKeySetup: React.FC<ApiKeySetupProps> = ({ onConfigured }) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await setupApiKey(apiKey, model);
      onConfigured();
    } catch (err: any) {
      setError(err.message || 'Failed to save API key');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-accent-100 to-cream-200 rounded-2xl mb-5 shadow-sm">
            <span className="text-3xl">🍳</span>
          </div>
          <h1 className="font-display text-4xl font-bold text-wood-900 mb-2">Interview Kitchen</h1>
          <p className="text-wood-500 text-[15px]">Set up your OpenAI API key to start cooking!</p>
        </div>

        <form onSubmit={handleSubmit} className="kitchen-card overflow-hidden">
          <div className="recipe-stripe"></div>
          <div className="p-7 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-wood-700 mb-2">OpenAI API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-3 border border-cream-300 rounded-xl outline-none text-sm bg-cream-50/60 text-wood-900 placeholder-wood-400"
                placeholder="sk-..."
                required
                autoFocus
              />
              <p className="text-xs text-wood-400 mt-2 leading-relaxed">
                Get your key from platform.openai.com. Saved locally in <code className="bg-cream-200/80 px-1.5 py-0.5 rounded text-wood-600 text-[11px]">.env</code>
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-wood-700 mb-2">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-4 py-3 border border-cream-300 rounded-xl outline-none text-sm bg-cream-50/60 text-wood-900"
              >
                {OPENAI_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <p className="text-xs text-wood-400 mt-2">
                The OpenAI model for all API calls. You can change this later.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3.5 rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !apiKey.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed kitchen-btn shadow-md shadow-brand-600/20"
            >
              {isSubmitting ? (
                <>
                  <LoaderIcon className="w-5 h-5" /> Heating up...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-5 h-5" /> Save & Continue
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
