import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import type { LinEvent } from '../types/events'

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

const ITEM_HEIGHT = 72 // Approximate height in pixels
const VISIBLE_COUNT = 30 // Number of items to render

interface VirtualEventFeedProps {
  events: LinEvent[]
  droppedEvents?: number
}

export function VirtualEventFeed({ events, droppedEvents = 0 }: VirtualEventFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [visibleStart, setVisibleStart] = useState(0)
  const [visibleEnd, setVisibleEnd] = useState(VISIBLE_COUNT)
  const scrollTimeoutRef = useRef<NodeJS.Timeout>()

  // Reverse and memoize events to avoid recalculation
  const reversedEvents = useMemo(() => {
    return [...events].reverse()
  }, [events])

  // Calculate visible range based on scroll position
  const handleScroll = useCallback((e: Event) => {
    const target = e.target as HTMLDivElement
    const scrollTop = target.scrollTop
    const isAtTop = scrollTop === 0
    setAutoScroll(isAtTop)

    // Calculate which items are in view
    const start = Math.floor(scrollTop / ITEM_HEIGHT)
    const end = Math.ceil((scrollTop + target.clientHeight) / ITEM_HEIGHT)

    // Add buffer for smoother scrolling
    const buffer = 10
    setVisibleStart(Math.max(0, start - buffer))
    setVisibleEnd(Math.min(reversedEvents.length, end + buffer))

    // Reset scroll timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
  }, [reversedEvents.length])

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      // Use requestAnimationFrame for smooth scroll
      containerRef.current.scrollTop = 0
    }
  }, [events.length, autoScroll])

  // Virtualized items to render
  const visibleItems = useMemo(() => {
    return reversedEvents.slice(visibleStart, visibleEnd)
  }, [reversedEvents, visibleStart, visibleEnd])

  // Spacers for virtual scrolling
  const topSpacerHeight = visibleStart * ITEM_HEIGHT
  const bottomSpacerHeight = Math.max(
    0,
    (reversedEvents.length - visibleEnd) * ITEM_HEIGHT
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#0d1117]/50 z-10">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-mono tracking-wider">
            LIVE EVENTS
          </span>
          <div className="px-1.5 py-0.5 bg-blue-500/20 rounded text-[9px] text-blue-400 font-bold">
            {events.length}
          </div>
          {droppedEvents > 0 && (
            <div className="px-1.5 py-0.5 bg-orange-500/20 rounded text-[9px] text-orange-400 font-bold">
              Dropped: {droppedEvents}
            </div>
          )}
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`text-[9px] px-2 py-0.5 rounded transition-colors ${
            autoScroll
              ? 'text-blue-400 bg-blue-500/10'
              : 'text-gray-500 hover:text-gray-400'
          }`}
        >
          {autoScroll ? '📌 AUTO' : '📄 PAUSED'}
        </button>
      </div>

      {/* Virtual scrolling container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto custom-scrollbar"
        onScroll={handleScroll}
      >
        {/* Top spacer */}
        {topSpacerHeight > 0 && <div style={{ height: topSpacerHeight }} />}

        {/* Visible items */}
        {visibleItems.length > 0 ? (
          visibleItems.map((e, idx) => {
            const actualIndex = visibleStart + idx
            return (
              <EventRow
                key={e.id}
                event={e}
                index={actualIndex}
                isNew={actualIndex < 5}
              />
            )
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <div className="text-4xl mb-2">🔭</div>
            <div className="text-[10px]">Waiting for events...</div>
          </div>
        )}

        {/* Bottom spacer */}
        {bottomSpacerHeight > 0 && <div style={{ height: bottomSpacerHeight }} />}
      </div>
    </div>
  )
}

interface EventRowProps {
  event: LinEvent
  index: number
  isNew: boolean
}

function EventRow({ event, index, isNew }: EventRowProps) {
  return (
    <div
      className="group relative px-4 py-2.5 border-b border-white/5 hover:bg-white/5 transition-all duration-150 cursor-pointer"
      style={{
        animation: isNew ? `slideIn 0.3s ease-out ${index * 2}ms` : 'none',
        animationFillMode: 'both'
      }}
    >
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Hover gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />

      {/* Event content */}
      <div className="flex items-center gap-2 mb-1.5 relative">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase font-mono border shrink-0 ${
            BADGE[event.event] ?? BADGE.unknown
          }`}
        >
          <span className="mr-1">{ICONS[event.event]}</span>
          {event.event}
        </span>
        <span className="text-[11px] text-gray-200 font-mono font-semibold truncate flex-1">
          {event.process}
        </span>
        <span className="text-[9px] text-gray-600 font-mono shrink-0">
          {event.datetime?.slice(11, 19) ?? ''}
        </span>
      </div>

      {/* Event details */}
      <div className="text-[10px] text-gray-500 font-mono truncate pl-1">
        {event.target ?? event.filename ?? `pid:${event.pid}`}
      </div>

      {/* Left border accent */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}
