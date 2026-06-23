import { useEffect } from 'react';

/**
 * useLatex — triggers KaTeX auto-render on a DOM element after content changes.
 *
 * Usage:
 *   const ref = useRef(null);
 *   useLatex(ref, [dependency]);   // re-runs when dependency changes
 *
 * Supports:
 *   \[ ... \]   display math  (block equations)
 *   \( ... \)   inline math
 *
 * Safe to call even if KaTeX hasn't loaded yet — waits for the
 * 'katex-ready' event dispatched by the auto-render CDN script.
 */
function useLatex(ref, deps = []) {
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;

    const render = () => {
      if (typeof window.renderMathInElement !== 'function') return;
      try {
        window.renderMathInElement(el, {
          delimiters: [
            { left: '\\[', right: '\\]', display: true  },  // display math
            { left: '\\(', right: '\\)', display: false },  // inline math
          ],
          throwOnError: false,   // never crash the page on bad LaTeX
          strict: false,
        });
      } catch (e) {
        console.warn('[useLatex] KaTeX render error:', e);
      }
    };

    if (window.__katexReady) {
      // KaTeX already loaded — render immediately
      render();
    } else {
      // Wait for KaTeX to signal it's ready
      document.addEventListener('katex-ready', render, { once: true });
      return () => document.removeEventListener('katex-ready', render);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default useLatex;
