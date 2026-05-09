import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Send, Bot, User, Copy, Check, Loader2, Cpu, Zap, AlertTriangle, FileText, Search, Sparkles, Trash2, Download, Archive, MessageSquare, History, Plus, BookOpen } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'motion/react'
import { jsPDF } from 'jspdf';
import type { ChatMessage, LinEvent, Alert, ChatSession, AIProvider } from '../types'

interface AIChatProps {
  events?: LinEvent[]
  alerts?: Alert[]
  provider?: AIProvider
  model?: string
  ollamaBaseUrl?: string
  key?: React.Key
}

interface IncidentReport {
  id: string
  title: string
  summary: string
  timestamp: number
  eventsCount: number
}

const SESSIONS_KEY = 'linscope_chat_sessions'
const REPORTS_KEY = 'linscope_incident_reports'
const API_BASE_URL = 'http://localhost:8000'

export function AIChat({ events = [], alerts = [], provider = 'ollama', model = 'llama3.2', ollamaBaseUrl = 'http://localhost:11434' }: AIChatProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'reports'>('chat')
  
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem(SESSIONS_KEY)
    if (saved) {
      try { 
        const parsed = JSON.parse(saved)
        if (parsed.length > 0) return parsed
      } catch (e) { console.error(e) }
    }
    return [{
      id: 'default',
      title: 'Initial Investigation',
      messages: [{
        id: 'welcome',
        role: 'assistant',
        content: "Hello! I'm your Linscope AI Analyst. I can generate professional incident reports and analyze system behavior. How can I help?",
        timestamp: Date.now(),
      }],
      timestamp: Date.now()
    }]
  })

  const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0]?.id || 'default')

  const [reports, setReports] = useState<IncidentReport[]>(() => {
    const saved = localStorage.getItem(REPORTS_KEY)
    return saved ? JSON.parse(saved) : []
  })

  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const activeSession = useMemo(() => 
    sessions.find(s => s.id === activeSessionId) || sessions[0], 
  [sessions, activeSessionId])

  useEffect(() => {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
  }, [sessions])

  useEffect(() => {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports))
  }, [reports])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activeSession?.messages])

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: `Investigation ${new Date().toLocaleTimeString()}`,
      messages: [{
        id: `w-${Date.now()}`,
        role: 'assistant',
        content: "Ready for a new investigation. What should we look into?",
        timestamp: Date.now(),
      }],
      timestamp: Date.now()
    }
    setSessions(prev => [newSession, ...prev])
    setActiveSessionId(newSession.id)
    setActiveTab('chat')
  }

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    const newSessions = sessions.filter(s => s.id !== id)
    
    if (newSessions.length === 0) {
      const defaultSession: ChatSession = {
        id: 'default',
        title: 'Initial Investigation',
        messages: [{ 
          id: 'w-' + Date.now(), 
          role: 'assistant', 
          content: 'Investigation history cleared. How can I help you today?', 
          timestamp: Date.now() 
        }],
        timestamp: Date.now()
      }
      setSessions([defaultSession])
      setActiveSessionId(defaultSession.id)
    } else {
      setSessions(newSessions)
      if (activeSessionId === id) {
        setActiveSessionId(newSessions[0].id)
      }
    }
  }

  const generatePDF = (report: IncidentReport) => {
    const doc = new jsPDF();
    doc.setFillColor(18, 21, 31);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('LINSCOPE SECURITY REPORT', 15, 25);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date(report.timestamp).toLocaleString()}`, 150, 25);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text(report.title, 15, 55);
    doc.setFontSize(12); doc.setFont('helvetica', 'normal');
    const splitSummary = doc.splitTextToSize(report.summary, 180);
    doc.text(splitSummary, 15, 70);
    doc.setFontSize(10); doc.setTextColor(100, 100, 100);
    doc.text(`Analyze based on ${report.eventsCount} system events.`, 15, 280);
    doc.save(`linscope_report_${report.id}.pdf`);
  };

  const saveReport = (title: string, summary: string, count: number) => {
    const newReport: IncidentReport = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      summary,
      timestamp: Date.now(),
      eventsCount: count
    };
    setReports(prev => [newReport, ...prev]);
  };

  const handleSend = useCallback(async (customPrompt?: string, isReportRequest = false) => {
    const messageText = customPrompt !== undefined ? customPrompt : input.trim()
    if (!messageText && !isReportRequest) return
    if (isStreaming) return

    const userMsg: ChatMessage = { 
      id: `u-${Date.now()}`, 
      role: 'user', 
      content: isReportRequest ? "Generate formal incident report" : messageText, 
      timestamp: Date.now() 
    }
    
    setSessions(prev => prev.map(s => s.id === activeSessionId ? {
      ...s,
      messages: [...s.messages, userMsg],
      // Update title based on first message if default
      title: s.messages.length <= 1 ? (messageText || "Security Report").slice(0, 30) + ((messageText || "Security Report").length > 30 ? '...' : '') : s.title
    } : s))

    if (!customPrompt) setInput('')
    setIsStreaming(true)

    const assistantMsgId = `a-${Date.now()}`
    setSessions(prev => prev.map(s => s.id === activeSessionId ? {
      ...s,
      messages: [...s.messages, { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true }]
    } : s))

    try {
      const contextEvents = events.slice(-50)
      
      if (isReportRequest) {
        // Generate formal incident report using analyze-incident endpoint
        const response = await fetch(`${API_BASE_URL}/api/ai/analyze-incident`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            events: contextEvents,
            provider: provider,
            model: model,
            ollama_base_url: ollamaBaseUrl
          })
        })

        if (!response.ok) {
          throw new Error(`Backend error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        let fullResponse = data.analysis || data.error || 'No analysis generated'
        
        // Stream the response for better UX
        let accumulated = ''
        for (let i = 0; i < fullResponse.length; i += 3) {
          accumulated = fullResponse.substring(0, i + 3)
          setSessions(prev => prev.map(s => s.id === activeSessionId ? {
            ...s,
            messages: s.messages.map(msg => msg.id === assistantMsgId ? { ...msg, content: accumulated } : msg)
          } : s))
          await new Promise(resolve => setTimeout(resolve, 5))
        }

        setSessions(prev => prev.map(s => s.id === activeSessionId ? {
          ...s,
          messages: s.messages.map(msg => msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg)
        } : s))
        
        // Save to reports
        saveReport("Security Incident Report", fullResponse, contextEvents.length)
      } else {
        // Regular chat
        const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageText,
            context_events: contextEvents,
            provider: provider,
            model: model,
            ollama_base_url: ollamaBaseUrl,
          }),
        })

        if (!response.ok) {
          throw new Error(`Backend error: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        let fullResponse = data.response || data.error || 'No response from AI service'

        // Stream the response for better UX
        let accumulated = ''
        for (let i = 0; i < fullResponse.length; i += 5) {
          accumulated = fullResponse.substring(0, i + 5)
          setSessions(prev => prev.map(s => s.id === activeSessionId ? {
            ...s,
            messages: s.messages.map(msg => msg.id === assistantMsgId ? { ...msg, content: accumulated } : msg)
          } : s))
          await new Promise(resolve => setTimeout(resolve, 10))
        }

        setSessions(prev => prev.map(s => s.id === activeSessionId ? {
          ...s,
          messages: s.messages.map(msg => msg.id === assistantMsgId ? { ...msg, isStreaming: false } : msg)
        } : s))
      }

    } catch (error) {
      console.error(error)
      const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease ensure:\n1. Backend is running at http://localhost:8000\n2. Ollama is running at ${ollamaBaseUrl}\n3. Model "${model}" is pulled (ollama pull ${model})`
      setSessions(prev => prev.map(s => s.id === activeSessionId ? {
        ...s,
        messages: s.messages.map(msg => msg.id === assistantMsgId ? { ...msg, content: errorMsg, isStreaming: false } : msg)
      } : s))
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming, activeSessionId, events, provider, model, ollamaBaseUrl])

  return (
    <div className="h-full flex flex-col bg-[#12151F] relative overflow-hidden">
      {/* Top Navigation Tab */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex bg-[#1A1D27]/90 backdrop-blur-3xl border border-white/10 rounded-2xl p-1 shadow-2xl">
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'chat' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
        >
          <MessageSquare size={16} /> Analyst
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'reports' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
        >
          <BookOpen size={16} /> Saved Reports
        </button>
        <div className="w-[1px] h-4 bg-white/10 mx-1 self-center" />
        <button 
          onClick={createNewSession}
          className="p-2 rounded-xl text-emerald-400 hover:bg-emerald-500/10 transition-all"
          title="New Investigation"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-24 pb-40" ref={scrollRef}>
        <div className="max-w-3xl mx-auto">
          {activeTab === 'chat' ? (
            <div className="space-y-8">
               {activeSession?.messages.map((msg) => (
                 <motion.div 
                   key={msg.id} 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                 >
                   <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-blue-600' : 'bg-[#1A1D27] border border-white/10 text-blue-400'}`}>
                     {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                   </div>
                   <div className={`group relative p-5 rounded-3xl max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600/20 text-blue-50 border border-blue-500/20' : 'bg-[#1A1D27]/50 backdrop-blur-xl border border-white/5 text-white/90'}`}>
                     <div className="markdown-body text-sm leading-relaxed">
                       <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                     </div>
                   </div>
                 </motion.div>
               ))}
            </div>
          ) : (
            <div className="space-y-12">
              {/* Reports Section */}
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <FileText size={18} className="text-emerald-400" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-white/70">Generated Reports</h2>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {reports.length === 0 ? (
                    <div className="bg-[#1A1D27]/30 border border-dashed border-white/5 rounded-3xl py-12 flex flex-col items-center justify-center text-white/20">
                       <p className="text-xs font-bold uppercase tracking-widest">No formal reports yet</p>
                    </div>
                  ) : (
                    reports.map(report => (
                      <motion.div 
                        key={report.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-[#1A1D27]/50 border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-white/10 transition-all border-l-4 border-l-emerald-500/50"
                      >
                        <div>
                          <div className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-1">{new Date(report.timestamp).toLocaleString()}</div>
                          <h3 className="text-lg font-bold text-white mb-2">{report.title}</h3>
                          <div className="flex items-center gap-3 text-[10px] text-blue-400 font-bold uppercase">
                            <span className="bg-blue-500/10 px-2 py-1 rounded-md">{report.eventsCount} Events Analyzed</span>
                            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md tracking-tighter italic">Official Report</span>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                          <button 
                            onClick={() => generatePDF(report)}
                            className="flex-1 md:flex-none p-3 rounded-2xl bg-white/5 text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                          >
                            <Download size={18} />
                          </button>
                          <button 
                            onClick={() => setReports(prev => prev.filter(r => r.id !== report.id))}
                            className="p-3 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </section>

              {/* Chat History Section */}
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <History size={18} className="text-blue-400" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-white/70">Investigation History</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sessions.map(session => (
                    <motion.div
                      key={session.id}
                      onClick={() => {
                        setActiveSessionId(session.id)
                        setActiveTab('chat')
                      }}
                      className={`group relative p-6 rounded-3xl border transition-all cursor-pointer ${
                        activeSessionId === session.id 
                          ? 'bg-blue-600/10 border-blue-500/30' 
                          : 'bg-[#1A1D27]/50 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="text-[9px] text-white/20 font-black uppercase tracking-[0.2em] mb-2">
                        {new Date(session.timestamp).toLocaleDateString()}
                      </div>
                      <h4 className="text-sm font-bold text-white mb-4 line-clamp-1 pr-8 transition-colors group-hover:text-blue-400">
                        {session.title}
                      </h4>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/30 font-bold uppercase">{session.messages.length} Messages</span>
                        <div className="flex items-center gap-1">
                           <button 
                             onClick={(e) => deleteSession(session.id, e)}
                             className="p-2 rounded-xl text-white/0 group-hover:text-red-400 hover:bg-red-400/10 transition-all"
                           >
                             <Trash2 size={14} />
                           </button>
                         </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'chat' && (
        <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-[#12151F] via-[#12151F] to-transparent">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center gap-2 px-1">
              <button 
                onClick={() => handleSend('', true)}
                disabled={isStreaming}
                className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold hover:bg-purple-500/20 transition-all flex items-center gap-2"
              >
                <Sparkles size={14} /> Auto-Generate Formal Report
              </button>
            </div>

            <div className="relative group">
              <AnimatePresence>
                {isStreaming && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute -top-12 left-0 right-0 flex justify-center"
                  >
                    <div className="px-4 py-2 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl">
                      <Cpu size={14} className="animate-pulse" /> AI is Processing Data...
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="relative flex bg-[#1A1D27] border border-white/10 rounded-[1.8rem] p-2 items-center gap-2 shadow-2xl">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  placeholder="Ask Linscope Analyst..."
                  className="flex-1 bg-transparent border-none px-5 py-3 text-sm text-white focus:outline-none resize-none placeholder:text-white/20 custom-scrollbar"
                  rows={1}
                />
                <button 
                  onClick={() => handleSend()} 
                  disabled={isStreaming || !input.trim()} 
                  className="w-12 h-12 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center shadow-lg"
                >
                  {isStreaming ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
