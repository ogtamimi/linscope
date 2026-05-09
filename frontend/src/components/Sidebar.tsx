import React, { useState } from 'react'
import type { ViewType } from '../types'
import {
  Activity,
  GitBranch,
  History,
  AlertTriangle,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Home,
  PieChart
} from 'lucide-react'

interface SidebarProps {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
  collapsed: boolean
  onToggleCollapse: () => void
  onSubItemClick?: (itemId: string, subItem: string) => void
  alertsCount: number
}

export function Sidebar({ activeView, onViewChange, collapsed, onToggleCollapse, onSubItemClick, alertsCount }: SidebarProps) {
  const realNavItems = [
    { id: 'graph', label: 'Dashboard', icon: Home, hasSubmenu: false, badge: null, subitems: [] },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: alertsCount > 0 ? alertsCount.toString() : null, hasSubmenu: false, subitems: [] },
    { id: 'timeline', label: 'Timeline', icon: GitBranch, hasSubmenu: false, badge: null, subitems: [] },
    { id: 'replay', label: 'Replay', icon: History, badge: null, hasSubmenu: false, subitems: [] },
    { id: 'ai', label: 'AI Analyst', icon: MessageSquare, hasSubmenu: true, subitems: ['New Analysis', 'Saved Reports'], badge: null },
  ] as const

  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [expandedSubmenu, setExpandedSubmenu] = useState<string | null>('ai')

  return (
    <aside className="h-full bg-[#12141C] flex flex-col select-none relative group/sidebar rounded-r-3xl border-r border-white/5 transition-all duration-300 z-50 overflow-visible">
      
      <div className={`p-6 flex items-center transition-all duration-300 ${collapsed ? 'justify-center p-4' : 'gap-3 overflow-hidden'}`}>
        <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-lg flex-shrink-0">
          <div className="w-4 h-4 rounded-full border-4 border-black" />
        </div>
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight text-white truncate animate-in fade-in slide-in-from-left-2 duration-300">Linscope v1</span>
        )}
      </div>

      <button 
        onClick={onToggleCollapse}
        className="absolute -right-3.5 top-8 w-7 h-7 rounded-full bg-[#2A2D3A] border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-[#3A3D4A] transition-all z-50 shadow-xl pointer-events-auto"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {realNavItems.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.id || (item.hasSubmenu && expandedSubmenu === item.id)
          const isSubExpanded = item.hasSubmenu && expandedSubmenu === item.id

          return (
            <div 
              key={item.id} 
              className="relative"
              onMouseEnter={() => collapsed && item.hasSubmenu && setHoveredItem(item.id)}
              onMouseLeave={() => collapsed && setHoveredItem(null)}
            >
              <button
                onClick={() => {
                  if (item.hasSubmenu && !collapsed) {
                    setExpandedSubmenu(isSubExpanded ? null : item.id)
                  } else {
                    onViewChange(item.id as ViewType)
                  }
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200
                  ${isActive 
                    ? 'bg-[#1E212B] text-white' 
                    : 'text-white/60 hover:bg-[#1E212B]/50 hover:text-white'
                  }
                  ${collapsed ? 'justify-center px-0 h-12 w-12 mx-auto' : ''}
                `}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="flex-shrink-0" />
                
                {!collapsed && (
                  <>
                    <span className="text-[15px] font-medium tracking-wide flex-1 text-left truncate">{item.label}</span>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-[#f97316]/20 text-[#f97316] flex-shrink-0">
                        {item.badge}
                      </span>
                    )}
                    {item.hasSubmenu && (
                      <ChevronRight size={14} className={`transition-transform duration-200 ${isSubExpanded ? 'rotate-90' : ''}`} />
                    )}
                  </>
                )}
              </button>

              {!collapsed && item.hasSubmenu && isSubExpanded && (
                <div className="pl-11 pr-2 py-1 space-y-1">
                  {item.subitems.map((sub, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => onSubItemClick?.(item.id, sub)}
                      className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-medium text-white/50 hover:text-white hover:bg-white/5"
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="p-4 mt-auto">
        <button
          onClick={() => onViewChange('settings')}
          className={`
            w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200
            ${activeView === 'settings' ? 'bg-[#1E212B] text-white' : 'text-white/60 hover:bg-[#1E212B]/50 hover:text-white'}
            ${collapsed ? 'justify-center px-0 h-12 w-12 mx-auto' : ''}
          `}
        >
          <Settings size={20} strokeWidth={2} />
          {!collapsed && <span className="text-[15px] font-medium tracking-wide">Settings</span>}
        </button>
      </div>
    </aside>
  )
}
