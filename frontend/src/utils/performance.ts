// Performance utilities and monitoring

export interface PerformanceMetrics {
  fps: number
  eventRate: number
  renderTime: number
  nodesCount: number
  memoryUsage: number
  droppedEvents: number
  batchSize: number
}

class PerformanceMonitor {
  private frameCount = 0
  private eventCount = 0
  private lastTimestamp = performance.now()
  private fps = 60
  private renderTime = 0
  private droppedEvents = 0

  recordFrame(renderTime: number) {
    this.frameCount++
    this.renderTime = renderTime
  }

  recordEvent() {
    this.eventCount++
  }

  recordDroppedEvents(count: number) {
    this.droppedEvents += count
  }

  getMetrics(nodesCount: number, batchSize: number): PerformanceMetrics {
    const now = performance.now()
    const elapsed = now - this.lastTimestamp

    if (elapsed >= 1000) {
      this.fps = this.frameCount
      this.frameCount = 0
      this.eventCount = 0
      this.lastTimestamp = now
    }

    const memoryUsage = (performance as any).memory
      ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
      : 0

    return {
      fps: this.fps,
      eventRate: this.eventCount,
      renderTime: Math.round(this.renderTime * 100) / 100,
      nodesCount,
      memoryUsage,
      droppedEvents: this.droppedEvents,
      batchSize
    }
  }

  reset() {
    this.droppedEvents = 0
  }
}

export const performanceMonitor = new PerformanceMonitor()

// Throttle function with RAF
export function throttleRAF<T extends (...args: any[]) => void>(
  callback: T,
  maxFps: number = 30
): T {
  let frameId: number | null = null
  const frameTime = 1000 / maxFps

  return ((...args: any[]) => {
    if (frameId === null) {
      const start = performance.now()
      frameId = requestAnimationFrame(() => {
        const renderTime = performance.now() - start
        performanceMonitor.recordFrame(renderTime)
        callback(...args)
        frameId = null
      })
    }
  }) as T
}

// Batch events with timeout
export function createEventBatcher<T>(
  callback: (batch: T[]) => void,
  delay: number = 50
) {
  let batch: T[] = []
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return {
    add: (event: T) => {
      batch.push(event)
      if (batch.length >= 50) {
        flush()
      } else if (!timeoutId) {
        timeoutId = setTimeout(flush, delay)
      }
    },
    flush: () => {
      if (batch.length > 0) {
        callback(batch)
        batch = []
      }
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
  }
}

// Object pool for nodes
export class NodePool {
  private pool: any[] = []
  private maxSize = 100

  acquire(): any {
    if (this.pool.length > 0) {
      const node = this.pool.pop()!
      node.age = 0
      node.alpha = 1
      return node
    }
    return {}
  }

  release(node: any) {
    if (this.pool.length < this.maxSize) {
      this.pool.push(node)
    }
  }

  reset() {
    this.pool = []
  }
}

// Intersection observer for virtual scrolling
export function createVirtualScroller(
  container: HTMLElement,
  itemHeight: number,
  visibleCount: number,
  onVisibleRangeChange: (start: number, end: number) => void
) {
  const items = new Map<HTMLElement, number>()
  let visibleStart = 0
  let visibleEnd = visibleCount

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.target instanceof HTMLElement) {
          const index = items.get(entry.target)
          if (index !== undefined) {
            if (entry.isIntersecting) {
              visibleStart = Math.min(visibleStart, index)
              visibleEnd = Math.max(visibleEnd, index + 1)
            }
          }
        }
      })
      onVisibleRangeChange(visibleStart, visibleEnd)
    },
    { root: container, threshold: 0.01 }
  )

  return {
    observe: (element: HTMLElement, index: number) => {
      items.set(element, index)
      observer.observe(element)
    },
    unobserve: (element: HTMLElement) => {
      observer.unobserve(element)
      items.delete(element)
    },
    disconnect: () => {
      observer.disconnect()
      items.clear()
    }
  }
}

// Request idle callback polyfill
export const requestIdleCallback_ =
  typeof requestIdleCallback !== 'undefined'
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 1)

export const cancelIdleCallback_ =
  typeof cancelIdleCallback !== 'undefined'
    ? cancelIdleCallback
    : (id: number) => clearTimeout(id)
