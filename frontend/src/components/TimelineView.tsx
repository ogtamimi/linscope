import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { ZoomIn, ZoomOut, Move, Clock, Lock, ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react'
import type { LinEvent } from '../types'

interface TimelineViewProps {
  events?: LinEvent[]
}

// Deterministic identification hash (Visual integrity marker)
function computeEventHash(event: LinEvent, prevHash: string = ''): string {
  const str = `${event.id}:${event.timestamp}:${event.event}:${prevHash}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export function TimelineView({ events = [] }: TimelineViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState(0)
  const [selectedEvent, setSelectedEvent] = useState<LinEvent & { hash?: string, prevHash?: string } | null>(null)
  const [verificationResult, setVerificationResult] = useState<'idle' | 'success' | 'failed'>('idle')
  const [showPredictions, setShowPredictions] = useState(true)
  
  const isDragging = useRef(false)
  const lastX = useRef(0)

  // Compute visual event chain with hashes for real-time verification view
  const eventChain = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const chained: (LinEvent & { hash: string, prevHash: string })[] = [];
    let currentHash = '00000000';
    
    sorted.forEach((e) => {
      const hash = computeEventHash(e, currentHash);
      chained.push({ ...e, hash, prevHash: currentHash });
      currentHash = hash;
    });
    return chained;
  }, [events]);

  const verifyIntegrity = () => {
    let currentHash = '00000000';
    let failed = false;

    // Verify computed client-side chain
    for (const e of eventChain) {
      const computed = computeEventHash(e, currentHash);
      if (computed !== e.hash) {
        failed = true;
        break;
      }
      currentHash = e.hash;
    }
    setVerificationResult(failed ? 'failed' : 'success');
    setTimeout(() => setVerificationResult('idle'), 3000);
  };

  const drawTimeline = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const dpr = window.devicePixelRatio

    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.scale(dpr, dpr)

    const logicalWidth = width / dpr
    const logicalHeight = height / dpr

    const padding = { top: 60, bottom: 60, left: 80, right: 120 }
    const chartWidth = logicalWidth - padding.left - padding.right
    const chartHeight = logicalHeight - padding.top - padding.bottom

    if (eventChain.length === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.font = '500 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('No events to display on timeline', logicalWidth / 2, logicalHeight / 2)
      ctx.restore()
      return
    }

    const minTime = eventChain[0].timestamp
    const maxTime = eventChain[eventChain.length - 1].timestamp
    const timeRange = maxTime - minTime || 1

    const getTimeX = (t: number) => padding.left + ((t - minTime) / timeRange) * chartWidth * zoom + offset;

    const colors = {
      exec: '#00ff88',
      connect: '#00f0ff',
      exit: '#ff0044',
      fork: '#ffb800',
      unknown: '#64748b',
    }

    // Draw center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padding.left, logicalHeight / 2)
    ctx.lineTo(logicalWidth - padding.right, logicalHeight / 2)
    ctx.stroke()

    // Draw chain indicators
    eventChain.forEach((event, idx) => {
      const x = getTimeX(event.timestamp);
      if (x < padding.left - 10 || x > logicalWidth - padding.right + 10) return;

      const y = logicalHeight / 2 + (Math.sin(idx * 0.8) * chartHeight * 0.35);
      const color = colors[event.event as keyof typeof colors] || colors.unknown;

      // Draw connection to previous
      if (idx > 0) {
         const prevX = getTimeX(eventChain[idx-1].timestamp);
         const prevY = logicalHeight / 2 + (Math.sin((idx-1) * 0.8) * chartHeight * 0.35);
         ctx.strokeStyle = `rgba(255, 255, 255, 0.05)`;
         ctx.beginPath();
         ctx.moveTo(prevX, prevY);
         ctx.bezierCurveTo(prevX + (x - prevX)/2, prevY, prevX + (x - prevX)/2, y, x, y);
         ctx.stroke();
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Highlight selected
      if (selectedEvent?.id === event.id) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Predictive Section
    if (showPredictions && eventChain.length >= 5) {
      const last5 = eventChain.slice(-5);
      const avgInterval = (last5[4].timestamp - last5[0].timestamp) / 4;
      
      ctx.save();
      ctx.setLineDash([5, 3]);
      ctx.globalAlpha = 0.4;
      
      let lastPX = getTimeX(maxTime);
      let lastPY = logicalHeight / 2 + (Math.sin((eventChain.length - 1) * 0.8) * chartHeight * 0.35);

      for (let i = 1; i <= 5; i++) {
        const pTime = maxTime + (avgInterval * i);
        const px = getTimeX(pTime);
        const py = logicalHeight / 2 + (Math.sin((eventChain.length - 1 + i) * 0.8) * chartHeight * 0.35);
        
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(lastPX, lastPY);
        ctx.lineTo(px, py);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        
        lastPX = px;
        lastPY = py;
      }
      ctx.restore();
    }

    ctx.restore()
  }, [eventChain, zoom, offset, selectedEvent, showPredictions])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width * window.devicePixelRatio
        canvas.height = entry.contentRect.height * window.devicePixelRatio
        canvas.style.width = `${entry.contentRect.width}px`
        canvas.style.height = `${entry.contentRect.height}px`
        drawTimeline()
      }
    })
    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [drawTimeline])

  useEffect(() => {
    drawTimeline()
  }, [eventChain, zoom, offset, drawTimeline])

  return (
    <div className="h-full flex flex-col bg-[#12151F] relative">
      <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-[#0B0D14]/80 to-transparent pointer-events-none z-10" />
      
      <div className="px-6 py-5 flex items-center justify-between z-20 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Clock size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white italic">Blockchain Timeline</h2>
            <p className="text-[11px] font-mono text-white/50">{events.length} chained events</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowPredictions(!showPredictions)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${showPredictions ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-white/5 border-white/5 text-white/40'}`}
          >
            <TrendingUp size={14} /> FORECASTS
          </button>
          
          <button 
            onClick={verifyIntegrity}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
              verificationResult === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
              verificationResult === 'failed' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
              'bg-white/5 border-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {verificationResult === 'success' ? <ShieldCheck size={14} /> : verificationResult === 'failed' ? <AlertTriangle size={14} /> : <Lock size={14} />}
            {verificationResult === 'success' ? 'VALID' : verificationResult === 'failed' ? 'COMPROMISED' : 'VERIFY CHAIN'}
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden m-4 mt-0 rounded-3xl border border-white/5 bg-[#0B0D14]/50 shadow-inner group"
        onMouseDown={(e) => {
          isDragging.current = true;
          lastX.current = e.clientX;
        }}
        onMouseMove={(e) => {
          if (isDragging.current) {
            setOffset(prev => prev + (e.clientX - lastX.current));
            lastX.current = e.clientX;
          }
        }}
        onMouseUp={() => isDragging.current = false}
        onMouseLeave={() => isDragging.current = false}
        onWheel={(e) => {
          const delta = -e.deltaY * 0.001;
          setZoom(prev => Math.max(0.1, Math.min(10, prev + delta)));
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
        
        {/* Detail Panel */}
        {selectedEvent && (
          <div className="absolute top-4 right-4 w-64 bg-[#1A1D27]/90 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl z-30 animate-in fade-in slide-in-from-right-4 duration-300">
            <h4 className="text-[10px] font-black uppercase text-blue-400 mb-2">Event Metadata</h4>
            <div className="space-y-3">
              <div>
                <dt className="text-[10px] text-white/40 uppercase font-black">Process</dt>
                <dd className="text-sm font-bold truncate">{selectedEvent.process}</dd>
              </div>
              <div className="flex gap-4">
                 <div className="flex-1">
                    <dt className="text-[10px] text-white/40 uppercase font-black">Hash</dt>
                    <dd className="text-[10px] font-mono text-emerald-400 truncate">{selectedEvent.hash}</dd>
                 </div>
                 <div className="flex-1">
                    <dt className="text-[10px] text-white/40 uppercase font-black">Prev</dt>
                    <dd className="text-[10px] font-mono text-white/20 truncate">{selectedEvent.prevHash}</dd>
                 </div>
              </div>
              <button 
                onClick={() => setSelectedEvent(null)}
                className="w-full py-2 bg-white/5 rounded-xl text-[10px] font-bold hover:bg-white/10"
              >
                CLOSE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
