import { useWebSocketAdaptive } from './hooks/useWebSocketAdaptive';
import { useAlerts } from './hooks/useAlerts';
import { AppLayout } from './components/AppLayout';
import { useState, useEffect } from 'react';
import type { AppSettings, AIProvider } from './types';

function App() {
  const { events, connected, eps } = useWebSocketAdaptive();
  const { alerts, activeAlertsCount, acknowledgeAlert, setAlerts } = useAlerts();

  // Load AI settings from localStorage
  const [aiProvider, setAiProvider] = useState<AIProvider>('ollama');
  const [aiModel, setAiModel] = useState('llama3.2');
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');

  useEffect(() => {
    const loadSettings = () => {
      const saved = localStorage.getItem('linscope_settings');
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          if (settings.provider) setAiProvider(settings.provider);
          if (settings.model) setAiModel(settings.model);
          if (settings.ollamaBaseUrl) setOllamaBaseUrl(settings.ollamaBaseUrl);
        } catch (e) {
          console.error('Error parsing settings', e);
        }
      }
    };

    loadSettings(); // Load on mount

    // Reload settings when they change (SettingsPanel triggers this event)
    const handleSettingsChange = () => loadSettings();
    window.addEventListener('linscope-settings-changed', handleSettingsChange);

    return () => {
      window.removeEventListener('linscope-settings-changed', handleSettingsChange);
    };
  }, []);

  return (
    <AppLayout 
      connected={connected} 
      eps={eps} 
      events={events} 
      alerts={alerts}
      activeAlertsCount={activeAlertsCount}
      acknowledgeAlert={acknowledgeAlert}
      setAlerts={setAlerts}
      aiProvider={aiProvider}
      aiModel={aiModel}
      ollamaBaseUrl={ollamaBaseUrl}
    />
  );
}

export default App;
