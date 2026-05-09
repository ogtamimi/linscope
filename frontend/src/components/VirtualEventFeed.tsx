import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronRight, Hash, Activity, Terminal } from 'lucide-react'
import type { LinEvent } from '../types'

const BADGE: Record<string, string> = {
  exec: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  connect: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  exit: 'bg-red-500/20 text-red-400 border-red-500/30',
  fork: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  unknown: 'bg-gray-700/50 text-gray-400 border-gray-600'
}

const ICONS: Record<string, string> = {
  exec: '▶',
  connect: '🔗',
  exit: '⛔',
  fork: '🌿',
  unknown: '❓'
}

const ITEM_HEIGHT = 72
const GROUP_HEADER_HEIGHT = 48

interface VirtualEventFeedProps {
  events: LinEvent[]
  droppedEvents?: number
}

type GroupBy = 'none' | 'process' | 'type' | 'ioc'

interface EventGroup {
  id: string
  title: string
  icon: any
  events: LinEvent[]
  isExpanded: boolean
}

export function VirtualEventFeed({ events, droppedEvents = 0 }: VirtualEventFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(() => {
    const saved = localStorage.getItem('linscope_settings')
    if (saved) {
      try {
        const settings = JSON.parse(saved)
        return settings.autoScroll ?? true
      } catch (e) {
        return true
      }
    }
    return true
  })
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  // Compute groups
  const groups = useMemo(() => {
    if (groupBy === 'none') return []
    
    const map = new Map<string, LinEvent[]>()
    
    events.forEach(e => {
      let key = ''
      if (groupBy === 'process') key = `${e.process} (PID ${e.pid})`
      else if (groupBy === 'type') key = e.event
      else if (groupBy === 'ioc') key = e.dest_ip || e.filename || 'no-ioc'
      
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    })

    return Array.from(map.entries()).map(([title, evs]) => ({
      id: title,
      title,
      icon: groupBy === 'process' ? Terminal : groupBy === 'type' ? Activity : Hash,
      events: [...evs].reverse(),
      isExpanded: !!expandedGroups[title]
    }))
  }, [events, groupBy, expandedGroups])

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const reversedEvents = useMemo(() => [...events].reverse(), [events])

  useEffect(() => {
    if (autoScroll && containerRef.current && groupBy === 'none') {
      containerRef.current.scrollTop = 0
    }
  }, [events.length, autoScroll, groupBy])

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-white">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0d1117]/50">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 font-black tracking-widest uppercase">Live Telemetry</span>
            <div className="px-1.5 py-0.5 bg-blue-500/20 rounded text-[9px] text-blue-400 font-bold">{events.length}</div>
          </div>
          <select 
            value={groupBy} 
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="bg-transparent border-none text-[10px] font-bold text-white/40 focus:outline-none hover:text-white transition-colors cursor-pointer"
          >
            <option value="none">UNGROUPED FEED</option>
            <option value="process">GROUP BY PROCESS</option>
            <option value="type">GROUP BY EVENT TYPE</option>
            <option value="ioc">GROUP BY IOC (IP/FILE)</option>
          </select>
        </div>
        <button 
          onClick={() => setAutoScroll(!autoScroll)} 
          disabled={groupBy !== 'none'}
          className={`text-[9px] px-3 py-1 rounded-lg font-bold transition-all ${autoScroll && groupBy === 'none' ? 'bg-blue-500 text-white shadow-lg' : 'text-blue-400 bg-blue-500/10'}`}
        >
          {autoScroll ? 'AUTO-SCROLL' : 'FREE-VIEW'}
        </button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {groupBy === 'none' ? (
          <div className="space-y-1">
            {reversedEvents.map((e, i) => (
              <div key={e.id || i} className="group p-3 rounded-xl border border-white/5 bg-[#161b22]/30 hover:bg-[#161b22] hover:border-white/10 transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase border shrink-0 ${BADGE[e.event] || BADGE.unknown}`}>
                    {ICONS[e.event] || ICONS.unknown} {e.event}
                  </span>
                  <span className="text-xs font-bold text-gray-200 truncate">{e.process}</span>
                  <span className="text-[10px] text-gray-500 font-mono ml-auto">{new Date(e.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                </div>
                <div className="text-[10px] text-gray-500 font-mono truncate pl-1 border-l border-white/5 ml-1">
                  {e.filename || e.dest_ip || `PID: ${e.pid} • PPID: ${e.ppid || 'N/A'}`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map(group => (
              <div key={group.id} className="rounded-2xl border border-white/5 bg-[#161b22]/50 overflow-hidden">
                <button 
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <group.icon size={16} className="text-blue-400" />
                    <span className="text-xs font-bold truncate max-w-[180px]">{group.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-black/40 rounded-full text-white/40">{group.events.length}</span>
                  </div>
                  {group.isExpanded ? <ChevronDown size={14} className="text-white/20" /> : <ChevronRight size={14} className="text-white/20" />}
                </button>
                
                {group.isExpanded && (
                  <div className="p-2 space-y-1 bg-black/20 border-t border-white/5">
                    {group.events.map((e, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-white/5 text-[10px] font-mono flex items-center justify-between gap-2">
                        <span className="text-white/60 truncate">{e.event}: {e.filename || e.dest_ip || e.message || 'activity'}</span>
                        <span className="text-white/20 shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
