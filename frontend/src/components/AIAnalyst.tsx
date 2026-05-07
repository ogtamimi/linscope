import React, { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export function AIAnalyst() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "I'm your Linscope AI Security Analyst. I can help analyze security events, suggest investigation steps, and explain suspicious behavior. How can I assist you?",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [provider, setProvider] = useState<'ollama' | 'groq'>('ollama')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: input,
          provider: provider,
          context: messages.slice(-5).map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      // Add placeholder message
      const assistantMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                assistantContent += parsed.content
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1].content = assistantContent
                  return updated
                })
              }
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      console.error('AI chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Error: Check if Ollama is running or Groq API key is valid.',
        timestamp: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const analyzeEvents = async () => {
    const response = await fetch('/api/events?limit=50')
    const data = await response.json()
    const events = data.events || []

    setIsLoading(true)
    const userMessage: Message = {
      role: 'user',
      content: `Analyze these recent security events:\n${JSON.stringify(events.slice(0, 20), null, 2)}`,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])

    try {
      const aiResponse = await fetch('/api/ai/analyze-incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: events.slice(0, 50) })
      })
      const result = await aiResponse.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.analysis || 'Analysis complete.',
        timestamp: new Date()
      }])
    } catch (error) {
      console.error('Analysis error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0c10]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0d1117]/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="text-xs font-mono text-gray-300">AI SECURITY ANALYST</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={analyzeEvents} className="px-2 py-1 text-[10px] bg-blue-600 rounded hover:bg-blue-700">
            🔍 Analyze Events
          </button>
          <select value={provider} onChange={(e) => setProvider(e.target.value as any)} className="bg-gray-800 text-[10px] rounded px-2 py-1">
            <option value="ollama">🦙 Local (Ollama)</option>
            <option value="groq">⚡ Cloud (Groq)</option>
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200'}`}>
              <div className="text-xs whitespace-pre-wrap font-mono">{msg.content}</div>
              <div className="text-[9px] text-gray-400 mt-1">{msg.timestamp.toLocaleTimeString()}</div>
            </div>
          </div>
        ))}
        {isLoading && <div className="flex justify-start"><div className="bg-gray-800 rounded-lg px-3 py-2">Thinking...</div></div>}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t border-white/5 p-3">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder="Ask about suspicious activity..." className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs" disabled={isLoading} />
          <button onClick={sendMessage} disabled={isLoading || !input.trim()} className="px-3 py-2 bg-blue-600 rounded text-xs">Send</button>
        </div>
      </div>
    </div>
  )
}
