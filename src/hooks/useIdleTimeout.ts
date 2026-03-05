import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds

export const useIdleTimeout = () => {
  const { logout, user } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (user) {
      timeoutRef.current = setTimeout(() => {
        console.log('User idle for 30 minutes, logging out...');
        logout();
      }, IDLE_TIMEOUT);
    }
  };

  useEffect(() => {
    if (!user) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      return;
    }

    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    const handleEvent = () => {
      resetTimer();
    };

    // Initialize timer
    resetTimer();

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleEvent);
    });

    return () => {
      // Cleanup
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleEvent);
      });
    };
  }, [user, logout]);
};
