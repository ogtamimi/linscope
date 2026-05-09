import { useState, useCallback } from 'react';
import type { PanelState } from '../types';

export function usePanelState() {
  const [panelState, setPanelState] = useState<PanelState>({
    leftOpen: true,
    rightOpen: true,
    leftWidth: 20,
    rightWidth: 25,
    sidebarCollapsed: false,
  });

  const updatePanelState = useCallback((update: Partial<PanelState>) => {
    setPanelState(prev => ({ ...prev, ...update }));
  }, []);

  const toggleLeft = useCallback(() => {
    setPanelState(prev => ({ ...prev, leftOpen: !prev.leftOpen }));
  }, []);

  const toggleRight = useCallback(() => {
    setPanelState(prev => ({ ...prev, rightOpen: !prev.rightOpen }));
  }, []);

  const toggleSidebarCollapse = useCallback(() => {
    setPanelState(prev => ({ ...prev, sidebarCollapsed: !prev.sidebarCollapsed }));
  }, []);

  return {
    panelState,
    updatePanelState,
    toggleLeft,
    toggleRight,
    toggleSidebarCollapse,
  };
}
