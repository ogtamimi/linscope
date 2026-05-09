import React, { useEffect, useRef, useCallback, useState } from 'react'
import type { LinEvent } from '../types'

const COLORS = {
  exec: '#00ff88',
  connect: '#00f0ff',
  exit: '#ff0044',
  fork: '#ffb800',
  unknown: '#64748b',
}
const MAX_NODES = 35
const MAX_EDGES = 50
const QUALITY_LEVELS = { high: 1, medium: 0.7, low: 0.4 }

interface LiveGraphProps {
  events?: LinEvent[]
}

interface Node {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  label: string
  color: string
  size: number
  alpha: number
  age: number
  maxAge: number
}

interface Edge {
  fromId: string
  toId: string
  alpha: number
}

export function LiveGraph({ events = [] }: LiveGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('high')
  const [perfMode, setPerfMode] = useState(false)
  const [fps, setFps] = useState(60)
  const frameCountRef = useRef(0)
  const lastFpsCheck = useRef(performance.now())
  const lastEventCount = useRef(0)
  
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  const anomalyScoresRef = useRef<Record<string, number>>({})
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    // Vite handles this URL pattern for workers
    workerRef.current = new Worker(new URL('../workers/anomalyDetection.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e) => {
      if (e.data.type === 'scores') {
        anomalyScoresRef.current = e.data.data;
      }
    };

    return () => workerRef.current?.terminate();
  }, []);

  const spawnNode = useCallback((event: LinEvent, width: number, height: number) => {
    const angle = Math.random() * Math.PI * 2
    const radius = 50 + Math.random() * 100
    
    const newNode: Node = {
      id: event.pid?.toString() || event.id || Math.random().toString(),
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius,
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      label: event.process || 'unknown',
      color: COLORS[event.event as keyof typeof COLORS] || COLORS.unknown,
      size: event.event === 'exec' ? 8 : 5,
      alpha: 1,
      age: 0,
      maxAge: 200 + Math.random() * 100
    }

    if (nodesRef.current.length > 0) {
      const parent = nodesRef.current.find(n => n.id === event.ppid?.toString()) || 
                     nodesRef.current[Math.floor(Math.random() * Math.min(nodesRef.current.length, 5))]
      edgesRef.current.push({
        fromId: parent.id,
        toId: newNode.id,
        alpha: 0.5
      })
    }

    nodesRef.current.push(newNode)
    if (nodesRef.current.length > MAX_NODES) nodesRef.current.shift()
    if (edgesRef.current.length > MAX_EDGES) edgesRef.current.shift()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        canvas.width = width * dpr
        canvas.height = height * dpr
      }
    })
    resizeObserver.observe(canvas.parentElement || canvas)

    const animate = (time: number) => {
      frameCountRef.current++
      
      const W = canvas.width / dpr
      const H = canvas.height / dpr
      
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#12151F'
      ctx.fillRect(0, 0, W, H)
      
      // Update Physics
      nodesRef.current.forEach(node => {
        const dx = W / 2 - node.x
        const dy = H / 2 - node.y
        node.vx += dx * 0.0001
        node.vy += dy * 0.0001
        
        node.x += node.vx
        node.y += node.vy
        node.vx *= 0.98
        node.vy *= 0.98
        
        node.age++
        if (node.age > node.maxAge) {
           node.alpha *= 0.95
        }
      })
      
      // Filter edges
      const nodeIds = new Set(nodesRef.current.map(n => n.id))
      edgesRef.current = edgesRef.current.filter(e => nodeIds.has(e.fromId) && nodeIds.has(e.toId))

      // Draw Edges
      edgesRef.current.forEach(edge => {
        const from = nodesRef.current.find(n => n.id === edge.fromId)
        const to = nodesRef.current.find(n => n.id === edge.toId)
        if (from && to) {
          const fromScore = anomalyScoresRef.current[from.id] || 0;
          const toScore = anomalyScoresRef.current[to.id] || 0;
          const maxScore = Math.max(fromScore, toScore);
          
          const isSuspicious = maxScore > 70;
          
          ctx.beginPath()
          if (isSuspicious) {
            ctx.setLineDash([5, 5]);
            ctx.lineDashOffset = -time / 50;
            ctx.lineWidth = 2;
            ctx.strokeStyle = `rgba(239, 68, 68, ${edge.alpha * from.alpha * to.alpha * 0.6})`;
          } else {
            ctx.setLineDash([]);
            ctx.lineWidth = 1;
            ctx.strokeStyle = `rgba(255, 255, 255, ${edge.alpha * from.alpha * to.alpha * 0.1})`;
          }
          
          ctx.moveTo(from.x, from.y)
          ctx.lineTo(to.x, to.y)
          ctx.stroke()
        }
      })
      ctx.setLineDash([]);

      // Draw Nodes
      nodesRef.current.forEach(node => {
        if (node.alpha < 0.01) return
        
        const score = anomalyScoresRef.current[node.id] || 0;
        let color = node.color;
        
        if (score > 70) color = '#ef4444'; // Red
        else if (score > 30) color = '#eab308'; // Yellow
        else color = '#22c55e'; // Green (override base color for consistency with anomaly view)
        
        // Pulsing glow for red nodes
        if (score > 70) {
          const pulse = (Math.sin(time / 200) + 1) / 2;
          ctx.shadowBlur = 15 * pulse;
          ctx.shadowColor = '#ef4444';
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = color
        ctx.globalAlpha = node.alpha
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.size + (score > 70 ? 2 : 0), 0, Math.PI * 2)
        ctx.fill()
        
        if (node.alpha > 0.5) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
          ctx.font = '10px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(`${node.label} [${Math.round(score)}]`, node.x, node.y + node.size + 15)
        }
        ctx.shadowBlur = 0;
      })
      ctx.globalAlpha = 1

      requestAnimationFrame(animate)
    }
    const animId = requestAnimationFrame(animate)

    const interval = setInterval(() => {
      const now = performance.now()
      const elapsed = now - lastFpsCheck.current
      const currentFps = (frameCountRef.current / elapsed) * 1000
      frameCountRef.current = 0
      lastFpsCheck.current = now
      setFps(Math.round(currentFps))

      if (currentFps < 15) setQuality('low')
      else if (currentFps < 30) setQuality('medium')
      else setQuality('high')
    }, 2000)

    return () => {
      resizeObserver.disconnect()
      cancelAnimationFrame(animId)
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    if (events.length > lastEventCount.current) {
       const newEvents = events.slice(lastEventCount.current)
       lastEventCount.current = events.length
       
       // Send new events to worker
       workerRef.current?.postMessage({ type: 'events', data: newEvents });

       const W = canvas.clientWidth || 800
       const H = canvas.clientHeight || 600
       newEvents.slice(-8).forEach(e => spawnNode(e, W, H))
    }
  }, [events, spawnNode])

  return (
    <div className="h-full flex flex-col bg-[#12151F] relative">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => setPerfMode(!perfMode)}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
            perfMode
              ? 'bg-[#00F0FF]/10 border-[#00F0FF]/30 text-[#00F0FF]'
              : 'bg-[#0B0D14]/80 border-white/5 text-white/50 hover:text-white/90 backdrop-blur-md'
          }`}
        >
          PERF
        </button>
        <span className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#0B0D14]/80 border border-white/5 text-white/70 backdrop-blur-md shadow-lg">
          {fps} fps
        </span>
      </div>

      <div className="flex-1 relative rounded-2xl overflow-hidden m-2">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  )
}
