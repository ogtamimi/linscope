import React, { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Monitor, Network, Cpu, Shield, Save, Globe, Zap } from 'lucide-react'

export function SettingsPanel() {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('linscope_settings')
    const defaults = {
      theme: 'dark',
      wsUrl: window.location.protocol === 'https:' ? `wss://${window.location.host}/ws` : `ws://${window.location.hostname}:8000/ws`,
      enableNotifications: true,
      maxEvents: 2000,
      enableSounds: false,
      autoScroll: true,
      vtApiKey: '',
      vtAutoScan: true,
      vtSmartFilter: true,
      features: {
        anomalyDetection: true,
        blockchainTimeline: true,
        predictiveTimeline: true,
        smartGrouping: true,
        alertScoring: true,
      }
    }
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults
  })

  const [vtStats, setVTStats] = useState<{ daily_used?: number; daily_limit?: number; monthly_used?: number; monthly_limit?: number }>({})

  // Fetch VT stats on mount
  useEffect(() => {
    const fetchVTStats = async () => {
      try {
        const response = await fetch('/api/virustotal/stats')
        if (response.ok) {
          const data = await response.json()
          setVTStats(data)
        }
      } catch (error) {
        console.error('Failed to fetch VT stats:', error)
      }
    }
    fetchVTStats()
    const interval = setInterval(fetchVTStats, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    localStorage.setItem('linscope_settings', JSON.stringify(newSettings))
    
    if (key === 'wsUrl') {
      window.dispatchEvent(new CustomEvent('linscope-reconnect'))
    }
    // Notify AI settings changes
    if (['provider', 'model', 'ollamaBaseUrl'].includes(key)) {
      window.dispatchEvent(new CustomEvent('linscope-settings-changed'))
    }
  }

  const updateFeature = (feature: string, value: boolean) => {
    const newFeatures = { ...settings.features, [feature]: value }
    updateSetting('features', newFeatures)
  }

  const [activeTab, setActiveTab] = useState<'general' | 'networks' | 'threat' | 'ai'>('general')

  const isMixedContent = window.location.protocol === 'https:' && settings.wsUrl.startsWith('ws://') && !settings.wsUrl.includes('localhost') && !settings.wsUrl.includes('127.0.0.1')
  const isLocalhostOnHttps = window.location.protocol === 'https:' && settings.wsUrl.startsWith('ws://') && (settings.wsUrl.includes('localhost') || settings.wsUrl.includes('127.0.0.1'))

  return (
    <div className="h-full flex flex-col bg-[#12151F]">
      <div className="px-6 py-5 border-b border-white/5 bg-[#1A1D27]/50 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <SettingsIcon size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">System Settings</h2>
              <p className="text-[11px] font-mono text-white/50 uppercase tracking-tighter">Instance Control Center</p>
            </div>
          </div>
          
          <nav className="flex gap-2 ml-auto bg-black/20 p-1 rounded-xl">
            {[
              { id: 'general', icon: Monitor, label: 'General' },
              { id: 'networks', icon: Globe, label: 'Network' },
              { id: 'threat', icon: Shield, label: 'Intel' },
              { id: 'ai', icon: Cpu, label: 'AI' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 relative custom-scrollbar">
        <div className="max-w-3xl mx-auto space-y-8 relative z-10 text-white">
          
          {activeTab === 'general' && (
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Monitor size={16} className="text-blue-400" />
                  <h3 className="text-xs font-black text-white/70 uppercase tracking-widest">Interface Engine</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#1A1D27]/80 backdrop-blur-md rounded-2xl border border-white/5 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs font-black uppercase tracking-tighter">Auto-scroll</div>
                        <div className="text-[10px] text-white/40">Sticky event feed</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={settings.autoScroll} 
                        onChange={(e) => updateSetting('autoScroll', e.target.checked)} 
                        className="w-4 h-4 rounded border-white/10 bg-black/40 text-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                  <div className="bg-[#1A1D27]/80 backdrop-blur-md rounded-2xl border border-white/5 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs font-black uppercase tracking-tighter">Audio Feedback</div>
                        <div className="text-[10px] text-white/40">Critical alerts chime</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={settings.enableSounds} 
                        onChange={(e) => updateSetting('enableSounds', e.target.checked)} 
                        className="w-4 h-4 rounded border-white/10 bg-black/40 text-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 mb-4 text-white/40">
                  <Zap size={16} />
                  <h3 className="text-xs font-black uppercase tracking-widest">Analytics Features</h3>
                </div>
                <div className="bg-[#1A1D27]/80 backdrop-blur-md rounded-2xl border border-white/5 p-2 grid grid-cols-2">
                  {Object.entries(settings.features).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-4 hover:bg-white/5 rounded-xl transition-colors">
                      <div className="text-[11px] font-bold text-white/70 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                      <input 
                        type="checkbox" 
                        checked={value as boolean} 
                        onChange={(e) => updateFeature(key, e.target.checked)}
                        className="w-4 h-4 rounded border-white/10 bg-black/40 text-blue-500 focus:ring-blue-500/20"
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'networks' && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Network size={16} className="text-blue-400" />
                <h3 className="text-xs font-black text-white/70 uppercase tracking-widest">Connectivity Pipeline</h3>
              </div>
              <div className="bg-[#1A1D27]/80 backdrop-blur-md rounded-3xl border border-white/5 p-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">WebSocket Gateway</label>
                    <div className="relative group">
                      <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-400 transition-colors" />
                      <input
                        type="text"
                        value={settings.wsUrl}
                        onChange={(e) => updateSetting('wsUrl', e.target.value)}
                        placeholder="wss://api.linscope.io/ws"
                        className={`w-full bg-black/40 border rounded-2xl pl-12 pr-4 py-4 text-xs font-mono text-blue-400 focus:outline-none transition-all placeholder:text-white/5 ${
                          isMixedContent || isLocalhostOnHttps ? 'border-amber-500/50 focus:border-amber-500' : 'border-white/10 focus:border-blue-500/50'
                        }`}
                      />
                    </div>
                    {isMixedContent && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold">
                        <Zap size={14} />
                        <span>Security Block: Browsers block ws:// connections from https:// pages. Use wss:// instead.</span>
                      </div>
                    )}
                    {isLocalhostOnHttps && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold leading-tight">
                        <Monitor size={14} />
                        <span>Connecting to local node: Ensure your browser allows mixed content for localhost or run the collector with SSL.</span>
                      </div>
                    )}
                    <div className="text-[10px] text-white/20 ml-1 italic">* Changes apply immediately to active connection</div>
                  </div>
                </div>
              </div>
            </section>
          )}

           {activeTab === 'threat' && (
             <section className="space-y-4">
               <div className="flex items-center gap-2 mb-4">
                 <Shield size={16} className="text-red-400" />
                 <h3 className="text-xs font-black text-white/70 uppercase tracking-widest">Intelligence API</h3>
               </div>
                <div className="bg-[#1A1D27]/80 backdrop-blur-md rounded-3xl border border-white/5 p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-white/30">VirusTotal Integration</label>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Secure Vault</span>
                      </div>
                      <input
                        type="password"
                        value={settings.vtApiKey}
                        onChange={(e) => updateSetting('vtApiKey', e.target.value)}
                        placeholder="Enter API key..."
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-xs font-mono text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/5"
                      />
                      <p className="text-[10px] text-white/40 leading-relaxed px-1">
                        Linscope uses VirusTotal for real-time hash reputation scoring and network telemetry validation.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#1A1D27]/60 rounded-2xl border border-white/5 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-white/30">Auto-Scan IOC</label>
                          <input
                            type="checkbox"
                            checked={settings.vtAutoScan !== false}
                            onChange={(e) => updateSetting('vtAutoScan', e.target.checked)}
                            className="w-4 h-4 rounded border-white/10 bg-black/40 text-blue-500 focus:ring-blue-500/20"
                          />
                        </div>
                        <p className="text-[9px] text-white/40">Automatically check new IOCs in alerts</p>
                      </div>

                      <div className="bg-[#1A1D27]/60 rounded-2xl border border-white/5 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-white/30">Smart Filter</label>
                          <input
                            type="checkbox"
                            checked={settings.vtSmartFilter !== false}
                            onChange={(e) => updateSetting('vtSmartFilter', e.target.checked)}
                            className="w-4 h-4 rounded border-white/10 bg-black/40 text-blue-500 focus:ring-blue-500/20"
                          />
                        </div>
                        <p className="text-[9px] text-white/40">Skip private IPs & internal domains</p>
                      </div>
                    </div>

                    <div className="bg-[#0B0D14]/50 rounded-2xl border border-white/5 p-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-3">Quota Status</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-[9px] text-white/40 uppercase mb-1">Daily</div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-mono font-bold text-emerald-400">
                              {Math.max(0, (vtStats.daily_limit || 500) - (vtStats.daily_used || 0))}
                            </span>
                            <span className="text-xs text-white/30">/ {vtStats.daily_limit || 500}</span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
                            <div 
                              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" 
                              style={{ width: `${((vtStats.daily_used || 0) / (vtStats.daily_limit || 500)) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] text-white/40 uppercase mb-1">Monthly</div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-mono font-bold text-blue-400">
                              {Math.max(0, (vtStats.monthly_limit || 15500) - (vtStats.monthly_used || 0))}
                            </span>
                            <span className="text-xs text-white/30">/ {vtStats.monthly_limit || 15500}</span>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
                            <div 
                              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                              style={{ width: `${((vtStats.monthly_used || 0) / (vtStats.monthly_limit || 15500)) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      <p className="text-[8px] text-white/20 mt-3 italic">
                        * Quota resets daily at midnight UTC. Statistics are approximate.
                      </p>
                    </div>
                  </div>
                </div>
             </section>
           )}

           {activeTab === 'ai' && (
             <section className="space-y-4">
               <div className="flex items-center gap-2 mb-4">
                 <Cpu size={16} className="text-purple-400" />
                 <h3 className="text-xs font-black text-white/70 uppercase tracking-widest">AI Provider Configuration</h3>
               </div>
               <div className="bg-[#1A1D27]/80 backdrop-blur-md rounded-3xl border border-white/5 p-6 space-y-6">
                 <div className="space-y-4">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">AI Provider</label>
                     <div className="flex gap-2">
                       {(['ollama', 'groq', 'gemini'] as const).map((provider) => (
                         <button
                           key={provider}
                           onClick={() => updateSetting('provider', provider)}
                           className={`flex-1 px-4 py-3 rounded-xl text-[10px] font-bold uppercase transition-all ${
                             settings.provider === provider
                               ? 'bg-purple-600 text-white shadow-lg'
                               : 'bg-black/30 text-white/40 hover:text-white border border-white/5'
                           }`}
                         >
                           {provider}
                         </button>
                       ))}
                     </div>
                   </div>

                   <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Model</label>
                     <input
                       type="text"
                       value={settings.model || ''}
                       onChange={(e) => updateSetting('model', e.target.value)}
                       placeholder={settings.provider === 'ollama' ? 'llama3.2' : settings.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gemini-pro'}
                       className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs font-mono text-blue-400 focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/5"
                     />
                     <p className="text-[10px] text-white/40 leading-relaxed px-1">
                       {settings.provider === 'ollama' && 'Make sure Ollama is running locally with the specified model pulled (e.g., llama3.2)'}
                       {settings.provider === 'groq' && 'Requires GROQ_API_KEY to be configured in backend environment'}
                       {settings.provider === 'gemini' && 'Requires GEMINI_API_KEY to be configured in backend environment'}
                     </p>
                   </div>

                   {settings.provider === 'ollama' && (
                     <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1">Ollama Base URL</label>
                       <input
                         type="text"
                         value={settings.ollamaBaseUrl || 'http://localhost:11434'}
                         onChange={(e) => updateSetting('ollamaBaseUrl', e.target.value)}
                         placeholder="http://localhost:11434"
                         className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs font-mono text-blue-400 focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/5"
                       />
                     </div>
                   )}
                 </div>
               </div>
            </section>
           )}

          <div className="pt-12 text-center pb-12 opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 border border-white/5">
              <Shield size={16} className="text-blue-500" />
              <div className="flex flex-col items-start">
                 <span className="text-[10px] font-black uppercase tracking-widest text-white">Linscope Engine</span>
                 <span className="text-[9px] font-mono font-bold text-white/30 tracking-tighter italic shadow-inner">Build SQLite-V.1.0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
