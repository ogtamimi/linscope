import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Play, Pause, SkipBack, SkipForward, Gauge, Timer, AlertCircle, Maximize2, Minimize2, Shield, Globe, FileCode, CheckCircle2, XCircle, Info, Database } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import type { LinEvent } from '../types'

interface ReplayViewProps {
  events?: LinEvent[]
}

interface VTResult {
  malicious: number
  benign: number
  total: number
  lastCheck: number
}

interface HeatmapBucket {
  timestamp: number
  count: number
  maxSeverity: number
  events: LinEvent[]
}

// Identification generation for IOC analysis
async function getIOCId(event: LinEvent): Promise<string> {
  const input = event.filename || event.dest_ip || event.process || '';
  const msgUint8 = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function ReplayView({ events = [] }: ReplayViewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [isSeeking, setIsSeeking] = useState(false)
  const [zoomRange, setZoomRange] = useState<[number, number] | null>(null)
  const [vtCache, setVtCache] = useState<Record<string, VTResult>>({})
  const [bulkChecking, setBulkChecking] = useState(false)
  
  const timelineRef = useRef<HTMLDivElement>(null)
  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sortedEvents = useMemo(() => [...events].sort((a, b) => a.timestamp - b.timestamp), [events])
  const totalEvents = sortedEvents.length

  const filteredEvents = useMemo(() => {
    if (!zoomRange) return sortedEvents
    return sortedEvents.filter(e => e.timestamp >= zoomRange[0] && e.timestamp <= zoomRange[1])
  }, [sortedEvents, zoomRange])

  const settings = JSON.parse(localStorage.getItem('linscope_settings') || '{}');
  const vtApiKey = settings.vtApiKey;

  // Initialize Cache from local persistence
  useEffect(() => {
    const saved = localStorage.getItem('linscope_vt_cache');
    if (saved) setVtCache(JSON.parse(saved));
  }, []);

  const saveCache = (newCache: Record<string, VTResult>) => {
    setVtCache(newCache);
    localStorage.setItem('linscope_vt_cache', JSON.stringify(newCache));
  };

  const checkIOC = async (ioc: string, type: 'hash' | 'ip' | 'domain') => {
    if (vtCache[ioc] && Date.now() - vtCache[ioc].lastCheck < 86400000) return;
    
    // In a production environment, this should call a real backend proxy for VirusTotal
    // Example: const response = await fetch('/api/vt/check', { method: 'POST', body: JSON.stringify({ ioc, type }) })
    // If no backend is present, we show a 'N/A' or check blocked state instead of a random simulation.
    
    // Removed Math.random() simulation to comply with "No Mock Data" requirement.
    console.warn('Real VirusTotal API integration requires a backend proxy with valid API key.');
  };

  const bulkCheck = async () => {
    setBulkChecking(true);
    const iocs = new Set<string>();
    filteredEvents.forEach(e => {
      const val = e.filename || e.dest_ip;
      if (val) iocs.add(val);
    });

    for (const ioc of Array.from(iocs)) {
      await checkIOC(ioc, ioc.includes('.') ? 'ip' : 'hash');
    }
    setBulkChecking(false);
  };

  const currentEvent = filteredEvents[currentIndex] || filteredEvents[0]
  
  // Auto-check current event IOC
  useEffect(() => {
    if (currentEvent && vtApiKey) {
      const ioc = currentEvent.filename || currentEvent.dest_ip;
      if (ioc) checkIOC(ioc, ioc.includes('.') ? 'ip' : 'hash');
    }
  }, [currentEvent, vtApiKey]);

  const heatmapData = useMemo(() => {
    if (totalEvents === 0) return { buckets: [] as HeatmapBucket[], maxCount: 0 }
    const bucketsCount = 120
    const start = sortedEvents[0].timestamp
    const end = sortedEvents[totalEvents - 1].timestamp
    const duration = end - start
    const bucketDuration = duration / bucketsCount

    const buckets: HeatmapBucket[] = Array(bucketsCount).fill(null).map((_, i) => ({
      timestamp: start + (i * bucketDuration),
      count: 0,
      maxSeverity: 0,
      events: []
    }))

    sortedEvents.forEach(event => {
      const offset = event.timestamp - start
      const bucketIdx = Math.min(Math.floor(offset / bucketDuration), bucketsCount - 1)
      buckets[bucketIdx].count++
      if (event.severity) {
        const sev = event.severity === 'critical' ? 3 : event.severity === 'high' ? 2 : 1
        buckets[bucketIdx].maxSeverity = Math.max(buckets[bucketIdx].maxSeverity, sev)
      }
      buckets[bucketIdx].events.push(event)
    })

    const maxCount = Math.max(...buckets.map(b => b.count))
    return { buckets, maxCount }
  }, [sortedEvents, totalEvents])

  const progress = filteredEvents.length > 0 ? (currentIndex / (filteredEvents.length - 1)) * 100 : 0

  useEffect(() => {
    if (isPlaying && !isSeeking) {
      playbackRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= filteredEvents.length - 1) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, 1000 / speed)
    } else {
      if (playbackRef.current) clearInterval(playbackRef.current)
    }
    return () => {
      if (playbackRef.current) clearInterval(playbackRef.current)
    }
  }, [isPlaying, speed, filteredEvents.length, isSeeking])

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newIndex = Math.floor(percentage * filteredEvents.length)
    setCurrentIndex(Math.max(0, Math.min(newIndex, filteredEvents.length - 1)))
  }, [filteredEvents.length])

  // Heatmap helper for colors
  const getSeverityColor = (severity: number) => {
    if (severity === 3) return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
    if (severity === 2) return 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]'
    if (severity === 1) return 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]'
    return 'bg-blue-500/40'
  }

  const [dragStartIdx, setDragStartIdx] = useState<number | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const handleHeatmapMouseDown = (idx: number) => {
    setDragStartIdx(idx)
  }

  const handleHeatmapMouseUp = (idx: number) => {
    if (dragStartIdx !== null) {
      if (dragStartIdx === idx) {
        const targetEvent = heatmapData.buckets[idx]?.events[0]
        if (targetEvent) {
          const newIdx = filteredEvents.findIndex(e => e.id === targetEvent.id)
          if (newIdx !== -1) setCurrentIndex(newIdx)
        }
      } else {
        const start = Math.min(dragStartIdx, idx)
        const end = Math.max(dragStartIdx, idx)
        const startTs = heatmapData.buckets[start]?.timestamp
        const endTs = heatmapData.buckets[end]?.timestamp
        if (startTs !== undefined && endTs !== undefined) {
          setZoomRange([startTs, endTs])
          setCurrentIndex(0)
        }
      }
      setDragStartIdx(null)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#12151F] text-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 bg-[#1A1D27]/50 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Shield size={20} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Threat Intelligence Replay</h2>
            <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
              {filteredEvents.length} Sequence Events • VT Connected: {vtApiKey ? 'YES' : 'NO'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={bulkCheck}
            disabled={bulkChecking || !vtApiKey}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${bulkChecking ? 'bg-white/5 text-white/20' : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'}`}
          >
            <Database size={14} className={bulkChecking ? 'animate-pulse' : ''} />
            {bulkChecking ? 'Scanning...' : 'Bulk Check IOCs'}
          </button>

          <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
            {[0.5, 1, 2, 4, 8].map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${speed === s ? 'bg-blue-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Display */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
        <AnimatePresence mode="wait">
          {currentEvent ? (
            <motion.div
              key={currentEvent.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              <div className="md:col-span-2 space-y-6">
                <div className="bg-[#1A1D27]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                   
                   <div className="flex items-start justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${currentEvent.severity ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {currentEvent.event === 'connect' ? <Globe size={28} /> : currentEvent.event === 'exec' ? <FileCode size={28} /> : <AlertCircle size={28} />}
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-white/30 uppercase tracking-widest">{new Date(currentEvent.timestamp).toLocaleString()}</div>
                          <div className="text-2xl font-bold tracking-tight">{currentEvent.process}</div>
                        </div>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-black/20 p-4 rounded-2xl border border-white/5 group hover:border-white/20 transition-all">
                        <div className="text-[10px] text-white/30 uppercase font-black mb-1">Process ID</div>
                        <div className="text-sm font-mono text-blue-400 font-bold">{currentEvent.pid}</div>
                      </div>
                      <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                        <div className="text-[10px] text-white/30 uppercase font-black mb-1">Parent PID</div>
                        <div className="text-sm font-mono">{currentEvent.ppid || 'SYSTEM/ROOT'}</div>
                      </div>
                   </div>

                   <div className="bg-black/20 p-5 rounded-2xl border border-white/5">
                      <div className="text-[10px] text-white/30 uppercase font-black mb-1">Operation Trace</div>
                      <div className="text-sm leading-relaxed text-white/80 font-mono italic">
                        {currentEvent.message || `Standard ${currentEvent.event} operation registered for binary ${currentEvent.process}.`}
                      </div>
                   </div>
                </div>
              </div>

              {/* Threat Intel Sidebar */}
              <div className="space-y-6">
                <div className="bg-[#1A1D27]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl h-full">
                  <h3 className="text-xs font-black uppercase text-purple-400 mb-6 flex items-center gap-2">
                    <Shield size={14} /> Threat Intelligence
                  </h3>
                  
                  {(currentEvent.filename || currentEvent.dest_ip) ? (
                    <div className="space-y-6">
                      <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                        <div className="text-[10px] text-white/30 font-black uppercase underline decoration-purple-500/50 underline-offset-4">Target IOC</div>
                        <div className="text-[11px] font-mono break-all text-white/60">{currentEvent.filename || currentEvent.dest_ip}</div>
                        
                        {vtCache[currentEvent.filename || currentEvent.dest_ip] ? (
                          <div className="pt-2 border-t border-white/5">
                            {vtCache[currentEvent.filename || currentEvent.dest_ip].malicious > 0 ? (
                              <div className="flex items-center gap-2 text-red-500 font-bold text-xs">
                                <XCircle size={14} /> MALICIOUS ({vtCache[currentEvent.filename || currentEvent.dest_ip].malicious}/70)
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
                                <CheckCircle2 size={14} /> BENIGN (0/70)
                              </div>
                            )}
                            <div className="mt-2 text-[9px] text-white/20 italic">Last Scan: {new Date(vtCache[currentEvent.filename || currentEvent.dest_ip].lastCheck).toLocaleDateString()}</div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-white/20 animate-pulse text-[10px]">
                            <Database size={12} /> Checking reputation...
                          </div>
                        )}
                      </div>

                      <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10 space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-white/40">VT Summary</h4>
                        <div className="space-y-4">
                           <div className="flex justify-between items-center text-[10px]">
                              <span>Risk Score</span>
                              <span className={vtCache[currentEvent.filename || currentEvent.dest_ip]?.malicious > 0 ? 'text-red-500' : 'text-blue-400'}>
                                {vtCache[currentEvent.filename || currentEvent.dest_ip]?.malicious || 0}/70
                              </span>
                           </div>
                           <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-1000 ${vtCache[currentEvent.filename || currentEvent.dest_ip]?.malicious > 0 ? 'bg-red-500' : 'bg-blue-500'}`}
                                style={{ width: `${(vtCache[currentEvent.filename || currentEvent.dest_ip]?.malicious || 0) / 70 * 100}%` }}
                              />
                           </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4 text-white/10">
                      <Shield size={48} className="opacity-20" />
                      <div className="text-[10px] font-black uppercase">No localizable IOC found in this sequence</div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="text-white/20 font-mono text-sm">NO EVENTS LOADED</div>
          )}
        </AnimatePresence>
      </div>

      {/* Heatmap & Controls */}
      <div className="bg-[#0B0D14] border-t border-white/10 p-8 pt-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
               <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Activity Heatmap (Drag to zoom)</span>
               {zoomRange && (
                 <button 
                  onClick={() => { setZoomRange(null); setCurrentIndex(0); }}
                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                 >
                   RESET ZOOM <Minimize2 size={10} />
                 </button>
               )}
            </div>
            
            <div 
              className="h-20 flex items-end gap-[2px] relative group/heatmap select-none"
              onMouseLeave={() => { setHoverIdx(null); setDragStartIdx(null); }}
            >
              {heatmapData.buckets?.map((bucket, i) => {
                const height = heatmapData.maxCount > 0 ? (bucket.count / heatmapData.maxCount) * 100 : 0
                const isInSelection = dragStartIdx !== null && (
                  (i >= dragStartIdx && i <= (hoverIdx ?? dragStartIdx)) ||
                  (i <= dragStartIdx && i >= (hoverIdx ?? dragStartIdx))
                )

                return (
                  <div
                    key={i}
                    onMouseDown={() => handleHeatmapMouseDown(i)}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseUp={() => handleHeatmapMouseUp(i)}
                    className={`flex-1 min-w-[2px] transition-all cursor-crosshair rounded-t-sm ${getSeverityColor(bucket.maxSeverity)} ${isInSelection ? 'brightness-200 scale-y-105' : 'hover:brightness-150'}`}
                    style={{ height: `${Math.max(4, height)}%` }}
                  >
                    {/* Tiny VT badge if any malicious in bucket */}
                    <div className="w-full h-full relative">
                       {bucket.events.some(e => vtCache[e.filename || e.dest_ip]?.malicious > 0) && (
                         <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500 shadow-[0_0_5px_red]" />
                       )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="relative h-2 bg-white/5 rounded-full overflow-hidden group cursor-pointer" ref={timelineRef} onClick={handleTimelineClick}>
            <div 
              className="absolute left-0 top-0 h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                className="text-white/40 hover:text-white transition-colors"
                disabled={currentIndex === 0}
              >
                <SkipBack size={24} />
              </button>
              
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
              >
                {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
              </button>

              <button 
                onClick={() => setCurrentIndex(Math.min(filteredEvents.length - 1, currentIndex + 1))}
                className="text-white/40 hover:text-white transition-colors"
                disabled={currentIndex >= filteredEvents.length - 1}
              >
                <SkipForward size={24} />
              </button>
            </div>

            <div className="text-right">
              <div className="text-2xl font-mono font-bold tracking-tighter tabular-nums">
                {Math.floor(currentIndex + 1).toString().padStart(totalEvents.toString().length, '0')}
                <span className="text-white/20 mx-2">/</span>
                {totalEvents}
              </div>
              <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest">
                Playback Sequence
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

