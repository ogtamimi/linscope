import { useEffect, useRef, useState, useCallback } from 'react'
import type { LinEvent } from '../types/events'
import { createEventBatcher, performanceMonitor } from '../utils/performance'

const WS_URL = 'ws://localhost:8000/ws'
const MAX_EVENTS = 1000
const BATCH_TIMEOUT = 50 // ms
const MAX_QUEUE = 500

interface EventBatch {
  type: 'batch'
  events: LinEvent[]
  timestamp: number
}

interface EventMessage {
  type: 'event'
  data: LinEvent
}

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null)
  const [events, setEvents] = useState<LinEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [eps, setEps] = useState(0)
  const epsBufRef = useRef(0)
  const droppedRef = useRef(0)
  const eventQueueRef = useRef<LinEvent[]>([])
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const batchProcessorRef = useRef<ReturnType<typeof createEventBatcher<LinEvent>> | null>(null)

  const processBatch = useCallback((batch: LinEvent[]) => {
    setEvents((prev) => {
      const next = [...prev, ...batch]
      const toKeep = next.slice(-MAX_EVENTS)
      
      if (next.length > MAX_EVENTS) {
        const dropped = next.length - MAX_EVENTS
        droppedRef.current += dropped
        performanceMonitor.recordDroppedEvents(dropped)
      }
      
      return toKeep
    })

    epsBufRef.current += batch.length
    batch.forEach(() => performanceMonitor.recordEvent())
  }, [])

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      ws.current = new WebSocket(WS_URL)
      ws.current.binaryType = 'arraybuffer'

      ws.current.onopen = () => {
        setConnected(true)
        console.log('WebSocket connected')
      }

      ws.current.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data)

          if (data.type === 'history') {
            // Initial history batch
            const historyEvents = data.events.slice(-MAX_EVENTS) as LinEvent[]
            setEvents(historyEvents)
            epsBufRef.current += historyEvents.length
          } else if (data.type === 'batch') {
            // Batched events from server
            processBatch(data.events as LinEvent[])
          } else if (data.type === 'event') {
            // Single event (fallback for non-batching backend)
            if (batchProcessorRef.current) {
              batchProcessorRef.current.add(data.data as LinEvent)
            } else {
              processBatch([data.data as LinEvent])
            }
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e)
        }
      }

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        ws.current?.close()
      }

      ws.current.onclose = () => {
        setConnected(false)
        console.log('WebSocket disconnected, reconnecting in 3s...')
        
        if (batchProcessorRef.current) {
          batchProcessorRef.current.flush()
        }
        
        reconnectTimeoutRef.current = setTimeout(connect, 3000)
      }
    } catch (error) {
      console.error('WebSocket connection error:', error)
      reconnectTimeoutRef.current = setTimeout(connect, 3000)
    }
  }, [processBatch])

  // Initialize batch processor
  useEffect(() => {
    batchProcessorRef.current = createEventBatcher(processBatch, BATCH_TIMEOUT)
  }, [processBatch])

  // Connect on mount
  useEffect(() => {
    connect()

    const epsInterval = setInterval(() => {
      setEps(epsBufRef.current)
      epsBufRef.current = 0
    }, 1000)

    return () => {
      clearInterval(epsInterval)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      
      if (batchProcessorRef.current) {
        batchProcessorRef.current.flush()
      }
      
      ws.current?.close()
    }
  }, [connect])

  // Gracefully close batch processor
  useEffect(() => {
    return () => {
      if (batchProcessorRef.current) {
        batchProcessorRef.current.flush()
      }
    }
  }, [])

  return {
    events,
    connected,
    eps,
    droppedEvents: droppedRef.current,
    eventQueueSize: events.length
  }
}
