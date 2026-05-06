import { useRef, useEffect } from 'react'
import type { LinEvent } from '../types/events'

export function Timeline({ events }: { events: LinEvent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastEvents = events.slice(-200)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    
    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800
      canvas.height = canvas.parentElement?.clientHeight || 400
    }
    resize()
    
    const draw = () => {
      const W = canvas.width, H = canvas.height
      ctx.clearRect(0, 0, W, H)
      
      // Background
      ctx.fillStyle = 'rgba(13,17,23,0.8)'
      ctx.fillRect(0, 0, W, H)
      
      // Grid
      ctx.strokeStyle = 'rgba(48,54,61,0.3)'
      ctx.lineWidth = 0.5
      for (let i = 0; i < 10; i++) {
        ctx.beginPath()
        ctx.moveTo(0, i * H/10)
        ctx.lineTo(W, i * H/10)
        ctx.stroke()
      }
      
      // Draw events
      const step = W / Math.max(1, lastEvents.length)
      lastEvents.forEach((e, i) => {
        const x = i * step
        const yMap: Record<string, number> = {
          exec: H * 0.3,
          connect: H * 0.5,
          exit: H * 0.7,
          fork: H * 0.9
        }
        const y = yMap[e.event] || H * 0.5
        const colors: Record<string, string> = {
          exec: '#3fb950',
          connect: '#58a6ff',
          exit: '#f85149',
          fork: '#d29922'
        }
        
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fillStyle = colors[e.event] || '#8b949e'
        ctx.fill()
        
        if (i > 0) {
          ctx.beginPath()
          ctx.moveTo((i-1) * step, lastEvents[i-1]?.event === 'exec' ? H * 0.3 : H * 0.5)
          ctx.lineTo(x, y)
          ctx.strokeStyle = 'rgba(88,166,255,0.2)'
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      })
      
      requestAnimationFrame(draw)
    }
    
    draw()
  }, [lastEvents])
  
  return (
    <div className="w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}
