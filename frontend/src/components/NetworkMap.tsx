import { useEffect, useRef, useState } from 'react'
import type { LinEvent } from '../types/events'

interface Connection {
  src: string
  dst: string
  count: number
  lastSeen: number
}

export function NetworkMap({ events }: { events: LinEvent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [connections, setConnections] = useState<Connection[]>([])

  useEffect(() => {
    const map = new Map<string, Connection>()
    events.forEach(e => {
      if (e.event === 'connect' && e.source_ip && e.dest_ip) {
        const key = `${e.source_ip}->${e.dest_ip}`
        const existing = map.get(key)
        if (existing) {
          existing.count++
          existing.lastSeen = Date.now()
        } else {
          map.set(key, {
            src: e.source_ip || 'local',
            dst: e.dest_ip || 'unknown',
            count: 1,
            lastSeen: Date.now()
          })
        }
      }
    })
    setConnections(Array.from(map.values()).slice(-100))
  }, [events])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    
    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800
      canvas.height = canvas.parentElement?.clientHeight || 600
    }
    resize()
    
    const draw = () => {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      
      // Draw connections
      connections.forEach((conn, i) => {
        const angle = (i / connections.length) * Math.PI * 2
        const radius = Math.min(W, H) * 0.3
        const x1 = W/2 + Math.cos(angle) * radius
        const y1 = H/2 + Math.sin(angle) * radius
        const x2 = W/2 + Math.cos(angle + 0.5) * radius * 0.8
        const y2 = H/2 + Math.sin(angle + 0.5) * radius * 0.8
        
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = `rgba(88,166,255,${Math.min(0.5, conn.count / 20)})`
        ctx.lineWidth = Math.min(3, conn.count / 5)
        ctx.stroke()
        
        // Label
        ctx.font = '8px monospace'
        ctx.fillStyle = 'rgba(150,150,170,0.7)'
        ctx.fillText(conn.dst, x2, y2 - 5)
      })
      
      // Center hub
      ctx.beginPath()
      ctx.arc(W/2, H/2, 40, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(88,166,255,0.15)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(W/2, H/2, 20, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(88,166,255,0.3)'
      ctx.fill()
      ctx.fillStyle = 'white'
      ctx.font = 'bold 12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`${connections.length} connections`, W/2, H/2 + 30)
      
      requestAnimationFrame(draw)
    }
    
    draw()
  }, [connections])
  
  return (
    <div className="w-full h-full relative bg-gradient-to-br from-gray-900 to-black">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-4 text-[10px] text-gray-600 font-mono">
        🌐 {connections.length} active connections
      </div>
    </div>
  )
}
