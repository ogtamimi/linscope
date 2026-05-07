import { useEffect, useRef, useState, useCallback } from 'react'

const WS_URL = 'ws://localhost:8000/ws'
const MAX_EVENTS = 2000
const BATCH_TIMEOUT_MS = 80

export function useWebSocketAdaptive() {
  const ws = useRef<WebSocket | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [connected, setConnected] = useState(false)
  const [eps, setEps] = useState(0)
  const eventBuffer = useRef<any[]>([])
  const flushTimer = useRef<any>(null)
  const epsCounter = useRef(0)
  const lastEpsTime = useRef(Date.now())

  const flush = useCallback(() => {
    if (eventBuffer.current.length === 0) return
    const batch = eventBuffer.current.splice(0, 100)
    setEvents(prev => {
      const newEvents = [...prev, ...batch]
      if (newEvents.length > MAX_EVENTS) return newEvents.slice(-MAX_EVENTS)
      return newEvents
    })
  }, [])

  useEffect(() => {
    flushTimer.current = setInterval(flush, BATCH_TIMEOUT_MS)
    return () => clearInterval(flushTimer.current)
  }, [flush])

  useEffect(() => {
    const socket = new WebSocket(WS_URL)
    ws.current = socket
    socket.onopen = () => setConnected(true)
    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data)
      if (data.type === 'history') {
        setEvents(data.events.slice(-MAX_EVENTS))
      } else if (data.type === 'batch' || data.type === 'event') {
        const newEvents = data.type === 'batch' ? data.events : [data.data]
        eventBuffer.current.push(...newEvents)
        epsCounter.current += newEvents.length
        if (eventBuffer.current.length > 300) flush()
      }
    }
    socket.onclose = () => setConnected(false)
    return () => socket.close()
  }, [flush])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const diff = (now - lastEpsTime.current) / 1000
      const current = epsCounter.current / diff
      setEps(Math.round(current))
      epsCounter.current = 0
      lastEpsTime.current = now
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return { events, connected, eps }
}
