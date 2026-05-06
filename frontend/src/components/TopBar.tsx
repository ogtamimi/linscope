interface Props { 
  procCount: number
  netCount: number
  eps: number
  connected: boolean 
}

function MetricCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="group relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
      <div className="relative flex items-center gap-3 bg-gray-900/50 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2.5 hover:border-white/20 transition-all">
        <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
          <span className="text-lg">{icon}</span>
        </div>
        <div>
          <div className="text-2xl font-bold text-white tabular-nums">{value.toLocaleString()}</div>
          <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
        </div>
      </div>
    </div>
  )
}

export function TopBar({ procCount, netCount, eps, connected }: Props) {
  return (
    <div className="h-16 bg-[#0d1117]/80 backdrop-blur-xl border-b border-white/5 flex items-center px-6 gap-4 shrink-0">
      <MetricCard label="PROCESSES" value={procCount} color="green" icon="⚙️" />
      <MetricCard label="CONNECTIONS" value={netCount} color="blue" icon="🌐" />
      <MetricCard label="EVENTS/S" value={eps} color="yellow" icon="⚡" />
      
      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/50 rounded-full border border-white/5">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/50' : 'bg-red-500'}`} />
          <span className="text-[10px] text-gray-400 font-mono">
            {connected ? 'LIVE STREAMING' : 'DISCONNECTED'}
          </span>
        </div>
        <div className="text-[10px] text-gray-600 font-mono">
          {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
