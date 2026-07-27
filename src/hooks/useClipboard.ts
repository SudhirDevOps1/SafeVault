import { useState, useCallback, useRef, useEffect } from 'react';

export function useClipboard(clearAfterMs = 30000) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Clear clipboard automatically on unmount if a copy operation is pending
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        try {
          navigator.clipboard.writeText('');
        } catch {
          // Fallback text area clear for unmount context
          try {
            const textarea = document.createElement('textarea');
            textarea.value = '';
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          } catch {}
        }
      }
    };
  }, []);

  const copyToClipboard = useCallback(async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      timeoutRef.current = setTimeout(async () => {
        // Clear clipboard after timeout for security
        try {
          await navigator.clipboard.writeText('');
        } catch { /* ignore */ }
        setCopiedField(null);
      }, clearAfterMs);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedField(fieldName);
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        try {
          const textarea = document.createElement('textarea');
          textarea.value = '';
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        } catch { /* ignore */ }
        setCopiedField(null);
      }, clearAfterMs);
    }
  }, [clearAfterMs]);

  return { copiedField, copyToClipboard };
}
