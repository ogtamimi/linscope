import type { LinEvent } from '../types/events'

const BADGE: Record<string, string> = {
  exec:    'bg-green-900/60 text-green-400',
  connect: 'bg-blue-900/60 text-blue-400',
  exit:    'bg-red-900/60 text-red-400',
  fork:    'bg-yellow-900/60 text-yellow-400',
  unknown: 'bg-gray-800 text-gray-400',
}

export function EventFeed({ events }: { events: LinEvent[] }) {
  const reversed = [...events].reverse().slice(0, 100)
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
        <span className="text-xs text-gray-400 font-mono">LIVE EVENTS</span>
        <span className="text-xs text-blue-400 font-mono font-bold">{events.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {reversed.map((e) => (
          <div key={e.id} className="px-4 py-2 border-b border-gray-900 hover:bg-gray-900/50 cursor-pointer transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase font-mono ${BADGE[e.event] ?? BADGE.unknown}`}>
                {e.event}
              </span>
              <span className="text-[11px] text-gray-200 font-mono font-semibold truncate flex-1">
                {e.process}
              </span>
              <span className="text-[9px] text-gray-600 font-mono shrink-0">
                {e.datetime?.slice(11, 19) ?? ''}
              </span>
            </div>
            <div className="text-[10px] text-gray-500 font-mono truncate">
              {e.target ?? e.filename ?? `pid:${e.pid}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
