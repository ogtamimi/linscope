interface Props { procCount: number; netCount: number; eps: number; connected: boolean }

function Pill({ color, label, value }: { color: string; label: string; value: number }) {
  const dot: Record<string,string> = {
    green: 'bg-green-400',
    blue: 'bg-blue-400',
    amber: 'bg-yellow-400'
  }
  return (
    <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-full px-3 py-1">
      <span className={`w-1.5 h-1.5 rounded-full ${dot[color]}`} />
      <span className="text-[11px] font-mono">
        <span className="text-gray-200 font-semibold">{value}</span>
        <span className="text-gray-500 ml-1">{label}</span>
      </span>
    </div>
  )
}

export function TopBar({ procCount, netCount, eps, connected }: Props) {
  return (
    <div className="h-12 bg-[#161b22] border-b border-gray-800 flex items-center px-5 gap-4 shrink-0">
      <Pill color="green" label="processes" value={procCount} />
      <Pill color="blue" label="connections" value={netCount} />
      <Pill color="amber" label="events/s" value={eps} />
      <div className="ml-auto flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-[10px] text-gray-500 font-mono">
          {connected ? 'backend connected' : 'connecting...'}
        </span>
      </div>
    </div>
  )
}
