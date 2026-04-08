import React, { useState, useRef } from 'react';
import { SparklesIcon, LoaderIcon, UploadIcon, DocumentIcon, FolderIcon, PlusIcon, TrashIcon } from './Icons';
import { AppState, normalizeAppState } from '../types';
import * as api from '../services/api';

interface SetupScreenProps {
  onComplete: (resume: string, jobs: { title: string; jdText: string }[]) => void;
  onLoadSession: (state: AppState) => void;
}

interface PendingJdFile {
  id: string;
  file: File;
  title: string;
}

interface PendingJdText {
  id: string;
  title: string;
  text: string;
}

function inferTitleFromText(text: string, index: number) {
  const firstMeaningfulLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return (firstMeaningfulLine || `Role ${index + 1}`).slice(0, 80);
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete, onLoadSession }) => {
  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('file');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdFiles, setJdFiles] = useState<PendingJdFile[]>([]);
  const [resumeText, setResumeText] = useState('');
  const [jdTexts, setJdTexts] = useState<PendingJdText[]>([
    { id: crypto.randomUUID(), title: 'Role 1', text: '' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'resume' | 'jd') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (type === 'resume') {
      setResumeFile(files[0]);
    } else {
      const nextFiles = Array.from(files).map((file, index) => ({
        id: crypto.randomUUID(),
        file,
        title: file.name.replace(/\.[^.]+$/, '') || `Role ${jdFiles.length + index + 1}`,
      }));
      setJdFiles((prev) => [...prev, ...nextFiles]);
    }

    e.target.value = '';
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
      const validJobs = jdTexts
        .map((job, index) => ({
          title: job.title.trim() || inferTitleFromText(job.text, index),
          jdText: job.text.trim(),
        }))
        .filter((job) => job.jdText.length > 0);

      if (!resumeText.trim() || validJobs.length === 0) {
        alert('Please provide your resume and at least one Job Description.');
        return;
      }
      setIsSubmitting(true);
      setLoadingMessage('Firing up the stove...');
      setTimeout(() => onComplete(resumeText, validJobs), 500);
      return;
    }

    if (!resumeFile || jdFiles.length === 0) {
      alert('Please upload your resume and at least one Job Description file.');
      return;
    }

    setIsSubmitting(true);
    setLoadingMessage('Reading the ingredients...');

    try {
      const extractedResume = await processFile(resumeFile);
      const extractedJobs = await Promise.all(
        jdFiles.map(async (job, index) => ({
          title: job.title.trim() || job.file.name.replace(/\.[^.]+$/, '') || `Role ${index + 1}`,
          jdText: await processFile(job.file),
        }))
      );
      setLoadingMessage('Firing up the stove...');
      onComplete(extractedResume, extractedJobs);
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
        const normalized = normalizeAppState(parsedState);
        if (normalized.resumeText && normalized.jobDescriptions.length > 0) {
          onLoadSession(normalized);
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

            <div className="grid md:grid-cols-2 gap-8 items-start">
              {/* Resume */}
              <div className="flex flex-col h-[340px] min-h-0">
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
              <div className="flex flex-col h-[340px] min-h-0">
                <label className="text-sm font-semibold text-wood-700 mb-2.5 flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-accent-500 flex items-center justify-center text-[11px] font-bold text-white">2</span>
                  Job Descriptions
                </label>
                {uploadMode === 'file' ? (
                  <div className="flex-grow flex flex-col gap-3 min-h-0">
                    <label className="flex-shrink-0 w-full border border-dashed border-cream-400 rounded-xl hover:border-brand-400 hover:bg-brand-50/30 transition-all relative flex flex-col items-center justify-center text-center p-6 group overflow-hidden bg-cream-50/40 min-h-[120px] cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        multiple
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={(e) => handleFileChange(e, 'jd')}
                      />
                      <div className="flex flex-col items-center z-0">
                        <div className="w-14 h-14 rounded-2xl bg-cream-200/60 group-hover:bg-brand-100 flex items-center justify-center mb-3 transition-colors">
                          <UploadIcon className="w-7 h-7 text-cream-500 group-hover:text-brand-500 transition-colors" />
                        </div>
                        <p className="text-sm font-medium text-wood-600">Add one or more JD files</p>
                        <p className="text-xs text-wood-400 mt-1">Supports PDF, DOCX, TXT</p>
                      </div>
                    </label>

                    <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                      {jdFiles.length === 0 ? (
                        <div className="h-full border border-dashed border-cream-300 rounded-xl text-sm text-wood-400 flex items-center justify-center text-center px-6">
                          Upload at least one role to prepare multiple positions in one session.
                        </div>
                      ) : (
                        jdFiles.map((job) => (
                          <div key={job.id} className="rounded-xl border border-cream-200 bg-card/80 p-3">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                                <DocumentIcon className="w-5 h-5 text-brand-600" />
                              </div>
                              <div className="min-w-0 flex-1 space-y-2">
                                <input
                                  type="text"
                                  value={job.title}
                                  onChange={(e) =>
                                    setJdFiles((prev) =>
                                      prev.map((entry) => (entry.id === job.id ? { ...entry, title: e.target.value } : entry))
                                    )
                                  }
                                  className="w-full bg-cream-50/70 text-wood-800 px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm"
                                  placeholder="Role title"
                                />
                                <div className="text-xs text-wood-500 break-all">
                                  {job.file.name} · {(job.file.size / 1024).toFixed(1)} KB
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setJdFiles((prev) => prev.filter((entry) => entry.id !== job.id))}
                                className="p-2 text-wood-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove role"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-grow flex flex-col gap-3 min-h-0">
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
                      {jdTexts.map((job, index) => (
                        <div key={job.id} className="rounded-xl border border-cream-200 bg-card/80 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={job.title}
                              onChange={(e) =>
                                setJdTexts((prev) =>
                                  prev.map((entry) => (entry.id === job.id ? { ...entry, title: e.target.value } : entry))
                                )
                              }
                              className="flex-1 bg-cream-50/70 text-wood-800 px-3 py-2 border border-cream-300 rounded-lg outline-none text-sm"
                              placeholder={`Role ${index + 1}`}
                            />
                            {jdTexts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setJdTexts((prev) => prev.filter((entry) => entry.id !== job.id))}
                                className="p-2 text-wood-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove role"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <textarea
                            className="w-full p-4 border border-cream-300 rounded-xl outline-none resize-none text-sm bg-cream-50/60 text-wood-900 placeholder-wood-400 min-h-[120px]"
                            placeholder="Paste the requirements and responsibilities of the role..."
                            value={job.text}
                            onChange={(e) =>
                              setJdTexts((prev) =>
                                prev.map((entry, entryIndex) =>
                                  entry.id === job.id
                                    ? {
                                        ...entry,
                                        text: e.target.value,
                                        title:
                                          entry.title.trim().length > 0 && entry.title !== `Role ${entryIndex + 1}`
                                            ? entry.title
                                            : inferTitleFromText(e.target.value, entryIndex),
                                      }
                                    : entry
                                )
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setJdTexts((prev) => [...prev, { id: crypto.randomUUID(), title: `Role ${prev.length + 1}`, text: '' }])
                      }
                      className="w-full py-3 border border-dashed border-cream-300 rounded-xl text-wood-500 font-medium hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50/30 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <PlusIcon className="w-4 h-4" /> Add Another Job Description
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 flex justify-end pt-6 border-t border-cream-200/80">
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  (uploadMode === 'file'
                    ? !resumeFile || jdFiles.length === 0
                    : !resumeText.trim() || jdTexts.every((job) => !job.text.trim()))
                }
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
