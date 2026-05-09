import React, { useState, useCallback, useMemo } from 'react'
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels'
import { usePanelState } from '../hooks/usePanelState'
import { Sidebar } from './Sidebar'
import { RightPanel } from './RightPanel'
import type { ViewType, LinEvent, Alert, AIProvider } from '../types'
import { LiveGraph } from './LiveGraph'
import { AIChat } from './AIChat'
import { AlertsPanel } from './AlertsPanel'
import { TimelineView } from './TimelineView'
import { ReplayView } from './ReplayView'
import { SettingsPanel } from './SettingsPanel'
import { VirtualEventFeed } from './VirtualEventFeed'

interface AppLayoutProps {
  connected: boolean
  eps: number
  events: LinEvent[]
  alerts: Alert[]
  activeAlertsCount: number
  acknowledgeAlert: (id: string) => void
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>
   aiProvider: AIProvider
   aiModel: string
   ollamaBaseUrl: string
}

export function AppLayout({ connected, eps, events, alerts, activeAlertsCount, acknowledgeAlert, setAlerts, aiProvider, aiModel, ollamaBaseUrl }: AppLayoutProps) {
  const { panelState, updatePanelState, toggleLeft, toggleRight, toggleSidebarCollapse } = usePanelState()
  const [activeView, setActiveView] = useState<ViewType>('graph')
  const [aiChatKey, setAiChatKey] = useState(0)

  const handleLeftResize = useCallback((size: number) => {
    updatePanelState({ leftWidth: size });
  }, [updatePanelState]);

  const handleRightResize = useCallback((size: number) => {
    updatePanelState({ rightWidth: size });
  }, [updatePanelState]);

  const handleSubItemClick = useCallback((itemId: string, subItem: string) => {
    if (itemId === 'ai') {
      setActiveView('ai')
      if (subItem === 'New Analysis') {
        setAiChatKey(prev => prev + 1)
      } else if (subItem === 'Saved Reports') {
        // In a real app, this would fetch saved chats. For now, we'll just show the AI view.
        console.log('Open Saved Reports')
      }
    }
  }, [])

  const mainContent = useMemo(() => {
    switch (activeView) {
      case 'graph':
        return <LiveGraph events={events} />
      case 'timeline':
        return <TimelineView events={events} />
      case 'replay':
        return <ReplayView events={events} />
      case 'alerts':
        return <AlertsPanel alerts={alerts} setAlerts={setAlerts} acknowledgeAlert={acknowledgeAlert} />
       case 'ai':
         return <AIChat events={events} key={`ai-${aiChatKey}`} provider={aiProvider} model={aiModel} ollamaBaseUrl={ollamaBaseUrl} />
      case 'settings':
        return <SettingsPanel />
      default:
        return <LiveGraph events={events} />
    }
  }, [activeView, events, aiChatKey])

  return (
    <div className="h-screen w-screen flex flex-col bg-bg-base text-text-primary font-sans overflow-hidden selection:bg-accent-blue/30">
      
      {/* Top Bar */}
      <header className="h-14 bg-[#0B0D14] flex items-center justify-between px-6 flex-shrink-0 z-50 border-b border-white/5">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleLeft}
            className={`p-2 rounded-xl transition-all ${panelState.leftOpen ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
            </svg>
          </button>
          <span className="text-sm font-semibold tracking-wide text-white/90">Linscope v1 Environment</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-[#1A1D27] px-4 py-1.5 rounded-full border border-white/5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[#00ff88] shadow-[0_0_8px_rgba(0,255,136,0.6)]' : 'bg-[#ff0044]'}`} />
              <span className={connected ? 'text-white' : 'text-[#ff0044]'}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            {connected && <div className="w-px h-3 bg-white/10" />}
            {connected && (
              <span className="text-xs font-mono text-white/70">
                {eps} <span className="text-white/40">EPS</span>
              </span>
            )}
          </div>

          <button
            onClick={toggleRight}
            className={`p-2 rounded-xl transition-all ${panelState.rightOpen ? 'text-white bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M15 3v18" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {panelState.leftOpen && (
          <div 
            style={{ width: panelState.sidebarCollapsed ? '80px' : '260px' }} 
            className="transition-all duration-300 ease-in-out bg-[#0B0D14] flex-shrink-0 z-[60] relative"
          >
            <Sidebar
              activeView={activeView}
              onViewChange={setActiveView}
              collapsed={panelState.sidebarCollapsed}
              onToggleCollapse={toggleSidebarCollapse}
              onSubItemClick={handleSubItemClick}
              alertsCount={activeAlertsCount}
            />
          </div>
        )}

        <PanelGroup direction="horizontal" className="h-full flex-1" id="main-layout-group">
          <Panel 
            id="sidebar-content-panel" 
            order={1} 
            defaultSize={panelState.rightOpen ? 75 : 100}
            minSize={20} 
            className="bg-[#0B0D14] p-2 relative"
          >
            <main className="h-full w-full overflow-hidden rounded-2xl border border-white/5 bg-[#12151F] shadow-2xl relative">
              {activeView === 'graph' ? (
                <PanelGroup direction="vertical" id="graph-layout-group">
                  <Panel id="graph-view-panel" order={1} defaultSize={65} minSize={30}>
                    {mainContent}
                  </Panel>
                  <PanelResizeHandle className="h-1 bg-white/5 hover:bg-white/10 transition-colors z-[60]" />
                  <Panel id="event-feed-panel" order={2} defaultSize={35} minSize={20}>
                    <VirtualEventFeed events={events} />
                  </Panel>
                </PanelGroup>
              ) : mainContent}
            </main>
          </Panel>

          {panelState.rightOpen && (
            <>
              <PanelResizeHandle className="w-1 bg-white/5 hover:bg-white/10 transition-colors z-[60]" />
              <Panel
                id="right-sidebar-panel"
                order={2}
                defaultSize={25}
                minSize={20}
                maxSize={45}
                onResize={handleRightResize}
                className="transition-all duration-300 ease-in-out bg-[#0B0D14]"
              >
                <div className="h-full py-2 pr-2">
                  <div className="h-full rounded-2xl border border-white/5 bg-[#12151F] overflow-hidden shadow-2xl">
                    <RightPanel events={events} />
                  </div>
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  )
}
