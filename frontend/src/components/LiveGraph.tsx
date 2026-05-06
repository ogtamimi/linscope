import { useEffect, useRef, useCallback } from 'react'
import type { LinEvent } from '../types/events'

const COLORS: Record<string, string> = {
  exec: '#3fb950',
  connect: '#58a6ff',
  exit: '#f85149',
  fork: '#d29922',
  unknown: '#8b949e',
}

interface Node {
  id: string; x: number; y: number; vx: number; vy: number
  proc: string; type: string; color: string; r: number
  alpha: number; age: number; maxAge: number
}

interface Edge {
  from: Node; to: Node; alpha: number; age: number; maxAge: number
}

export function LiveGraph({ events }: { events: LinEvent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  const lastCount = useRef(0)
  const animRef = useRef<number>(0)

  const spawnNode = useCallback((event: LinEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = canvas.width, H = canvas.height
    const angle = Math.random() * Math.PI * 2
    const r = 80 + Math.random() * Math.min(W, H) * 0.25
    const node: Node = {
      id: event.id,
      x: W / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 60,
      y: H / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 60,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      proc: event.process,
      type: event.event,
      color: COLORS[event.event] ?? COLORS.unknown,
      r: event.event === 'exec' ? 10 : event.event === 'connect' ? 8 : 6,
      alpha: 0, age: 0,
      maxAge: 200 + Math.floor(Math.random() * 300),
    }
    const nodes = nodesRef.current
    if (nodes.length > 1) {
      const parent = nodes[Math.floor(Math.random() * Math.min(nodes.length, 8))]
      edgesRef.current.push({ from: parent, to: node, alpha: 1, age: 0, maxAge: node.maxAge })
    }
    nodes.push(node)
    if (nodes.length > 80) nodes.splice(0, nodes.length - 80)
    if (edgesRef.current.length > 120) edgesRef.current.splice(0, edgesRef.current.length - 120)
  }, [])

  useEffect(() => {
    const newEvents = events.slice(lastCount.current)
    lastCount.current = events.length
    newEvents.slice(-10).forEach(spawnNode)
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
      ctx.clearRect(0, 0, W, H)

      ctx.strokeStyle = 'rgba(48,54,61,0.25)'
      ctx.lineWidth = 0.5
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }

      const edges = edgesRef.current
      for (let i = edges.length - 1; i >= 0; i--) {
        const e = edges[i]
        e.age++
        e.alpha = Math.max(0, 1 - e.age / e.maxAge)
        if (e.alpha <= 0) { edges.splice(i, 1); continue }
        ctx.beginPath()
        ctx.moveTo(e.from.x, e.from.y)
        ctx.lineTo(e.to.x, e.to.y)
        ctx.strokeStyle = `rgba(88,166,255,${e.alpha * 0.25})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      const nodes = nodesRef.current
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i]
        n.age++
        n.alpha = n.age < 15
          ? n.age / 15
          : Math.max(0, 1 - (n.age - 15) / (n.maxAge - 15))
        if (n.alpha <= 0) { nodes.splice(i, 1); continue }
        n.x += n.vx; n.y += n.vy
        n.vx *= 0.99; n.vy *= 0.99

        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3.5)
        g.addColorStop(0, n.color + Math.round(n.alpha * 60).toString(16).padStart(2, '0'))
        g.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r * 3.5, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()

        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = n.color + Math.round(n.alpha * 255).toString(16).padStart(2, '0')
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'
        ctx.lineWidth = 0.5
        ctx.stroke()

        if (n.alpha > 0.35) {
          ctx.font = '9px monospace'
          ctx.fillStyle = `rgba(230,237,243,${n.alpha * 0.75})`
          ctx.textAlign = 'center'
          ctx.fillText(n.proc.slice(0, 12), n.x, n.y + n.r + 12)
        }
      }

      ctx.strokeStyle = 'rgba(88,166,255,0.1)'
      ctx.lineWidth = 0.5
      ctx.setLineDash([3, 8])
      ctx.beginPath(); ctx.moveTo(W/2-16, H/2); ctx.lineTo(W/2+16, H/2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(W/2, H/2-16); ctx.lineTo(W/2, H/2+16); ctx.stroke()
      ctx.setLineDash([])

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect() }
  }, [])

  return <canvas ref={canvasRef} className="w-full h-full" />
}
