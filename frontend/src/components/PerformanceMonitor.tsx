import { useEffect, useState, useRef } from 'react'

interface PerformanceData {
  fps: number
  eventRate: number
  renderTime: number
  memoryUsage: number
  nodesCount: number
  droppedEvents: number
}

interface PerformanceMonitorProps {
  fps?: number
  eventRate?: number
  renderTime?: number
  memoryUsage?: number
  nodesCount?: number
  droppedEvents?: number
  maxMemory?: number
}

export function PerformanceMonitor({
  fps = 0,
  eventRate = 0,
  renderTime = 0,
  memoryUsage = 0,
  nodesCount = 0,
  droppedEvents = 0,
  maxMemory = 200
}: PerformanceMonitorProps) {
  const [history, setHistory] = useState<PerformanceData[]>([])
  const historyRef = useRef<PerformanceData[]>([])
  const maxHistoryLength = 60 // Keep last 60 samples

  useEffect(() => {
    const newData: PerformanceData = {
      fps,
      eventRate,
      renderTime,
      memoryUsage,
      nodesCount,
      droppedEvents
    }

    historyRef.current.push(newData)
    if (historyRef.current.length > maxHistoryLength) {
      historyRef.current.shift()
    }
    setHistory([...historyRef.current])
  }, [fps, eventRate, renderTime, memoryUsage, nodesCount, droppedEvents])

  const avgFps = history.length > 0
    ? Math.round(history.reduce((a, b) => a + b.fps, 0) / history.length)
    : 0

  const avgEventRate = history.length > 0
    ? Math.round(history.reduce((a, b) => a + b.eventRate, 0) / history.length)
    : 0

  const memoryStatus =
    memoryUsage > maxMemory * 0.9 ? 'critical' :
    memoryUsage > maxMemory * 0.7 ? 'warning' :
    'normal'

  const fpsStatus =
    fps >= 50 ? 'excellent' :
    fps >= 30 ? 'good' :
    fps >= 15 ? 'fair' :
    'poor'

  const statusColors = {
    critical: 'text-red-400',
    warning: 'text-orange-400',
    normal: 'text-green-400',
    excellent: 'text-green-400',
    good: 'text-blue-400',
    fair: 'text-yellow-400',
    poor: 'text-red-400'
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {/* FPS Card */}
      <div className="bg-[#161b22] border border-white/10 rounded-lg p-3">
        <div className="text-[9px] text-gray-500 font-mono uppercase tracking-wider mb-1">
          FPS
        </div>
        <div className={`text-2xl font-bold font-mono ${statusColors[fpsStatus]}`}>
          {fps}
        </div>
        <div className="text-[8px] text-gray-600 mt-1">
          Avg: {avgFps}
        </div>
        <PerformanceBar value={fps} max={60} />
      </div>

      {/* Event Rate Card */}
      <div className="bg-[#161b22] border border-white/10 rounded-lg p-3">
        <div className="text-[9px] text-gray-500 font-mono uppercase tracking-wider mb-1">
          Events/sec
        </div>
        <div className="text-2xl font-bold font-mono text-blue-400">
          {eventRate}
        </div>
        <div className="text-[8px] text-gray-600 mt-1">
          Avg: {avgEventRate}
        </div>
        <PerformanceBar value={eventRate} max={1000} />
      </div>

      {/* Memory Usage Card */}
      <div className="bg-[#161b22] border border-white/10 rounded-lg p-3">
        <div className="text-[9px] text-gray-500 font-mono uppercase tracking-wider mb-1">
          Memory
        </div>
        <div className={`text-2xl font-bold font-mono ${statusColors[memoryStatus]}`}>
          {memoryUsage}MB
        </div>
        <div className="text-[8px] text-gray-600 mt-1">
          Max: {maxMemory}MB
        </div>
        <PerformanceBar value={memoryUsage} max={maxMemory} />
      </div>

      {/* Render Time Card */}
      <div className="bg-[#161b22] border border-white/10 rounded-lg p-3">
        <div className="text-[9px] text-gray-500 font-mono uppercase tracking-wider mb-1">
          Render Time
        </div>
        <div className="text-2xl font-bold font-mono text-purple-400">
          {renderTime.toFixed(1)}ms
        </div>
        <div className="text-[8px] text-gray-600 mt-1">
          {renderTime > 16.67 ? '⚠️ Dropping' : '✓ Stable'}
        </div>
        <PerformanceBar value={Math.min(renderTime, 33.33)} max={33.33} />
      </div>

      {/* Nodes Count Card */}
      <div className="bg-[#161b22] border border-white/10 rounded-lg p-3">
        <div className="text-[9px] text-gray-500 font-mono uppercase tracking-wider mb-1">
          Active Nodes
        </div>
        <div className="text-2xl font-bold font-mono text-cyan-400">
          {nodesCount}
        </div>
        <div className="text-[8px] text-gray-600 mt-1">
          Max: 50
        </div>
        <PerformanceBar value={nodesCount} max={50} />
      </div>

      {/* Dropped Events Card */}
      {droppedEvents > 0 && (
        <div className="bg-[#161b22] border border-white/10 rounded-lg p-3">
          <div className="text-[9px] text-gray-500 font-mono uppercase tracking-wider mb-1">
            Dropped
          </div>
          <div className="text-2xl font-bold font-mono text-red-400">
            {droppedEvents}
          </div>
          <div className="text-[8px] text-gray-600 mt-1">
            Overflow events
          </div>
        </div>
      )}
    </div>
  )
}

interface PerformanceBarProps {
  value: number
  max: number
}

function PerformanceBar({ value, max }: PerformanceBarProps) {
  const percentage = Math.min(100, (value / max) * 100)
  const getColor = () => {
    if (percentage >= 80) return 'bg-red-500/50'
    if (percentage >= 60) return 'bg-yellow-500/50'
    return 'bg-green-500/50'
  }

  return (
    <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden mt-2">
      <div
        className={`h-full transition-all duration-300 ${getColor()}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
