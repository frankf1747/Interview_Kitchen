import React, { useState, useRef } from 'react';
import { SparklesIcon, LoaderIcon, UploadIcon, DocumentIcon, FolderIcon } from './Icons';
import { AppState, normalizeAppState } from '../types';
import * as api from '../services/api';

interface SetupScreenProps {
  onComplete: (resume: string, jd: string) => void;
  onLoadSession: (state: AppState) => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete, onLoadSession }) => {
  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('file');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'resume' | 'jd') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === 'resume') setResumeFile(file);
    else setJdFile(file);
  };

  const processFile = async (file: File): Promise<string> => {
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      return await file.text();
    }
    if (file.name.endsWith('.doc') && !file.name.endsWith('.docx')) {
      throw new Error(`The older .doc format is not supported for "${file.name}". Please save it as .docx or .pdf.`);
    }
    return await api.extractDocument(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadMode === 'text') {
      if (!resumeText.trim() || !jdText.trim()) {
        alert('Please provide both Resume and Job Description text.');
        return;
      }
      setIsSubmitting(true);
      setLoadingMessage('Firing up the stove...');
      setTimeout(() => onComplete(resumeText, jdText), 500);
      return;
    }

    if (!resumeFile || !jdFile) {
      alert('Please upload both Resume and Job Description files.');
      return;
    }

    setIsSubmitting(true);
    setLoadingMessage('Reading the ingredients...');

    try {
      const extractedResume = await processFile(resumeFile);
      const extractedJd = await processFile(jdFile);
      setLoadingMessage('Firing up the stove...');
      onComplete(extractedResume, extractedJd);
    } catch (error: any) {
      console.error(error);
      alert(`Error processing files: ${error.message || 'Please ensure they are valid PDF or DOCX documents.'}`);
      setIsSubmitting(false);
    }
  };

  const handleLoadSession = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result as string;
        const parsedState = JSON.parse(result) as AppState;
        if (parsedState && parsedState.resumeText !== undefined && parsedState.jdText !== undefined) {
          onLoadSession(normalizeAppState(parsedState));
        } else {
          alert('Invalid session file format.');
        }
      } catch {
        alert('Could not load session. The file might be corrupted.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-5xl">
        {/* Hero header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-18 h-18 bg-gradient-to-br from-accent-100 to-cream-200 rounded-2xl mb-5 shadow-sm p-4">
            <span className="text-4xl">🍳</span>
          </div>
          <h1 className="font-display text-5xl font-bold text-wood-900 mb-3">Interview Kitchen</h1>
          <p className="text-lg text-wood-500 max-w-xl mx-auto leading-relaxed">
            Toss in your resume and job description &mdash; we'll cook up tailored questions and optimal answers.
          </p>
        </div>

        {/* Main upload card */}
        <form onSubmit={handleSubmit} className="kitchen-card overflow-hidden mb-8">
          <div className="recipe-stripe"></div>
          <div className="p-8">
            <div className="flex justify-end mb-5">
              <button
                type="button"
                onClick={() => setUploadMode(uploadMode === 'file' ? 'text' : 'file')}
                className="text-sm font-medium text-accent-600 hover:text-accent-700 underline underline-offset-4 decoration-accent-300 transition-colors"
              >
                {uploadMode === 'file' ? 'Having trouble? Paste Text Instead' : 'Switch back to File Upload'}
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Resume */}
              <div className="flex flex-col h-[340px]">
                <label className="text-sm font-semibold text-wood-700 mb-2.5 flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-accent-500 flex items-center justify-center text-[11px] font-bold text-white">1</span>
                  Your Resume
                </label>
                {uploadMode === 'file' ? (
                  <div className="flex-grow w-full border border-dashed border-cream-400 rounded-xl hover:border-brand-400 hover:bg-brand-50/30 transition-all relative flex flex-col items-center justify-center text-center p-6 group overflow-hidden bg-cream-50/40">
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onChange={(e) => handleFileChange(e, 'resume')}
                      required={!resumeFile}
                    />
                    {resumeFile ? (
                      <div className="flex flex-col items-center z-0">
                        <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mb-3">
                          <DocumentIcon className="w-7 h-7 text-brand-600" />
                        </div>
                        <p className="text-sm font-semibold text-wood-800 break-all px-4">{resumeFile.name}</p>
                        <p className="text-xs text-wood-400 mt-1">{(resumeFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center z-0">
                        <div className="w-14 h-14 rounded-2xl bg-cream-200/60 group-hover:bg-brand-100 flex items-center justify-center mb-3 transition-colors">
                          <UploadIcon className="w-7 h-7 text-cream-500 group-hover:text-brand-500 transition-colors" />
                        </div>
                        <p className="text-sm font-medium text-wood-600">Click or drag file to upload</p>
                        <p className="text-xs text-wood-400 mt-1">Supports PDF, DOCX, TXT</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    className="flex-grow w-full p-4 border border-cream-300 rounded-xl outline-none resize-none text-sm bg-cream-50/60 text-wood-900 placeholder-wood-400"
                    placeholder="Paste the raw text of your resume here..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    required
                  />
                )}
              </div>

              {/* JD */}
              <div className="flex flex-col h-[340px]">
                <label className="text-sm font-semibold text-wood-700 mb-2.5 flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-accent-500 flex items-center justify-center text-[11px] font-bold text-white">2</span>
                  Job Description
                </label>
                {uploadMode === 'file' ? (
                  <div className="flex-grow w-full border border-dashed border-cream-400 rounded-xl hover:border-brand-400 hover:bg-brand-50/30 transition-all relative flex flex-col items-center justify-center text-center p-6 group overflow-hidden bg-cream-50/40">
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onChange={(e) => handleFileChange(e, 'jd')}
                      required={!jdFile}
                    />
                    {jdFile ? (
                      <div className="flex flex-col items-center z-0">
                        <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center mb-3">
                          <DocumentIcon className="w-7 h-7 text-brand-600" />
                        </div>
                        <p className="text-sm font-semibold text-wood-800 break-all px-4">{jdFile.name}</p>
                        <p className="text-xs text-wood-400 mt-1">{(jdFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center z-0">
                        <div className="w-14 h-14 rounded-2xl bg-cream-200/60 group-hover:bg-brand-100 flex items-center justify-center mb-3 transition-colors">
                          <UploadIcon className="w-7 h-7 text-cream-500 group-hover:text-brand-500 transition-colors" />
                        </div>
                        <p className="text-sm font-medium text-wood-600">Click or drag file to upload</p>
                        <p className="text-xs text-wood-400 mt-1">Supports PDF, DOCX, TXT</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    className="flex-grow w-full p-4 border border-cream-300 rounded-xl outline-none resize-none text-sm bg-cream-50/60 text-wood-900 placeholder-wood-400"
                    placeholder="Paste the requirements and responsibilities of the role..."
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    required
                  />
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-end pt-6 border-t border-cream-200/80">
              <button
                type="submit"
                disabled={isSubmitting || (uploadMode === 'file' ? !resumeFile || !jdFile : !resumeText.trim() || !jdText.trim())}
                className="px-8 py-3.5 bg-gradient-to-r from-accent-500 to-accent-400 hover:from-accent-600 hover:to-accent-500 text-white font-semibold rounded-xl flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed kitchen-btn shadow-lg shadow-accent-500/20"
              >
                {isSubmitting ? (
                  <>
                    <LoaderIcon className="w-5 h-5" /> {loadingMessage}
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5" /> Start Cooking
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Load session */}
        <div className="text-center pb-8">
          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-cream-300 w-full max-w-[160px]"></div>
            <span className="px-5 text-sm text-wood-400 font-medium">or</span>
            <div className="border-t border-cream-300 w-full max-w-[160px]"></div>
          </div>
          <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleLoadSession} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-card/80 border border-card-border hover:border-brand-300 hover:text-brand-700 text-wood-600 font-medium rounded-xl transition-all text-sm kitchen-btn shadow-sm"
          >
            <FolderIcon className="w-4 h-4" /> Load Previous Session
          </button>
        </div>
      </div>
    </div>
  );
};
