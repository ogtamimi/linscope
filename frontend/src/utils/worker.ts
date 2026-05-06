// Worker utility for easier Web Worker management

export class WorkerPool {
  private workers: Worker[] = []
  private workerScript: string
  private poolSize: number

  constructor(workerScript: string, poolSize: number = 4) {
    this.workerScript = workerScript
    this.poolSize = poolSize
  }

  initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        for (let i = 0; i < this.poolSize; i++) {
          const worker = new Worker(this.workerScript, { type: 'module' })
          this.workers.push(worker)
        }
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }

  async execute<T>(data: any): Promise<T> {
    if (this.workers.length === 0) {
      throw new Error('Worker pool not initialized')
    }

    const worker = this.workers[0]
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker timeout'))
      }, 5000)

      const handler = (event: MessageEvent) => {
        clearTimeout(timeout)
        worker.removeEventListener('message', handler)
        resolve(event.data as T)
      }

      worker.addEventListener('message', handler)
      worker.onerror = (error) => {
        clearTimeout(timeout)
        worker.removeEventListener('message', handler)
        reject(error)
      }

      worker.postMessage(data)
    })
  }

  terminate(): void {
    this.workers.forEach(w => w.terminate())
    this.workers = []
  }
}

// Simple single worker wrapper
export class SimpleWorker {
  private worker: Worker | null = null

  constructor(workerScript: string) {
    try {
      this.worker = new Worker(workerScript, { type: 'module' })
    } catch (error) {
      console.warn('Worker not available:', error)
    }
  }

  send<T>(data: any): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'))
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('Worker timeout'))
      }, 5000)

      const handler = (event: MessageEvent) => {
        clearTimeout(timeout)
        this.worker?.removeEventListener('message', handler)
        resolve(event.data as T)
      }

      this.worker.addEventListener('message', handler)
      this.worker.onerror = (error) => {
        clearTimeout(timeout)
        this.worker?.removeEventListener('message', handler)
        reject(error)
      }

      this.worker.postMessage(data)
    })
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}
