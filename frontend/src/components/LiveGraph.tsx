import { useEffect, useRef, useCallback, useMemo } from 'react'
import type { LinEvent } from '../types/events'

const COLORS: Record<string, string> = {
  exec: '#3fb950',
  connect: '#58a6ff',
  exit: '#f85149',
  fork: '#d29922',
  unknown: '#8b949e'
}

interface Node {
  id: string
  x: number; y: number
  vx: number; vy: number
  proc: string
  color: string
  r: number
  alpha: number
  age: number
  maxAge: number
}

interface Edge {
  from: Node; to: Node
  alpha: number; age: number; maxAge: number
}

export function LiveGraph({ events }: { events: LinEvent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  const lastCount = useRef(0)
  const animRef = useRef<number>(0)
  const frameRef = useRef(0)

  const spawnNode = useCallback((event: LinEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = canvas.width, H = canvas.height
    const angle = Math.random() * Math.PI * 2
    const r = 100 + Math.random() * Math.min(W, H) * 0.3
    
    const node: Node = {
      id: event.id,
      x: W / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 80,
      y: H / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      proc: event.process.slice(0, 12),
      color: COLORS[event.event] ?? COLORS.unknown,
      r: event.event === 'exec' ? 12 : event.event === 'connect' ? 10 : 8,
      alpha: 0,
      age: 0,
      maxAge: 250 + Math.floor(Math.random() * 200)
    }
    
    const nodes = nodesRef.current
    if (nodes.length > 0) {
      const parent = nodes[Math.floor(Math.random() * Math.min(nodes.length, 6))]
      edgesRef.current.push({ from: parent, to: node, alpha: 1, age: 0, maxAge: node.maxAge })
    }
    nodes.push(node)
    
    if (nodes.length > 150) nodes.splice(0, nodes.length - 150)
    if (edgesRef.current.length > 200) edgesRef.current.splice(0, edgesRef.current.length - 200)
  }, [])

  useEffect(() => {
    const newEvents = events.slice(lastCount.current)
    lastCount.current = events.length
    if (newEvents.length > 30) {
      newEvents.slice(-30).forEach(spawnNode)
    } else {
      newEvents.forEach(spawnNode)
    }
  }, [events, spawnNode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      const area = canvas.parentElement!
      canvas.width = area.clientWidth
      canvas.height = area.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement!)

    const draw = () => {
      const W = canvas.width, H = canvas.height
      if (W === 0 || H === 0) {
        animRef.current = requestAnimationFrame(draw)
        return
      }
      
      ctx.clearRect(0, 0, W, H)
      
      // Animated grid
      frameRef.current++
      ctx.strokeStyle = `rgba(48,54,61,${0.15 + Math.sin(frameRef.current * 0.01) * 0.05})`
      ctx.lineWidth = 0.5
      for (let x = (frameRef.current % 40) - 40; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = (frameRef.current % 40) - 40; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }
      
      // Draw edges
      const edges = edgesRef.current
      for (let i = edges.length - 1; i >= 0; i--) {
        const e = edges[i]
        e.age++
        e.alpha = Math.max(0, 1 - e.age / e.maxAge)
        if (e.alpha <= 0.02) { edges.splice(i, 1); continue }
        
        ctx.beginPath()
        ctx.moveTo(e.from.x, e.from.y)
        ctx.lineTo(e.to.x, e.to.y)
        
        const gradient = ctx.createLinearGradient(e.from.x, e.from.y, e.to.x, e.to.y)
        gradient.addColorStop(0, `rgba(88,166,255,${e.alpha * 0.4})`)
        gradient.addColorStop(1, `rgba(88,166,255,${e.alpha * 0.1})`)
        ctx.strokeStyle = gradient
        ctx.lineWidth = 1.5
        ctx.stroke()
        
        // Particle effect on edge
        if (Math.random() < 0.05) {
          ctx.beginPath()
          ctx.arc(e.to.x, e.to.y, 2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(88,166,255,${e.alpha * 0.8})`
          ctx.fill()
        }
      }
      
      // Draw nodes
      const nodes = nodesRef.current
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]
        n.age++
        n.alpha = n.age < 20 ? n.age / 20 : Math.max(0, 1 - (n.age - 20) / (n.maxAge - 20))
        if (n.alpha <= 0.02) { nodes.splice(i, 1); continue }
        
        n.x += n.vx
        n.y += n.vy
        n.vx *= 0.99
        n.vy *= 0.99
        
        // Bounce off edges
        if (n.x < n.r) { n.x = n.r; n.vx *= -0.8 }
        if (n.x > W - n.r) { n.x = W - n.r; n.vx *= -0.8 }
        if (n.y < n.r) { n.y = n.r; n.vy *= -0.8 }
        if (n.y > H - n.r) { n.y = H - n.r; n.vy *= -0.8 }
        
        // Glow effect
        const gradient = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4)
        gradient.addColorStop(0, n.color + Math.round(n.alpha * 80).toString(16).padStart(2, '0'))
        gradient.addColorStop(0.5, n.color + Math.round(n.alpha * 20).toString(16).padStart(2, '0'))
        gradient.addColorStop(1, 'transparent')
        
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
        
        // Core circle
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = n.color + Math.round(n.alpha * 200).toString(16).padStart(2, '0')
        ctx.fill()
        
        // Inner highlight
        ctx.beginPath()
        ctx.arc(n.x - n.r * 0.3, n.y - n.r * 0.3, n.r * 0.3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${n.alpha * 0.3})`
        ctx.fill()
        
        ctx.strokeStyle = `rgba(255,255,255,${n.alpha * 0.15})`
        ctx.lineWidth = 1
        ctx.stroke()
        
        // Label
        if (n.alpha > 0.4) {
          ctx.font = `bold ${9 + Math.floor(n.alpha * 3)}px monospace`
          ctx.fillStyle = `rgba(230,237,243,${n.alpha * 0.9})`
          ctx.textAlign = 'center'
          ctx.shadowBlur = 4
          ctx.shadowColor = n.color
          ctx.fillText(n.proc, n.x, n.y + n.r + 14)
          ctx.shadowBlur = 0
        }
      }
      
      // Center pulse
      const pulse = 0.5 + Math.sin(frameRef.current * 0.05) * 0.3
      ctx.beginPath()
      ctx.arc(W/2, H/2, 30 + 10 * pulse, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(88,166,255,${0.1 + pulse * 0.05})`
      ctx.lineWidth = 1
      ctx.stroke()
      
      ctx.beginPath()
      ctx.arc(W/2, H/2, 2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(88,166,255,${0.3 + pulse * 0.2})`
      ctx.fill()
      
      animRef.current = requestAnimationFrame(draw)
    }
    
    draw()
    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
    }
  }, [])
  
  return <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" />
}
