import React, { useState, useEffect } from 'react';
import { createEmptyJobWorkspace, createInitialAppState, normalizeAppState } from './types';
import { getStatus } from './services/api';
import { ApiKeySetup } from './components/ApiKeySetup';
import { SetupScreen } from './components/SetupScreen';
import { Dashboard } from './components/Dashboard';
import { LoaderIcon } from './components/Icons';

const App: React.FC = () => {
  const [state, setState] = useState(createInitialAppState);
  const [isApiConfigured, setIsApiConfigured] = useState<boolean | null>(null);
  const [currentModel, setCurrentModel] = useState('');

  useEffect(() => {
    getStatus()
      .then(({ configured, model }) => {
        setIsApiConfigured(configured);
        setCurrentModel(model);
      })
      .catch(() => setIsApiConfigured(false));
  }, []);

  const handleSetupComplete = (resume: string, jobs: { title: string; jdText: string }[]) => {
    const jobDescriptions = jobs.map((job, index) =>
      createEmptyJobWorkspace(job.title.trim() || `Role ${index + 1}`, job.jdText)
    );

    setState((prev) => ({
      ...prev,
      resumeText: resume,
      jobDescriptions,
      activeJobId: jobDescriptions[0]?.id || '',
      isSetupComplete: jobDescriptions.length > 0,
    }));
  };

  // Loading state while checking API status
  if (isApiConfigured === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoaderIcon className="w-7 h-7 text-accent-500" />
      </div>
    );
  }

  // API key not configured
  if (!isApiConfigured) {
    return (
      <ApiKeySetup
        onConfigured={() => {
          getStatus().then(({ model }) => {
            setIsApiConfigured(true);
            setCurrentModel(model);
          });
        }}
      />
    );
  }

  // Resume/JD not entered yet
  if (!state.isSetupComplete) {
    return <SetupScreen onComplete={handleSetupComplete} onLoadSession={(loaded) => setState(normalizeAppState(loaded))} />;
  }

  // Main dashboard
  return <Dashboard state={state} setState={setState} currentModel={currentModel} onModelChange={setCurrentModel} />;
};

export default App;
