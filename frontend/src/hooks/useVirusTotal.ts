import { useState, useCallback } from 'react'

interface VTResult {
  malicious: number
  suspicious: number
  untrusted: number
  total: number
  last_analysis: string | null
  link: string | null
  error?: string
}

interface VTStatus {
  [alertId: string]: {
    loading: boolean
    result?: VTResult
    error?: string
  }
}

const VT_CACHE_KEY = 'linscope_vt_cache'

export function useVirusTotal() {
  const [status, setStatus] = useState<VTStatus>({})
  const [stats, setStats] = useState<{daily: number, monthly: number}>({daily: 0, monthly: 0})

  const getLocalCache = useCallback(() => {
    try {
      const saved = localStorage.getItem(VT_CACHE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  }, [])

  const saveLocalCache = useCallback((cache: Record<string, any>) => {
    localStorage.setItem(VT_CACHE_KEY, JSON.stringify(cache))
  }, [])

  const checkIOC = useCallback(async (
    iocType: 'ip' | 'domain' | 'hash',
    iocValue: string,
    alertId: string
  ) => {
    setStatus(prev => ({
      ...prev,
      [alertId]: { loading: true }
    }))

    try {
      const localCache = getLocalCache()
      const cacheKey = `${iocType}:${iocValue}`
      
      if (localCache[cacheKey]) {
        const cached = localCache[cacheKey]
        if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
          setStatus(prev => ({
            ...prev,
            [alertId]: { loading: false, result: cached.result }
          }))
          return
        }
      }

      const settings = JSON.parse(localStorage.getItem('linscope_settings') || '{}')
      if (!settings.vtApiKey) {
        setStatus(prev => ({
          ...prev,
          [alertId]: { 
            loading: false, 
            error: 'VirusTotal API key not configured. Go to Settings > Intelligence API'
          }
        }))
        return
      }

      const response = await fetch('/api/check-ioc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: iocType, value: iocValue })
      })

      const data = await response.json()

      if (data.skipped) {
        setStatus(prev => ({
          ...prev,
          [alertId]: { 
            loading: false, 
            result: { 
              malicious: 0, 
              suspicious: 0, 
              untrusted: 0, 
              total: 0, 
              last_analysis: null, 
              link: null,
              error: data.reason
            }
          }
        }))
      } else if (data.cached) {
        setStatus(prev => ({
          ...prev,
          [alertId]: { loading: false, result: data.result }
        }))
        localCache[cacheKey] = { timestamp: Date.now(), result: data.result }
        saveLocalCache(localCache)
      } else {
        setStatus(prev => ({
          ...prev,
          [alertId]: { loading: false, result: data.result }
        }))
        localCache[cacheKey] = { timestamp: Date.now(), result: data.result }
        saveLocalCache(localCache)
      }
    } catch (error) {
      console.error('VT check error:', error)
      setStatus(prev => ({
        ...prev,
        [alertId]: { 
          loading: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }))
    }
  }, [getLocalCache, saveLocalCache])

  const getVTStats = useCallback(async () => {
    try {
      const response = await fetch('/api/virustotal/stats')
      if (response.ok) {
        const data = await response.json()
        setStats({
          daily: data.remaining_daily || 0,
          monthly: data.remaining_monthly || 0
        })
      }
    } catch (error) {
      console.error('Failed to fetch VT stats:', error)
    }
  }, [])

  const clearCache = useCallback(() => {
    localStorage.removeItem(VT_CACHE_KEY)
    setStatus({})
  }, [])

  return {
    checkIOC,
    status,
    stats,
    getVTStats,
    clearCache
  }
}