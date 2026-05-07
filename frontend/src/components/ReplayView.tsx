import React, { useState, useEffect, useRef, useCallback } from 'react'

interface Event {
  id: string
  timestamp: number
  datetime: string
  pid: number
  process: string
  event: string
  filename?: string
  target?: string
}

export function ReplayView() {
  const [allEvents, setAllEvents] = useState<Event[]>([])
  const [displayEvents, setDisplayEvents] = useState<Event[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1.0)
  const [totalEvents, setTotalEvents] = useState(0)
  const [nextIndex, setNextIndex] = useState(0)
  const playlistRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const lastTimestampRef = useRef<number>(0)

  // Fetch events in chunks
  const fetchRange = useCallback(async (start: number, end: number) => {
    const res = await fetch(`http://localhost:8000/api/replay/range?start=${start}&end=${end}`)
    const data = await res.json()
    if (data.events?.length) {
      setAllEvents(prev => {
        const newEvents = [...prev]
        data.events.forEach((ev: Event, idx: number) => {
          const index = start + idx
          if (!newEvents[index]) newEvents[index] = ev
        })
        return newEvents
      })
      setTotalEvents(data.total)
      setNextIndex(data.end_index)
    }
  }, [])

  // Load initial batch
  useEffect(() => {
    fetchRange(0, 200)
  }, [])

  // Auto-scroll to current event
  useEffect(() => {
    if (playlistRef.current && displayEvents.length > 0) {
      const activeItem = playlistRef.current.querySelector(`[data-index="${currentIndex}"]`)
      activeItem?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentIndex, displayEvents])

  // Update display events based on currentIndex
  useEffect(() => {
    if (allEvents.length > 0 && currentIndex < allEvents.length) {
      setDisplayEvents(allEvents.slice(0, currentIndex + 1))
    }
  }, [allEvents, currentIndex])

  // Playback logic
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      return
    }
    let lastEventTime = allEvents[currentIndex]?.timestamp || 0
    let lastFrame = performance.now()

    const step = (now: number) => {
      const delta = (now - lastFrame) / 1000 * speed
      lastFrame = now
      if (currentIndex < totalEvents - 1 && allEvents[currentIndex + 1]) {
        const nextEvent = allEvents[currentIndex + 1]
        const timeDiff = nextEvent.timestamp - lastEventTime
        if (delta >= timeDiff) {
          setCurrentIndex(prev => Math.min(totalEvents - 1, prev + 1))
          lastEventTime = nextEvent.timestamp
          // Preload next chunk if needed
          if (currentIndex + 50 >= allEvents.length && nextIndex < totalEvents) {
            fetchRange(nextIndex, nextIndex + 200)
          }
        }
      }
      animationRef.current = requestAnimationFrame(step)
    }
    animationRef.current = requestAnimationFrame(step)
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [isPlaying, speed, currentIndex, totalEvents, allEvents, fetchRange, nextIndex])

  const handleSeek = (index: number) => {
    setIsPlaying(false)
    setCurrentIndex(Math.min(totalEvents - 1, Math.max(0, index)))
  }

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed)
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0c10]">
      <div className="flex items-center gap-4 px-4 py-2 border-b border-white/5 bg-gray-900/30">
        <div className="flex gap-1">
          <button onClick={() => setIsPlaying(!isPlaying)} className="px-3 py-1 bg-blue-600 rounded text-xs">
            {isPlaying ? '⏸️ Pause' : '▶️ Play'}
          </button>
          <button onClick={() => handleSeek(currentIndex - 10)} className="px-2 py-1 bg-gray-700 rounded text-xs">-10</button>
          <button onClick={() => handleSeek(currentIndex + 10)} className="px-2 py-1 bg-gray-700 rounded text-xs">+10</button>
        </div>
        <div className="flex gap-1">
          <button onClick={() => handleSpeedChange(0.5)} className={`px-2 py-1 text-xs rounded ${speed===0.5?'bg-blue-600':'bg-gray-700'}`}>0.5x</button>
          <button onClick={() => handleSpeedChange(1)} className={`px-2 py-1 text-xs rounded ${speed===1?'bg-blue-600':'bg-gray-700'}`}>1x</button>
          <button onClick={() => handleSpeedChange(2)} className={`px-2 py-1 text-xs rounded ${speed===2?'bg-blue-600':'bg-gray-700'}`}>2x</button>
          <button onClick={() => handleSpeedChange(4)} className={`px-2 py-1 text-xs rounded ${speed===4?'bg-blue-600':'bg-gray-700'}`}>4x</button>
        </div>
        <div className="flex-1 text-center text-[10px] text-gray-400 font-mono">
          {currentIndex+1} / {totalEvents} events | Speed: {speed}x
        </div>
      </div>

      <div ref={playlistRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {displayEvents.map((ev, idx) => {
          const isActive = idx === currentIndex
          return (
            <div
              key={ev.id}
              data-index={idx}
              onClick={() => handleSeek(idx)}
              className={`p-2 rounded cursor-pointer transition-all ${isActive ? 'bg-blue-600/30 border-l-4 border-blue-500' : 'hover:bg-gray-800/50 border-l-4 border-transparent'}`}
            >
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-gray-500 w-8">{idx+1}</span>
                <span className="text-gray-300 font-mono">{ev.datetime?.slice(11, 19)}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                  ev.event==='exec'?'bg-green-900/80': ev.event==='connect'?'bg-blue-900/80':'bg-gray-800'
                }`}>{ev.event}</span>
                <span className="text-gray-200">{ev.process}</span>
                <span className="text-gray-500 text-[9px] truncate">{ev.filename || ev.target}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
