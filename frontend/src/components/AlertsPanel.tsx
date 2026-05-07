import React, { useEffect, useState } from 'react'

interface Alert {
  id: string
  timestamp: number
  datetime: string
  rule_name: string
  severity: string
  title: string
  description: string
  affected_pids: number[]
  score: number
  mitre_technique?: string
}

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8000/ws/alerts')
    socket.onopen = () => {
      setConnected(true)
      console.log('Alerts WebSocket connected')
    }
    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data)
      if (data.type === 'alert') {
        setAlerts(prev => [data.data, ...prev].slice(0, 200))
      }
    }
    socket.onclose = () => setConnected(false)
    setWs(socket)
    return () => socket.close()
  }, [])

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case 'critical': return 'bg-red-600/80 text-white border-red-400'
      case 'high': return 'bg-orange-600/80 text-white border-orange-400'
      case 'medium': return 'bg-yellow-600/80 text-white border-yellow-400'
      default: return 'bg-blue-600/80 text-white border-blue-400'
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0c10]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-300">⚠️ ALERTS</span>
          <span className="text-[10px] text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded">{alerts.length}</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600">
            <div className="text-3xl mb-2">🛡️</div>
            <div className="text-xs">No alerts yet</div>
          </div>
        )}
        {alerts.map((alert) => (
          <div key={alert.id} className={`p-3 rounded-lg border-l-4 ${getSeverityColor(alert.severity)} bg-gray-900/50`}>
            <div className="flex justify-between items-start">
              <div className="text-xs font-bold text-white">{alert.title}</div>
              <div className="text-[9px] text-gray-400 font-mono">{alert.datetime?.slice(11, 19)}</div>
            </div>
            <div className="text-[10px] text-gray-300 mt-1">{alert.description}</div>
            <div className="flex gap-2 mt-2 text-[9px] text-gray-500 font-mono">
              <span>Rule: {alert.rule_name}</span>
              <span>Score: {alert.score}</span>
              {alert.mitre_technique && <span>MITRE: {alert.mitre_technique}</span>}
              {alert.affected_pids.length > 0 && <span>PIDs: {alert.affected_pids.join(',')}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
