import { useEffect, useRef, useState, useCallback } from 'react';
import type { LinEvent } from '../types';

function getWsUrl() {
  const saved = localStorage.getItem('linscope_settings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      if (settings.wsUrl) {
        // Only use wsUrl if it's a valid WebSocket URL
        if (typeof settings.wsUrl === 'string' && (settings.wsUrl.startsWith('ws://') || settings.wsUrl.startsWith('wss://'))) {
          return settings.wsUrl;
        }
      }
    } catch (e) {
      console.error('Error parsing settings for WS_URL', e);
    }
  }
  return import.meta.env.VITE_WS_URL || (window.location.protocol === 'https:' ? `wss://${window.location.host}/ws` : `ws://${window.location.hostname}:8000/ws`);
}

const WS_URL = getWsUrl();
const MAX_EVENTS = 2000;
const BATCH_TIMEOUT_MS = 80;

const INTERNAL_PROCESSES = ['python3', 'python', 'uvicorn', 'gunicorn', 'collector', 'mock_collector', 'bpftrace', 'node', 'vite', 'npm', 'npx', 'ollama'];
const INTERNAL_PATHS = ['/linscope', 'collector/main.py', 'uvicorn backend.main:app'];

function isInternalEvent(event: LinEvent): boolean {
  const proc = (event.process || '').toLowerCase();
  const filename = (event.filename || '').toLowerCase();
  const target = (event.target || '').toLowerCase();
  
  // 1. Process name check
  if (INTERNAL_PROCESSES.some(p => proc.includes(p))) return true;
  
  // 2. Path and file checks
  const searchable = `${filename} ${target}`.toLowerCase();
  if (INTERNAL_PATHS.some(path => searchable.includes(path))) return true;
  
  return false;
}

export function useWebSocketAdaptive() {
  const ws = useRef<WebSocket | null>(null);
  const [events, setEvents] = useState<LinEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [eps, setEps] = useState(0);
  const eventBuffer = useRef<LinEvent[]>([]);
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const epsCounter = useRef(0);
  const lastEpsTime = useRef(Date.now());

  const flush = useCallback(() => {
    if (eventBuffer.current.length === 0) return;
    // Batch move from buffer to state
    const batch = eventBuffer.current.splice(0, 100);
    setEvents(prev => {
      const newEvents = [...prev, ...batch];
      if (newEvents.length > MAX_EVENTS) return newEvents.slice(-MAX_EVENTS);
      return newEvents;
    });
  }, []);

  useEffect(() => {
    flushTimer.current = setInterval(flush, BATCH_TIMEOUT_MS);
    return () => {
      if (flushTimer.current) clearInterval(flushTimer.current);
    };
  }, [flush]);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;

    const connect = () => {
      if (socket?.readyState === WebSocket.OPEN) return;

      const wsUrl = getWsUrl();
      console.log('Connecting to Events WebSocket:', wsUrl);
      
      try {
        socket = new WebSocket(wsUrl);
        ws.current = socket;

        socket.onopen = () => {
          setConnected(true);
          if (reconnectTimer) clearTimeout(reconnectTimer);
        };

        socket.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            if (data.type === 'history') {
              const filteredHistory = (data.events as LinEvent[]).filter(ev => !isInternalEvent(ev));
              setEvents(filteredHistory.slice(-MAX_EVENTS));
            } else if (data.type === 'batch' || data.type === 'event') {
              let newEvents = data.type === 'batch' ? data.events : [data.data];
              newEvents = (newEvents as LinEvent[]).filter(ev => !isInternalEvent(ev));
              
              if (newEvents.length > 0) {
                eventBuffer.current.push(...newEvents);
                epsCounter.current += newEvents.length;
                if (eventBuffer.current.length > 300) flush();
              }
            }
          } catch (e) {
            console.error('WebSocket message parse error:', e);
          }
        };

        socket.onclose = () => {
          setConnected(false);
          reconnectTimer = setTimeout(connect, 3000);
        };

        socket.onerror = (e) => {
          console.error('WebSocket error:', e);
          // Do not close here, let onclose handle it
        };
      } catch (error) {
        console.error('WS Connection error:', error);
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    connect();

    const handleReconnect = () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      connect();
    };

    window.addEventListener('linscope-reconnect', handleReconnect);

    return () => {
      window.removeEventListener('linscope-reconnect', handleReconnect);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws.current = null;
    };
  }, [flush]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = (now - lastEpsTime.current) / 1000;
      const current = epsCounter.current / diff;
      setEps(Math.round(current));
      epsCounter.current = 0;
      lastEpsTime.current = now;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return { events, connected, eps };
}
