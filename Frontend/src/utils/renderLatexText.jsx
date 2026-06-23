/**
 * renderLatexText — splits a plain text string on LaTeX delimiters
 * and returns a React element array with KaTeX-rendered math inline.
 *
 * Supports:
 *   \[ ... \]  display block math
 *   \( ... \)  inline math
 *
 * Usage:
 *   import renderLatexText from '../../utils/renderLatexText';
 *   <p>{renderLatexText(question)}</p>
 */

const DISPLAY_RE = /\\\[([\s\S]+?)\\\]/g;
const INLINE_RE  = /\\\(([\s\S]+?)\\\)/g;

// Unified regex: captures display (\[...\]) and inline (\(...\)) math
const MATH_RE = /(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;

function renderLatexText(text) {
  if (!text || typeof text !== 'string') return text;

  // Quick bail if no LaTeX present
  if (!text.includes('\\[') && !text.includes('\\(')) return text;

  const parts = text.split(MATH_RE);

  return parts.map((part, i) => {
    // Display math: \[ ... \]
    if (part.startsWith('\\[') && part.endsWith('\\]')) {
      const latex = part.slice(2, -2).trim();
      return renderKatex(latex, true, i);
    }
    // Inline math: \( ... \)
    if (part.startsWith('\\(') && part.endsWith('\\)')) {
      const latex = part.slice(2, -2).trim();
      return renderKatex(latex, false, i);
    }
    // Plain text
    return part || null;
  });
}

function renderKatex(latex, displayMode, key) {
  try {
    if (typeof window.katex === 'undefined') {
      // KaTeX not loaded yet — render as code fallback
      return (
        <code key={key} style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
          {displayMode ? `\\[${latex}\\]` : `\\(${latex}\\)`}
        </code>
      );
    }

    const html = window.katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
    });

    if (displayMode) {
      return (
        <span
          key={key}
          className="katex-display-inline"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    return (
      <span
        key={key}
        className="katex-inline"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return <span key={key}>{latex}</span>;
  }
}

export default renderLatexText;
