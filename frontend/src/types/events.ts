export type EventType = 'exec' | 'connect' | 'exit' | 'fork' | 'unknown'

export interface LinEvent {
  id: string
  timestamp: number
  datetime: string
  pid: number
  ppid?: number
  uid?: number
  process: string
  event: EventType
  source: string
  filename?: string
  dest_ip?: string
  dest_port?: number
  source_ip?: string
  target?: string
}
