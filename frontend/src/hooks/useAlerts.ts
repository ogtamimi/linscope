import { useState, useEffect, useRef, useCallback } from 'react'
import type { Alert } from '../types'

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const getAlertsWsUrl = () => {
    const saved = localStorage.getItem('linscope_settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        if (settings.wsUrl) {
          // Only use wsUrl if it's a valid WebSocket URL
          if (typeof settings.wsUrl === 'string' && (settings.wsUrl.startsWith('ws://') || settings.wsUrl.startsWith('wss://'))) {
            const base = settings.wsUrl.endsWith('/ws') ? settings.wsUrl : settings.wsUrl.replace(/\/$/, '');
            return base.endsWith('/alerts') ? base : `${base}/alerts`;
          }
        }
      } catch (e) {
        console.error('Error parsing settings for alerts wsUrl', e);
      }
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = '8000'
    return `${protocol}//${host}:${port}/ws/alerts`
  }

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return

    const wsUrl = getAlertsWsUrl()
    console.log('Connecting to Alerts WebSocket:', wsUrl)

    const ws = new WebSocket(wsUrl)
    socketRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'alert') {
          // Play sound if enabled
          const saved = localStorage.getItem('linscope_settings')
          if (saved) {
            try {
              const settings = JSON.parse(saved)
              if (settings.enableSounds) {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2558/2558-preview.mp3') // High tech chirp
                audio.play().catch(e => console.warn('Audio play blocked', e))
              }
            } catch (e) { /* ignore */ }
          }

          setAlerts(prev => {
            if (prev.find(a => a.id === data.data.id)) return prev
            const newAlert = { ...data.data, acknowledged: false }
            return [newAlert, ...prev].slice(0, 500)
          })
        }
      } catch (err) {
        console.error('Error parsing alert message:', err)
      }
    }

    ws.onclose = () => {
      setConnected(false)
      reconnectTimeoutRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = (err) => {
      console.error('Alerts WebSocket Error:', err)
      ws.close()
    }
  }, [setAlerts])

  useEffect(() => {
    connect()

    const handleReconnect = () => {
      if (socketRef.current) {
        socketRef.current.onclose = null
        socketRef.current.close()
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      connect()
    }

    window.addEventListener('linscope-reconnect', handleReconnect)

    return () => {
      window.removeEventListener('linscope-reconnect', handleReconnect)
      if (socketRef.current) {
        socketRef.current.onclose = null
        socketRef.current.close()
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    }
  }, [connect])

  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a))
  }, [])

  const activeAlertsCount = alerts.filter(a => !a.acknowledged).length

  return { alerts, activeAlertsCount, connected, acknowledgeAlert, setAlerts }
}
