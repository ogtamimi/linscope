import { useMemo } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import { LiveGraph } from './components/LiveGraph'
import { EventFeed } from './components/EventFeed'
import { TopBar } from './components/TopBar'

const NAV = ['Live Graph','Network Map','Timeline','Incidents','AI Analyst','Settings']

export default function App() {
  const { events, connected, eps } = useWebSocket()
  const procCount = useMemo(() => events.filter(e => e.event === 'exec').length, [events])
  const netCount = useMemo(() => events.filter(e => e.event === 'connect').length, [events])

  return (
    <div className="flex h-screen w-screen bg-[#0d1117] text-gray-300 font-mono overflow-hidden">
      <div className="w-52 bg-[#161b22] border-r border-gray-800 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-800">
          <div className="text-blue-400 font-bold tracking-widest text-sm">🔭 LINSCOPE</div>
          <div className="text-[10px] text-gray-600 mt-0.5">v0.1.0 — behavioral observability</div>
        </div>
        <nav className="flex-1 py-2">
          {NAV.map((item, i) => (
            <div
              key={item}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-[11px] cursor-pointer transition-colors border-l-2 ${
                i === 0
                  ? 'text-blue-400 bg-gray-900/60 border-blue-400'
                  : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-gray-900/40'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-blue-400' : 'bg-gray-700'}`} />
              {item}
            </div>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-800 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[10px] text-gray-500">
            {connected ? 'eBPF collector active' : 'collector offline'}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar procCount={procCount} netCount={netCount} eps={eps} connected={connected} />
        <div className="flex-1 relative overflow-hidden">
          <LiveGraph events={events} />
        </div>
      </div>

      <div className="w-72 bg-[#161b22] border-l border-gray-800 flex flex-col shrink-0">
        <EventFeed events={events} />
      </div>
    </div>
  )
}
