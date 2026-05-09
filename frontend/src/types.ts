export type EventType = 'exec' | 'connect' | 'exit' | 'fork' | 'unknown';

export interface LinEvent {
  id: string;
  timestamp: number;
  datetime: string;
  pid: number;
  ppid?: number;
  uid?: number;
  process: string;
  event: EventType;
  source: string;
  filename?: string;
  dest_ip?: string;
  dest_port?: number;
  source_ip?: string;
  target?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  message?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: number;
}

export interface Alert {
  id: string;
  timestamp: number;
  datetime: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  process?: string;
  pid?: number;
  eventIds: string[];
  mitre_technique?: string;
  score?: number;
  affected_pids?: number[];
  rule_name?: string;
  // VirusTotal IOCs extracted from related events
  iocs?: Array<{
    type: 'ip' | 'domain' | 'hash'
    value: string
    context?: string  // e.g., which event triggered this
  }>;
}

export interface PanelState {
  leftOpen: boolean;
  rightOpen: boolean;
  leftWidth: number;
  rightWidth: number;
  sidebarCollapsed: boolean;
}

export type ViewType = 'graph' | 'timeline' | 'replay' | 'alerts' | 'ai' | 'settings';

export const SEVERITY_COLORS = {
  critical: '#ff0044',
  high: '#ff6b00',
  medium: '#ffb800',
  low: '#00f0ff',
} as const;

export const EVENT_COLORS = {
  exec: '#00ff88',
  connect: '#00f0ff',
  exit: '#ff0044',
  fork: '#ffb800',
  unknown: '#64748b',
} as const;

export type AIProvider = 'ollama' | 'groq' | 'gemini';
export type ThemeMode = 'dark' | 'light';

export interface AppSettings {
  theme: ThemeMode;
  provider: AIProvider;
  model: string;
  wsUrl: string;
  ollamaBaseUrl?: string;
  vtApiKey?: string;
  vtAutoScan?: boolean;
  vtSmartFilter?: boolean;
}
