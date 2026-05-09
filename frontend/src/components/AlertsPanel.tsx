import React from 'react'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { 
  AlertTriangle, Check, ChevronDown, ChevronRight, ThumbsUp, ThumbsDown, 
  Filter, Search, Wifi, WifiOff, ShieldAlert, Cpu, Activity,
  Shield, ExternalLink, Loader2, XCircle, CheckCircle2, AlertCircle
} from 'lucide-react'
import type { Alert } from '../types'
import { SEVERITY_COLORS } from '../types'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useVirusTotal } from '../hooks/useVirusTotal'

interface AlertFeedback {
  rating: 'up' | 'down'
  submitted: boolean
}

interface AlertsPanelProps {
  alerts: Alert[]
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>
  acknowledgeAlert: (id: string) => void
}

interface VTPopupState {
  alertId: string
  iocIndex: number
}

export function AlertsPanel({ alerts, setAlerts, acknowledgeAlert }: AlertsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all')
  const [feedbacks, setFeedbacks] = useState<Record<string, AlertFeedback>>({})
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})
  const [vtPopup, setVTPopup] = useState<VTPopupState | null>(null)

  const { checkIOC, status, stats, getVTStats } = useVirusTotal()

  useEffect(() => {
    getVTStats()
  }, [getVTStats])

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (alert.acknowledged) return false
      
      const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter
      const query = searchQuery.toLowerCase()
      const matchesSearch = alert.title.toLowerCase().includes(query) || 
                          alert.description.toLowerCase().includes(query) ||
                          (alert.rule_name || '').toLowerCase().includes(query)
      
      return matchesSeverity && matchesSearch
    }).sort((a, b) => b.timestamp - a.timestamp)
  }, [alerts, searchQuery, severityFilter])

  const parentRef = useRef<HTMLDivElement>(null)
  
  const virtualizer = useVirtualizer({
    count: filteredAlerts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 10,
    getItemKey: (index) => filteredAlerts[index].id,
  })

  const handleToggle = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }))
    setTimeout(() => virtualizer.measure(), 0)
  }

  const handleFeedback = async (alertId: string, type: 'up' | 'down') => {
    if (feedbacks[alertId]?.submitted) return

    const user_score = type === 'up' ? 100 : 0
    const feedback_type = type === 'up' ? 'useful' : 'not_useful'

    try {
      const response = await fetch('/api/alerts/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId, user_score, feedback_type })
      })

      if (response.ok) {
        setFeedbacks(prev => ({
          ...prev,
          [alertId]: { rating: type, submitted: true }
        }))
      }
    } catch (err) {
      console.error('Failed to send feedback:', err)
    }
  }

  const getAlertIOCs = useCallback((alert: Alert) => {
    const iocs: Array<{ type: 'ip' | 'domain' | 'hash', value: string, context?: string }> = []
    if (alert.iocs && alert.iocs.length > 0) {
      return alert.iocs
    }
    return iocs
  }, [])

  const handleVTClick = useCallback((alert: Alert, iocIndex: number) => {
    const iocs = getAlertIOCs(alert)
    if (iocs.length <= iocIndex) return
    
    const ioc = iocs[iocIndex]
    if (!status[`${alert.id}-${iocIndex}`]) {
      checkIOC(ioc.type as 'ip' | 'domain' | 'hash', ioc.value, `${alert.id}-${iocIndex}`)
    }
    setVTPopup({ alertId: alert.id, iocIndex })
  }, [getAlertIOCs, checkIOC, status])

  const getVTResult = useCallback((alertId: string, iocIndex: number) => {
    return status[`${alertId}-${iocIndex}`]
  }, [status])

  const closeVTPopup = useCallback(() => setVTPopup(null), [])

  const renderVTBadge = useCallback((alert: Alert, iocIndex: number) => {
    const vtStatus = getVTResult(alert.id, iocIndex)
    if (!vtStatus) return null
    if (vtStatus.loading) return <Loader2 size={12} className="animate-spin ml-1 text-purple-400" />
    if (vtStatus.error) return <XCircle size={14} className="ml-1 text-red-500" />
    if (vtStatus.result) {
      const { malicious, suspicious } = vtStatus.result
      const total = malicious + suspicious
      if (total > 0) return <AlertCircle size={14} className="ml-1 text-red-500" />
      else return <CheckCircle2 size={14} className="ml-1 text-emerald-500" />
    }
    return null
  }, [getVTResult])

  return (
    <div className="h-full flex flex-col bg-[#12151F]">
      <div className="px-6 py-5 border-b border-white/5 bg-[#1A1D27]/50 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <ShieldAlert size={18} className="text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Security Alerts
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-400">
                  <Wifi size={10} />
                  Live
                </div>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative group">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-blue-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search alerts..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-black/30 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/10 focus:outline-none focus:border-blue-500/50 w-48 transition-all"
              />
            </div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white/50 focus:outline-none focus:border-white/20 cursor-pointer hover:text-white transition-colors capitalize"
            >
              <option value="all">All Levels</option>
              <option value="critical">Critical Only</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto p-4 custom-scrollbar">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40">
            <div className="w-16 h-16 rounded-3xl bg-[#1A1D27] flex items-center justify-center mb-4 shadow-xl border border-white/5">
              <Activity size={28} className="opacity-50" />
            </div>
            <p className="text-sm font-bold text-white mb-1">No alerts detected</p>
            <p className="text-xs max-w-[200px] text-center leading-relaxed">
              Scanning system processes for suspicious patterns in real-time.
            </p>
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const alert = filteredAlerts[virtualItem.index]
              if (!alert) return null
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    padding: '6px 12px',
                  }}
                >
                  <AlertCard
                    alert={alert}
                    onAcknowledge={acknowledgeAlert}
                    feedback={feedbacks[alert.id]}
                    onVote={(type) => handleFeedback(alert.id, type)}
                    expanded={expandedItems[alert.id] || false}
                    onToggle={() => handleToggle(alert.id)}
                    vtIOCs={getAlertIOCs(alert)}
                    onVTClick={(iocIdx) => handleVTClick(alert, iocIdx)}
                    vtStatus={getVTResult(alert.id, virtualItem.index)}
                    isVTPopupOpen={vtPopup?.alertId === alert.id && vtPopup?.iocIndex === virtualItem.index}
                    onCloseVTPopup={closeVTPopup}
                    renderVTBadge={renderVTBadge}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

interface AlertCardProps {
  alert: Alert
  onAcknowledge: (id: string) => void
  feedback?: AlertFeedback
  onVote: (type: 'up' | 'down') => void
  expanded: boolean
  onToggle: () => void
  vtIOCs: Array<{ type: 'ip' | 'domain' | 'hash', value: string }>
  onVTClick: (iocIndex: number) => void
  vtStatus?: { loading: boolean; result?: any; error?: string }
  isVTPopupOpen: boolean
  onCloseVTPopup: () => void
  renderVTBadge: (alert: Alert, iocIndex: number) => React.ReactNode
}

function AlertCard({
  alert,
  onAcknowledge,
  feedback,
  onVote,
  expanded,
  onToggle,
  vtIOCs,
  onVTClick,
  vtStatus,
  isVTPopupOpen,
  onCloseVTPopup,
  renderVTBadge
}: AlertCardProps) {
  const color = SEVERITY_COLORS[alert.severity] || '#64748b'

  return (
    <div
      className="border rounded-2xl transition-all duration-200 overflow-hidden shadow-lg relative"
      style={{
        backgroundColor: '#1A1D27',
        borderColor: expanded ? `${color}40` : 'rgba(255,255,255,0.05)',
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform ${expanded ? 'scale-110' : ''}`}
              style={{ backgroundColor: `${color}15`, color }}
            >
              <ShieldAlert size={22} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-3 mb-1.5">
                <span
                  className="text-[9px] font-black px-2 py-0.5 rounded-lg tracking-widest uppercase"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {alert.severity}
                </span>
                <span className="text-sm font-bold text-white truncate">{alert.title}</span>
                {alert.score !== undefined && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <div className="flex flex-col items-end">
                      <div className="text-[9px] text-white/20 font-black uppercase tracking-tighter">Certainty</div>
                      <div className={`text-xs font-mono font-bold ${alert.score > 80 ? 'text-emerald-400' : alert.score < 40 ? 'text-red-400' : 'text-blue-400'}`}>
                        {alert.score}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-white/50 line-clamp-2 leading-relaxed font-medium">{alert.description}</p>

              {vtIOCs.length > 0 && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[9px] text-white/30 uppercase font-black">Threat Intel:</span>
                  {vtIOCs.map((ioc, idx) => (
                    <button
                      key={idx}
                      onClick={() => onVTClick(idx)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all text-[10px]"
                      title={`Check ${ioc.type}: ${ioc.value} on VirusTotal`}
                    >
                      <Shield size={10} />
                      {ioc.type === 'ip' ? 'IP' : ioc.type === 'domain' ? 'DOM' : 'HASH'}
                      {renderVTBadge(alert, idx)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="p-2 rounded-xl bg-white/5 text-white/20 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Acknowledge"
            >
              <Check size={16} strokeWidth={3} />
            </button>
            <button
              onClick={onToggle}
              className="p-2 rounded-xl bg-white/5 border border-white/5 text-white/40 hover:text-white transition-colors"
            >
              {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="px-6 pb-6 pt-3 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                  <span className="text-[9px] text-white/20 uppercase font-black block mb-2 tracking-widest">Metadata</span>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-white/40">ID</span>
                      <span className="font-mono text-white/60">{alert.id.slice(0, 8)}...</span>
                    </div>
                    {alert.affected_pids && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-white/40">PIDs</span>
                        <span className="font-mono text-white/60">{alert.affected_pids.join(', ')}</span>
                      </div>
                    )}
                    {alert.rule_name && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-white/40">Rule</span>
                        <span className="font-mono text-white/60">{alert.rule_name}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                  <span className="text-[9px] text-white/20 uppercase font-black block mb-2 tracking-widest">Risk Analysis</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full" style={{ width: `${alert.score || 0}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-[10px] font-bold" style={{ color }}>{alert.score || 0}%</span>
                  </div>
                </div>
              </div>

              {vtIOCs.length > 0 && (
                <div className="space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/30 uppercase font-black">VirusTotal Check</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-white/20">Daily left: {stats.daily}</span>
                    </div>
                  </div>

                  {isVTPopupOpen && vtStatus && (
                    <div className="bg-[#0B0D14] border border-purple-500/30 rounded-xl p-4 relative animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <button
                        onClick={onCloseVTPopup}
                        className="absolute top-2 right-2 text-white/40 hover:text-white transition-colors"
                      >
                        <XCircle size={16} />
                      </button>
                      {vtStatus.loading ? (
                        <div className="flex items-center gap-3 text-white/60">
                          <Loader2 size={16} className="animate-spin" />
                          Querying VirusTotal...
                        </div>
                      ) : vtStatus.error ? (
                        <div className="text-red-400 text-sm">
                          Error: {vtStatus.error}
                        </div>
                      ) : vtStatus.result ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {vtStatus.result.malicious + vtStatus.result.suspicious > 0 ? (
                                <div className="flex items-center gap-2 text-red-500">
                                  <AlertCircle size={20} />
                                  <span className="font-bold">Malicious Detected</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-emerald-400">
                                  <CheckCircle2 size={20} />
                                  <span className="font-bold">Clean</span>
                                </div>
                              )}
                            </div>
                            {vtStatus.result.link && (
                              <a
                                href={vtStatus.result.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                              >
                                Full Report <ExternalLink size={12} />
                              </a>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-red-500/10 rounded-lg p-3 text-center">
                              <div className="text-xl font-bold text-red-500">{vtStatus.result.malicious}</div>
                              <div className="text-[9px] text-red-400 uppercase">Malicious</div>
                            </div>
                            <div className="bg-amber-500/10 rounded-lg p-3 text-center">
                              <div className="text-xl font-bold text-amber-500">{vtStatus.result.suspicious}</div>
                              <div className="text-[9px] text-amber-400 uppercase">Suspicious</div>
                            </div>
                            <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                              <div className="text-xl font-bold text-blue-500">{vtStatus.result.total || 'N/A'}</div>
                              <div className="text-[9px] text-blue-400 uppercase">Total Engines</div>
                            </div>
                          </div>

                          {vtStatus.result.last_analysis && (
                            <div className="text-[10px] text-white/30">
                              Last scanned: {new Date(vtStatus.result.last_analysis).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20">
                  Inspect Events
                </button>
                <button className="px-6 py-2.5 rounded-xl bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-widest hover:text-white hover:bg-white/10 transition-all">
                  Mute Rule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}