// src/hooks/useKeyboardShortcuts.js
import { useEffect, useCallback } from 'react';

export const useKeyboardShortcuts = (shortcuts) => {
  const handleKeyDown = useCallback((event) => {
    const { ctrlKey, metaKey, shiftKey, altKey, key } = event;
    const modifierKey = ctrlKey || metaKey;
    
    shortcuts.forEach(({ keys, action, preventDefault = true }) => {
      const [modifier, mainKey] = keys.split('+');
      
      let shouldTrigger = false;
      
      if (modifier === 'ctrl' && modifierKey && key.toLowerCase() === mainKey.toLowerCase()) {
        shouldTrigger = true;
      } else if (modifier === 'shift' && shiftKey && key.toLowerCase() === mainKey.toLowerCase()) {
        shouldTrigger = true;
      } else if (modifier === 'alt' && altKey && key.toLowerCase() === mainKey.toLowerCase()) {
        shouldTrigger = true;
      } else if (key.toLowerCase() === keys.toLowerCase()) {
        shouldTrigger = true;
      }
      
      if (shouldTrigger) {
        if (preventDefault) event.preventDefault();
        action(event);
      }
    });
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};