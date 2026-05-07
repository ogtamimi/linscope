import { useEffect, useRef, useCallback, useState } from 'react'
import type { LinEvent } from '../types/events'

const COLORS = { exec: '#3fb950', connect: '#58a6ff', exit: '#f85149', fork: '#d29922', unknown: '#8b949e' }
const MAX_NODES = 35            // أقل تحت الضغط
const MAX_EDGES = 50
const TARGET_FPS = 24           // أقل لتقليل العمل
const QUALITY_LEVELS = { high: 1, medium: 0.7, low: 0.4 }

export function LiveGraphOptimizedHighPerf({ events }: { events: LinEvent[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const offscreenRef = useRef<OffscreenCanvas | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('high')
  const frameCountRef = useRef(0)
  const lastFpsCheck = useRef(performance.now())
  const fps = useRef(60)

  // OffscreenCanvas and worker
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const offscreen = canvas.transferControlToOffscreen()
    offscreenRef.current = offscreen
    
    const worker = new Worker(new URL('../workers/graphRenderWorker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.postMessage({ type: 'init', canvas: offscreen, colors: COLORS, maxNodes: MAX_NODES, maxEdges: MAX_EDGES }, [offscreen])
    
    // Quality adjustment based on FPS
    const interval = setInterval(() => {
      const now = performance.now()
      const elapsed = now - lastFpsCheck.current
      const currentFps = (frameCountRef.current / elapsed) * 1000
      frameCountRef.current = 0
      lastFpsCheck.current = now
      fps.current = currentFps
      
      if (currentFps < 15) setQuality('low')
      else if (currentFps < 30) setQuality('medium')
      else setQuality('high')
    }, 2000)
    
    return () => {
      clearInterval(interval)
      worker.terminate()
    }
  }, [])

  // Send events to worker (throttled)
  const lastBatchRef = useRef<LinEvent[]>([])
  useEffect(() => {
    // Accumulate events for 50ms before sending to worker
    const batch = events.slice(lastBatchRef.current.length)
    if (batch.length === 0) return
    lastBatchRef.current = events
    
    const qualityFactor = QUALITY_LEVELS[quality]
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'events', events: batch, quality: qualityFactor, maxNodes: Math.floor(MAX_NODES * qualityFactor) })
    }
    frameCountRef.current++
  }, [events, quality])

  return <canvas ref={canvasRef} className="w-full h-full" style={{ imageRendering: 'crisp-edges' }} />
}
