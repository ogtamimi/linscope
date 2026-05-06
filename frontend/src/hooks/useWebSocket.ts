import { useEffect, useRef, useState, useCallback } from 'react'
import type { LinEvent } from '../types/events'

const WS_URL = 'ws://localhost:8000/ws'
const MAX_EVENTS = 500

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null)
  const [events, setEvents] = useState<LinEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [eps, setEps] = useState(0)
  const epsBuf = useRef(0)

  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(WS_URL)
      ws.current.onopen = () => { setConnected(true) }
      ws.current.onmessage = (msg) => {
        const data = JSON.parse(msg.data)
        if (data.type === 'history') {
          setEvents(data.events.slice(-MAX_EVENTS))
        } else if (data.type === 'event') {
          epsBuf.current++
          setEvents(prev => {
            const next = [...prev, data.data]
            return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next
          })
        }
      }
      ws.current.onclose = () => { setConnected(false); setTimeout(connect, 3000) }
      ws.current.onerror = () => { ws.current?.close() }
    } catch { setTimeout(connect, 3000) }
  }, [])

  useEffect(() => {
    connect()
    const timer = setInterval(() => {
      setEps(epsBuf.current)
      epsBuf.current = 0
    }, 1000)
    return () => { clearInterval(timer); ws.current?.close() }
  }, [connect])

  return { events, connected, eps }
}
