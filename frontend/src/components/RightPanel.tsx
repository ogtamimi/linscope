import React, { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { LinEvent } from '../types'
import { FileText, Network, Search, Filter } from 'lucide-react'
import { format } from 'date-fns'

const EVENT_COLORS = {
  exec: '#00ff88',
  connect: '#00f0ff',
  exit: '#ff0044',
  fork: '#ffb800',
  unknown: '#64748b',
} as const

interface RightPanelProps {
  events?: LinEvent[]
}

export function RightPanel({ events = [] }: RightPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<string>('all')

  const filteredEvents = events.filter(e => filter === 'all' || e.event === filter).reverse()

  return (
    <div className="h-full flex flex-col bg-[#12151F] text-white">
      {/* Header Area */}
      <div className="px-5 py-4 border-b border-white/5 bg-[#1A1D27]/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold tracking-tight text-white">Event Stream</h2>
          <span className="px-2.5 py-1 rounded-md bg-[#2A2E3B] text-xs font-mono font-medium text-white/70">
            {events.length} TOTAL
          </span>
        </div>
        
        {/* Modern Filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-[#0B0D14] p-1 rounded-xl border border-white/5">
            {['all', 'exec', 'connect', 'exit'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all uppercase tracking-wider ${
                  filter === f
                    ? 'bg-[#2A2E3B] text-white shadow-sm'
                    : 'text-white/40 hover:text-white/80'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="p-2 rounded-xl bg-[#0B0D14] border border-white/5 text-white/50 hover:text-white hover:bg-[#2A2E3B] transition-colors">
            <Filter size={16} />
          </button>
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-hidden relative" ref={scrollRef}>
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1A1D27] flex items-center justify-center mb-4 shadow-xl border border-white/5">
              <Search size={28} className="opacity-50" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Awaiting Telemetry</h3>
            <p className="text-xs max-w-[200px] leading-relaxed">No events captured yet. Check agent connection.</p>
          </div>
        ) : (
          <VirtualEventList events={filteredEvents} />
        )}
      </div>
    </div>
  )
}

function VirtualEventList({ events }: { events: LinEvent[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  })

  return (
    <div ref={parentRef} className="h-full overflow-auto p-3 custom-scrollbar">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const event = events[virtualItem.index]
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="pb-2"
            >
              <EventRow event={event} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EventRow({ event }: { event: LinEvent }) {
  const color = EVENT_COLORS[event.event as keyof typeof EVENT_COLORS] || EVENT_COLORS.unknown
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`
        flex flex-col p-3.5 rounded-2xl border transition-all cursor-pointer bg-[#1A1D27]
        ${expanded ? 'border-white/10 shadow-lg' : 'border-white/5 hover:border-white/10'}
      `}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl bg-[#0B0D14] border border-white/5">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}80` }}
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-white truncate pr-2">{event.process}</span>
            <span className="text-[11px] font-mono text-white/40 flex-shrink-0">
              {format(event.timestamp, 'HH:mm:ss')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide"
              style={{ backgroundColor: `${color}15`, color }}
            >
              {event.event}
            </span>
            <span className="text-[11px] text-white/50 font-mono">
              PID: {event.pid}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-3 animate-fade-in">
          {event.filename && (
            <div className="p-3 rounded-xl bg-[#0B0D14] border border-white/5">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText size={12} className="text-white/40" />
                <span className="text-[10px] text-white/40 uppercase font-bold">Target Path</span>
              </div>
              <div className="text-[12px] font-mono text-white/90 break-all">{event.filename}</div>
            </div>
          )}
          {event.dest_ip && (
            <div className="p-3 rounded-xl bg-[#0B0D14] border border-white/5">
              <div className="flex items-center gap-2 mb-1.5">
                <Network size={12} className="text-white/40" />
                <span className="text-[10px] text-white/40 uppercase font-bold">Network</span>
              </div>
              <div className="text-[12px] font-mono text-white/90">{event.dest_ip}:{event.dest_port}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
