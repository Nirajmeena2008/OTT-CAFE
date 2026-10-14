import { useEffect, useRef, useCallback } from 'react';

type HistoryState = {
  type: 'modal' | 'view' | 'expanded' | 'search';
  key: string;
  data?: any;
};

type HistoryEntry = {
  state: HistoryState;
  timestamp: number;
};

/**
 * Custom hook to manage browser history for SPA navigation
 * Handles modals, expanded sections, view changes, and search states
 * Allows back button to work naturally on mobile/desktop
 */
export function useBrowserHistory() {
  const historyStack = useRef<HistoryEntry[]>([]);
  const isHandlingPopState = useRef(false);
  const currentStateKey = useRef<string | null>(null);

  // Push a new history entry
  const pushHistory = useCallback((state: HistoryState) => {
    if (isHandlingPopState.current) return;
    
    const entry: HistoryEntry = {
      state,
      timestamp: Date.now(),
    };
    
    historyStack.current.push(entry);
    currentStateKey.current = `${state.type}:${state.key}`;
    
    // Push to browser history
    window.history.pushState(entry, '', window.location.href);
  }, []);

  // Replace current history entry
  const replaceHistory = useCallback((state: HistoryState) => {
    if (isHandlingPopState.current) return;
    
    const entry: HistoryEntry = {
      state,
      timestamp: Date.now(),
    };
    
    historyStack.current[historyStack.current.length - 1] = entry;
    currentStateKey.current = `${state.type}:${state.key}`;
    
    window.history.replaceState(entry, '', window.location.href);
  }, []);

  // Go back in history
  const goBack = useCallback(() => {
    if (historyStack.current.length > 1) {
      historyStack.current.pop(); // Remove current
      const previous = historyStack.current[historyStack.current.length - 1];
      isHandlingPopState.current = true;
      window.history.back();
      // Reset flag after a tick
      setTimeout(() => { isHandlingPopState.current = false; }, 0);
      return previous.state;
    }
    return null;
  }, []);

  // Clear history for a specific type (e.g., close all modals)
  const clearHistoryType = useCallback((type: HistoryState['type']) => {
    historyStack.current = historyStack.current.filter(
      entry => entry.state.type !== type
    );
  }, []);

  // Check if there's history for a specific type
  const hasHistoryType = useCallback((type: HistoryState['type']) => {
    return historyStack.current.some(entry => entry.state.type === type);
  }, []);

  // Get current state
  const getCurrentState = useCallback(() => {
    if (historyStack.current.length > 0) {
      return historyStack.current[historyStack.current.length - 1].state;
    }
    return null;
  }, []);

  // Listen for popstate (browser back/forward buttons)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && historyStack.current.length > 0) {
        isHandlingPopState.current = true;
        // Find the matching entry in our stack
        const index = historyStack.current.findIndex(
          e => e.timestamp === event.state?.timestamp
        );
        if (index !== -1) {
          // Truncate stack to this point
          historyStack.current = historyStack.current.slice(0, index + 1);
        }
        setTimeout(() => { isHandlingPopState.current = false; }, 0);
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initialize with current state if empty
    if (historyStack.current.length === 0) {
      const initialState: HistoryEntry = {
        state: { type: 'view', key: 'home' },
        timestamp: Date.now(),
      };
      historyStack.current.push(initialState);
      window.history.replaceState(initialState, '', window.location.href);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return {
    pushHistory,
    replaceHistory,
    goBack,
    clearHistoryType,
    hasHistoryType,
    getCurrentState,
    historyStack: historyStack.current,
  };
}

/**
 * Hook for managing modal history
 */
export function useModalHistory(modalKey: string, isOpen: boolean, onClose: () => void) {
  const { pushHistory, clearHistoryType, hasHistoryType } = useBrowserHistory();

  useEffect(() => {
    if (isOpen) {
      pushHistory({ type: 'modal', key: modalKey });
    } else {
      // Only clear if this modal was the last one
      const current = hasHistoryType('modal');
      if (current) {
        clearHistoryType('modal');
      }
    }
  }, [isOpen, modalKey, pushHistory, clearHistoryType, hasHistoryType]);

  // Handle back button for this modal
  useEffect(() => {
    if (!isOpen) return;

    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.type === 'modal' && event.state.key === modalKey) {
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, modalKey, onClose]);
}

/**
 * Hook for managing expanded section history
 */
export function useExpandedHistory(sectionKey: string, isExpanded: boolean, onToggle: () => void) {
  const { pushHistory, clearHistoryType, hasHistoryType } = useBrowserHistory();

  useEffect(() => {
    if (isExpanded) {
      pushHistory({ type: 'expanded', key: sectionKey });
    } else {
      clearHistoryType('expanded');
    }
  }, [isExpanded, sectionKey, pushHistory, clearHistoryType]);

  useEffect(() => {
    if (!isExpanded) return;

    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.type === 'expanded' && event.state.key === sectionKey) {
        onToggle();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isExpanded, sectionKey, onToggle]);
}

/**
 * Hook for managing view history (e.g., offer combo view, admin dashboard)
 */
export function useViewHistory(viewKey: string, isActive: boolean, onDeactivate: () => void) {
  const { pushHistory, replaceHistory, clearHistoryType, hasHistoryType } = useBrowserHistory();

  useEffect(() => {
    if (isActive) {
      // Replace current view state
      replaceHistory({ type: 'view', key: viewKey });
    } else {
      clearHistoryType('view');
      // Restore home view
      replaceHistory({ type: 'view', key: 'home' });
    }
  }, [isActive, viewKey, pushHistory, replaceHistory, clearHistoryType]);

  useEffect(() => {
    if (!isActive) return;

    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.type === 'view' && event.state.key === viewKey) {
        onDeactivate();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isActive, viewKey, onDeactivate]);
}