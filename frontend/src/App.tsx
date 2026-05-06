import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useWebSocket } from './hooks/useWebSocketOptimized'
import { LiveGraph } from './components/LiveGraphOptimized'
import { VirtualEventFeed } from './components/VirtualEventFeed'
import { PerformanceMonitor } from './components/PerformanceMonitor'
import { TopBar } from './components/TopBar'
import { NetworkMap } from './components/NetworkMap'
import { Timeline } from './components/Timeline'

const NAV_ITEMS = [
  { id: 'graph', name: 'Live Graph', icon: '🔭' },
  { id: 'network', name: 'Network Map', icon: '🌐' },
  { id: 'timeline', name: 'Timeline', icon: '📅' },
  { id: 'incidents', name: 'Incidents', icon: '⚠️' },
  { id: 'ai', name: 'AI Analyst', icon: '🤖' },
  { id: 'settings', name: 'Settings', icon: '⚙️' }
]

export default function App() {
  const { events, connected, eps, droppedEvents, eventQueueSize } = useWebSocket()
  const [activeView, setActiveView] = useState('graph')
  const [showPerformance, setShowPerformance] = useState(false)
  const [graphMetrics, setGraphMetrics] = useState({
    fps: 60,
    nodesCount: 0,
    renderTime: 0,
    memoryUsage: 0
  })

  // Listen for graph metrics from LiveGraph component
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail) {
        setGraphMetrics(e.detail)
      }
    }
    window.addEventListener('graphMetrics', handler)
    return () => window.removeEventListener('graphMetrics', handler)
  }, [])
  
  const procCount = useMemo(() => 
    events.filter(e => e.event === 'exec').length, 
    [events]
  )
  const netCount = useMemo(() => 
    events.filter(e => e.event === 'connect').length, 
    [events]
  )

  const renderView = () => {
    switch(activeView) {
      case 'graph':
        return <LiveGraph events={events} />
      case 'network':
        return <NetworkMap events={events} />
      case 'timeline':
        return <Timeline events={events} />
      default:
        return <LiveGraph events={events} />
    }
  }

  return (
    <div className="flex h-screen w-screen bg-gradient-to-br from-[#0a0c10] via-[#0d1117] to-[#0a0c10] text-gray-300 font-mono overflow-hidden">
      {/* Sidebar - Glass morphism */}
      <div className="w-64 bg-[#0d1117]/80 backdrop-blur-xl border-r border-white/5 flex flex-col shrink-0 shadow-2xl">
        <div className="px-5 py-6 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/25">
              <span className="text-white text-sm">🔭</span>
            </div>
            <div>
              <div className="text-white font-bold tracking-wider text-base">LINSCOPE</div>
              <div className="text-[9px] text-gray-500 mt-0.5">behavioral observability</div>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-3 text-xs transition-all duration-200 border-l-2 ${
                activeView === item.id
                  ? 'text-blue-400 bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/10'
                  : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
              {activeView === item.id && (
                <span className="ml-auto w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/5 space-y-3">
          {/* Connection status */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' : 'bg-red-500'}`} />
            <span className="text-[10px] text-gray-500">
              {connected ? 'eBPF collector active' : 'collector offline'}
            </span>
          </div>

          {/* Event queue status */}
          <div className="space-y-1">
            <div className="text-[9px] text-gray-600">Queue: {eventQueueSize}/1000</div>
            <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(100, (eventQueueSize / 1000) * 100)}%` }}
              />
            </div>
          </div>

          {/* Performance toggle */}
          <button
            onClick={() => setShowPerformance(!showPerformance)}
            className={`w-full px-2 py-1.5 rounded text-[9px] font-bold transition-colors ${
              showPerformance
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                : 'bg-gray-700/30 text-gray-400 border border-gray-600/30 hover:bg-gray-700/50'
            }`}
          >
            {showPerformance ? '📊 METRICS ON' : '📊 METRICS OFF'}
          </button>

          <div className="text-[9px] text-gray-600 mt-2 font-mono">
            v0.2.0 — optimized
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar procCount={procCount} netCount={netCount} eps={eps} connected={connected} />
        
        {/* Performance dashboard */}
        {showPerformance && (
          <div className="px-4 py-3 border-b border-white/5 bg-[#0d1117]/50 overflow-x-auto">
            <PerformanceMonitor
              fps={graphMetrics.fps}
              eventRate={eps}
              renderTime={graphMetrics.renderTime}
              memoryUsage={graphMetrics.memoryUsage}
              nodesCount={graphMetrics.nodesCount}
              droppedEvents={droppedEvents}
              maxMemory={200}
            />
          </div>
        )}

        {/* Main view */}
        <div className="flex-1 relative overflow-hidden">
          {renderView()}
        </div>
      </div>

      {/* Event Feed - Glass morphism with virtual scrolling */}
      <div className="w-80 bg-[#0d1117]/80 backdrop-blur-xl border-l border-white/5 flex flex-col shrink-0">
        <VirtualEventFeed events={events} droppedEvents={droppedEvents} />
      </div>
    </div>
  )
}
