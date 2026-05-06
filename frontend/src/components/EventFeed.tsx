import { useRef, useEffect, useState } from 'react'
import type { LinEvent } from '../types/events'

const BADGE: Record<string, string> = {
  exec:    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  connect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  exit:    'bg-red-500/20 text-red-400 border-red-500/30',
  fork:    'bg-amber-500/20 text-amber-400 border-amber-500/30',
  unknown: 'bg-gray-700/50 text-gray-400 border-gray-600'
}

const ICONS: Record<string, string> = {
  exec: '▶',
  connect: '🔗',
  exit: '⛔',
  fork: '🌿',
  unknown: '❓'
}

export function EventFeed({ events }: { events: LinEvent[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const reversed = [...events].reverse().slice(0, 150)

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [events, autoScroll])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0d1117]/50">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-mono tracking-wider">LIVE EVENTS</span>
          <div className="px-1.5 py-0.5 bg-blue-500/20 rounded text-[9px] text-blue-400 font-bold">
            {events.length}
          </div>
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`text-[9px] px-2 py-0.5 rounded transition-colors ${
            autoScroll ? 'text-blue-400 bg-blue-500/10' : 'text-gray-500 hover:text-gray-400'
          }`}
        >
          {autoScroll ? '📌 AUTO' : '📄 PAUSED'}
        </button>
      </div>
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
        onScroll={(e) => {
          const target = e.target as HTMLDivElement
          const isAtTop = target.scrollTop === 0
          setAutoScroll(isAtTop)
        }}
      >
        {reversed.map((e, idx) => (
          <div
            key={e.id}
            className="group relative px-4 py-2.5 border-b border-white/5 hover:bg-white/5 transition-all duration-150 cursor-pointer"
            style={{ animationDelay: `${idx * 5}ms` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
            
            <div className="flex items-center gap-2 mb-1.5 relative">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase font-mono border ${BADGE[e.event] ?? BADGE.unknown}`}>
                <span className="mr-1">{ICONS[e.event]}</span>
                {e.event}
              </span>
              <span className="text-[11px] text-gray-200 font-mono font-semibold truncate flex-1">
                {e.process}
              </span>
              <span className="text-[9px] text-gray-600 font-mono shrink-0">
                {e.datetime?.slice(11, 19) ?? ''}
              </span>
            </div>
            
            <div className="text-[10px] text-gray-500 font-mono truncate pl-1">
              {e.target ?? e.filename ?? `pid:${e.pid}`}
            </div>
            
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
        
        {reversed.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <div className="text-4xl mb-2">🔭</div>
            <div className="text-[10px]">Waiting for events...</div>
          </div>
        )}
      </div>
    </div>
  )
}
