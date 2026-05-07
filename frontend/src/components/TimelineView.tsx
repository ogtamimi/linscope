import React, { useState, useMemo, useRef, useEffect } from 'react'
import type { LinEvent } from '../types/events'

interface TimelineProps {
  events: LinEvent[]
}

const EVENT_COLORS: Record<string, string> = {
  exec: '#3fb950',
  connect: '#58a6ff',
  open: '#f0883e',
  unlink: '#f85149',
  exit: '#8b949e'
}

const EVENT_ICONS: Record<string, string> = {
  exec: '▶',
  connect: '🔗',
  open: '📂',
  unlink: '🗑️',
  exit: '⏹️'
}

export function TimelineView({ events }: TimelineProps) {
  const [zoom, setZoom] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedPid, setSelectedPid] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter events by search and PID
  const filteredEvents = useMemo(() => {
    let filtered = events.slice(-500) // last 500 events
    if (search) {
      filtered = filtered.filter(e => 
        e.process.toLowerCase().includes(search.toLowerCase()) ||
        (e.filename && e.filename.toLowerCase().includes(search.toLowerCase())) ||
        (e.target && e.target.toLowerCase().includes(search.toLowerCase()))
      )
    }
    if (selectedPid) {
      filtered = filtered.filter(e => e.pid === selectedPid)
    }
    return filtered
  }, [events, search, selectedPid])

  // Group by timestamp (per second)
  const timelineGroups = useMemo(() => {
    const groups: { [key: string]: LinEvent[] } = {}
    filteredEvents.forEach(event => {
      const key = event.datetime?.slice(0, 19) || event.timestamp.toString()
      if (!groups[key]) groups[key] = []
      groups[key].push(event)
    })
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredEvents])

  const handleZoomIn = () => setZoom(prev => Math.min(prev * 1.5, 5))
  const handleZoomOut = () => setZoom(prev => Math.max(prev / 1.5, 0.5))

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0c10]">
      {/* Timeline Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0d1117]/50">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleZoomOut}
            className="px-3 py-1 bg-gray-800 rounded text-xs hover:bg-gray-700 transition"
          >−</button>
          <span className="text-xs text-gray-400">{Math.round(zoom * 100)}%</span>
          <button 
            onClick={handleZoomIn}
            className="px-3 py-1 bg-gray-800 rounded text-xs hover:bg-gray-700 transition"
          >+</button>
        </div>
        
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="🔍 Search process or file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-1 text-xs w-64 focus:outline-none focus:border-blue-500"
          />
          {selectedPid && (
            <button
              onClick={() => setSelectedPid(null)}
              className="text-xs text-blue-400 hover:text-blue-300"
            >Clear filter</button>
          )}
        </div>
      </div>

      {/* Timeline Canvas */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-4"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
      >
        <div className="relative min-w-full">
          {timelineGroups.map(([timestamp, groupEvents]) => (
            <div key={timestamp} className="mb-6">
              {/* Timestamp header */}
              <div className="sticky left-0 flex items-center gap-3 mb-2">
                <div className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                  {timestamp}
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-blue-500/30 to-transparent" />
              </div>
              
              {/* Events in this second */}
              <div className="space-y-1 ml-4">
                {groupEvents.map((event) => (
                  <div 
                    key={event.id}
                    onClick={() => setSelectedPid(event.pid)}
                    className="group flex items-center gap-3 p-2 rounded-lg bg-gray-900/30 hover:bg-gray-800/50 cursor-pointer transition-all border-l-2"
                    style={{ borderLeftColor: EVENT_COLORS[event.event] || '#6e7681' }}
                  >
                    <div className="w-6 text-center">
                      <span className="text-sm">{EVENT_ICONS[event.event] || '📌'}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-gray-200">
                          {event.process}
                        </span>
                        <span className="text-[10px] text-gray-500">[{event.pid}]</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">
                          {event.event}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono truncate">
                        {event.filename || event.target || `pid:${event.pid}`}
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono opacity-0 group-hover:opacity-100 transition">
                      click to filter
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {timelineGroups.length === 0 && (
            <div className="flex items-center justify-center h-64 text-gray-600">
              <div className="text-center">
                <div className="text-4xl mb-2">📅</div>
                <div className="text-xs">No events match your filters</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
