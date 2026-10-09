import { useEffect, useRef } from 'react';

const activeOverlays: string[] = [];

/**
 * Hook to handle closing a modal/view on mobile back button.
 * Pushes a state to history when open, and pops it when closed.
 */
export function useBackButton(isOpen: boolean, close: () => void) {
  const overlayId = useRef(Math.random().toString(36).substring(2, 9)).current;

  useEffect(() => {
    if (isOpen) {
      activeOverlays.push(overlayId);
      window.history.pushState({ overlayId }, '');
    } else {
      const index = activeOverlays.indexOf(overlayId);
      if (index !== -1) {
        activeOverlays.splice(index, 1);
        if (window.history.state?.overlayId === overlayId) {
          window.history.back();
        }
      }
    }

    // Cleanup if component unmounts while open
    return () => {
      const index = activeOverlays.indexOf(overlayId);
      if (index !== -1) {
        activeOverlays.splice(index, 1);
        // Do not call window.history.back() here because unmounting might be 
        // part of a broader navigation or app reload.
      }
    };
  }, [isOpen, overlayId]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isOpen) {
        // If the state we are navigating TO is our own state, we are being revealed, not popped.
        if (e.state?.overlayId === overlayId) {
          return;
        }

        // If we are navigating TO something else, and we were the top overlay, we must be the one getting popped.
        if (activeOverlays[activeOverlays.length - 1] === overlayId) {
          close();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, close, overlayId]);
}
