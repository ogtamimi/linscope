import { useEffect, useRef, useCallback, useMemo, useState, useTransition } from 'react'
import type { LinEvent } from '../types/events'
import { performanceMonitor, throttleRAF, NodePool } from '../utils/performance'

const COLORS: Record<string, string> = {
  exec: '#3fb950',
  connect: '#58a6ff',
  exit: '#f85149',
  fork: '#d29922',
  unknown: '#8b949e'
}

const MAX_NODES = 50
const MAX_EDGES = 80
const TARGET_FPS = 30
const BATCH_SIZE = 20

interface Node {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  proc: string
  color: string
  r: number
  alpha: number
  age: number
  maxAge: number
}

interface Edge {
  fromId: string
  toId: string
  alpha: number
  age: number
  maxAge: number
}

interface WorkerMessage {
  type: 'updated'
  nodes: Node[]
  edges: Edge[]
}

export function LiveGraph({ events }: { events: LinEvent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  const nodeMapRef = useRef<Map<string, Node>>(new Map())
  const lastCountRef = useRef(0)
  const animRef = useRef<number>(0)
  const workerRef = useRef<Worker | null>(null)
  const lastUpdateRef = useRef(0)
  const poolRef = useRef(new NodePool())
  const [performanceMode, setPerformanceMode] = useState(false)
  const [metrics, setMetrics] = useState({
    fps: 60,
    nodesCount: 0,
    renderTime: 0,
    memoryUsage: 0
  })

  // Initialize Web Worker
  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('../workers/graphWorker.ts', import.meta.url),
        { type: 'module' }
      )
      
      workerRef.current.onmessage = (event: MessageEvent<WorkerMessage>) => {
        if (event.data.type === 'updated') {
          nodesRef.current = event.data.nodes
          edgesRef.current = event.data.edges
          
          // Update node map for quick lookup
          nodeMapRef.current.clear()
          nodesRef.current.forEach(n => nodeMapRef.current.set(n.id, n))
        }
      }
    } catch (e) {
      console.warn('Web Worker not available, using main thread', e)
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  const spawnNode = useCallback((event: LinEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const W = canvas.width
    const H = canvas.height
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
      const parent = nodes[Math.floor(Math.random() * Math.min(nodes.length, 10))]
      edgesRef.current.push({
        fromId: parent.id,
        toId: node.id,
        alpha: 1,
        age: 0,
        maxAge: node.maxAge
      })
    }

    nodes.push(node)
    nodeMapRef.current.set(node.id, node)

    // Keep nodes pool under control
    if (nodes.length > MAX_NODES) {
      const removed = nodes.shift()
      if (removed) {
        nodeMapRef.current.delete(removed.id)
        poolRef.current.release(removed)
      }
    }

    // Keep edges under control
    if (edgesRef.current.length > MAX_EDGES) {
      edgesRef.current.splice(0, edgesRef.current.length - MAX_EDGES)
    }
  }, [])

  // Batch process new events
  useEffect(() => {
    const newEvents = events.slice(lastCountRef.current)
    lastCountRef.current = events.length

    if (newEvents.length === 0) return

    performanceMonitor.recordEvent()

    // Only spawn up to BATCH_SIZE nodes per frame
    const toSpawn = performanceMode
      ? newEvents.slice(-Math.min(BATCH_SIZE / 2, newEvents.length))
      : newEvents.slice(-Math.min(BATCH_SIZE, newEvents.length))

    toSpawn.forEach(spawnNode)
  }, [events, spawnNode, performanceMode])

  // Animation loop with RAF throttling
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })!

    const resize = () => {
      const area = canvas.parentElement!
      const ratio = window.devicePixelRatio || 1
      const width = area.clientWidth
      const height = area.clientHeight

      canvas.width = width * ratio
      canvas.height = height * ratio
      ctx.scale(ratio, ratio)

      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement!)

    let lastFrameTime = 0
    const minFrameTime = 1000 / TARGET_FPS

    const draw = () => {
      const now = performance.now()

      if (now - lastFrameTime >= minFrameTime) {
        const startRender = performance.now()
        const W = canvas.width / (window.devicePixelRatio || 1)
        const H = canvas.height / (window.devicePixelRatio || 1)

        if (W === 0 || H === 0) {
          animRef.current = requestAnimationFrame(draw)
          return
        }

        // Update physics in worker
        if (workerRef.current) {
          workerRef.current.postMessage({
            type: 'updatePositions',
            nodes: nodesRef.current,
            edges: edgesRef.current,
            width: W,
            height: H,
            dt: (now - lastFrameTime) / 1000
          })
        } else {
          // Fallback: simple updates
          updateNodePositions(nodesRef.current, edgesRef.current, W, H)
        }

        // Render
        ctx.fillStyle = 'rgba(13, 17, 23, 0.1)'
        ctx.fillRect(0, 0, W, H)

        // Draw edges
        edgesRef.current.forEach((edge) => {
          const from = nodeMapRef.current.get(edge.fromId)
          const to = nodeMapRef.current.get(edge.toId)

          if (from && to && edge.alpha > 0.05) {
            ctx.strokeStyle = `rgba(88, 166, 255, ${edge.alpha * 0.3})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(from.x, from.y)
            ctx.lineTo(to.x, to.y)
            ctx.stroke()
          }
        })

        // Draw nodes
        nodesRef.current.forEach((node) => {
          if (node.alpha < 0.05) return

          const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r)
          gradient.addColorStop(0, `${node.color}${Math.round(node.alpha * 255).toString(16).padStart(2, '0')}`)
          gradient.addColorStop(1, `${node.color}${Math.round(node.alpha * 128).toString(16).padStart(2, '0')}`)

          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2)
          ctx.fill()

          // Glow effect for important nodes
          if (node.r > 10) {
            ctx.strokeStyle = `${node.color}${Math.round(node.alpha * 100).toString(16).padStart(2, '0')}`
            ctx.lineWidth = 2
            ctx.stroke()
          }
        })

        lastFrameTime = now
        const renderTime = performance.now() - startRender
        performanceMonitor.recordFrame(renderTime)

        setMetrics({
          fps: performanceMonitor.getMetrics(nodesRef.current.length, 0).fps,
          nodesCount: nodesRef.current.length,
          renderTime: Math.round(renderTime * 100) / 100,
          memoryUsage: (performance as any).memory
            ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
            : 0
        })
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
    }
  }, [performanceMode])

  return (
    <div className="relative w-full h-full flex flex-col">
      <canvas
        ref={canvasRef}
        className="w-full h-full bg-[#0d1117] cursor-default"
      />

      {/* Performance overlay */}
      <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 font-mono text-xs text-gray-300 space-y-1 border border-white/10">
        <div className="flex items-center gap-2">
          <span className={metrics.fps >= 30 ? 'text-green-400' : 'text-yellow-400'}>
            FPS: {metrics.fps}
          </span>
        </div>
        <div className="text-gray-400">Nodes: {metrics.nodesCount}/{MAX_NODES}</div>
        <div className="text-gray-400">Render: {metrics.renderTime}ms</div>
        <div className={metrics.memoryUsage > 150 ? 'text-orange-400' : 'text-gray-400'}>
          Memory: {metrics.memoryUsage}MB
        </div>
      </div>

      {/* Performance mode toggle */}
      <button
        onClick={() => setPerformanceMode(!performanceMode)}
        className={`absolute top-4 right-4 px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-colors ${
          performanceMode
            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
            : 'bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30'
        }`}
      >
        {performanceMode ? '⚡ PERF' : '🎨 NORMAL'}
      </button>
    </div>
  )
}

// Fallback physics update when Web Worker is unavailable
function updateNodePositions(
  nodes: Node[],
  edges: Edge[],
  width: number,
  height: number
) {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]

    // Simplified physics - gravity to center
    const dx = width / 2 - n.x
    const dy = height / 2 - n.y
    const dist = Math.sqrt(dx * dx + dy * dy) + 1
    const force = 0.00005 * (dist - 100)

    n.vx += (dx / dist) * force
    n.vy += (dy / dist) * force

    // Friction
    n.vx *= 0.95
    n.vy *= 0.95
    n.x += n.vx
    n.y += n.vy

    // Age
    n.age++
    n.alpha = Math.max(0, 1 - (n.age / n.maxAge))
  }

  // Update edges
  edges.forEach((e) => {
    e.age++
    e.alpha = Math.max(0, 1 - (e.age / e.maxAge))
  })
}
