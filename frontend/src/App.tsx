import { useMemo, useState } from 'react'
import { useWebSocketAdaptive } from './hooks/useWebSocketAdaptive'
import { LiveGraph } from './components/LiveGraph'
import { VirtualEventFeed } from './components/VirtualEventFeed'
import { TopBar } from './components/TopBar'
import { TimelineView } from './components/TimelineView'
import { ReplayView } from './components/ReplayView'
import { AlertsPanel } from './components/AlertsPanel'
import { AIAnalyst } from './components/AIAnalyst'

const NAV_ITEMS = [
  { id: 'graph', name: 'Live Graph', icon: '🔭' },
  { id: 'timeline', name: 'Timeline', icon: '📅' },
  { id: 'replay', name: 'Replay', icon: '⏪' },
  { id: 'alerts', name: 'Alerts', icon: '⚠️' },
  { id: 'ai', name: 'AI Analyst', icon: '🤖' },
]

export default function App() {
  const { events, connected, eps } = useWebSocketAdaptive()
  const [activeView, setActiveView] = useState('graph')
  const [quality, setQuality] = useState('high')
  
  const procCount = useMemo(() => events.filter(e => e.event === 'exec').length, [events])
  const netCount = useMemo(() => events.filter(e => e.event === 'connect').length, [events])

  const renderView = () => {
    switch(activeView) {
      case 'graph':
        return <LiveGraph events={events} />
      case 'timeline':
        return <TimelineView events={events} />
      case 'replay':
        return <ReplayView />
      case 'alerts':
      case 'ai':
        return <AIAnalyst />
        return <AlertsPanel />
      default:
        return <LiveGraph events={events} />
    }
  }

  return (
    <div className="flex h-screen w-screen bg-[#0a0c10] text-gray-300 font-mono overflow-hidden">
      <div className="w-64 bg-[#0d1117]/80 backdrop-blur-xl border-r border-white/5 flex flex-col shrink-0">
        <div className="px-5 py-6 border-b border-white/5">
          <div className="text-white font-bold">🔭 LINSCOPE</div>
          <div className="text-[9px] text-gray-500">phase 3 + perf</div>
        </div>
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-3 text-xs ${
                activeView === item.id ? 'text-blue-400 bg-blue-500/10' : 'text-gray-500 hover:bg-white/5'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/5">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <div className="text-[9px] text-gray-600 mt-2">v0.3.0</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar 
          procCount={procCount} 
          netCount={netCount} 
          eps={eps} 
          connected={connected}
          quality={quality}
          onQualityChange={setQuality}
        />
        <div className="flex-1 relative overflow-hidden">
          {renderView()}
        </div>
      </div>

      <div className="w-80 bg-[#0d1117]/80 backdrop-blur-xl border-l border-white/5 flex flex-col shrink-0">
        <VirtualEventFeed events={events} />
      </div>
    </div>
  )
}
