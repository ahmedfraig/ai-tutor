/**
 * renderLatexText — splits a plain text string on LaTeX delimiters
 * and returns an array of React nodes with KaTeX-rendered math.
 *
 * Supports ALL common delimiters produced by AI models:
 *   $$  ... $$    display block math  (most common from AI)
 *   \[  ... \]    display block math
 *   $   ... $     inline math
 *   \(  ... \)    inline math
 *
 * Key correctness guarantees:
 *   - $$ is always checked before $ (greedy outer match wins)
 *   - When $$ and $ both start at the same index, $$ wins
 *   - Unclosed delimiters are emitted as raw text (no crash)
 *   - Empty latex strings are skipped
 *
 * Usage:
 *   import renderLatexText from '../../utils/renderLatexText';
 *   <p>{renderLatexText(question)}</p>
 */

import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Order matters: MUST list $$ before $ so that when both match
// at the same index, the longer/higher-priority delimiter wins.
const DELIMITERS = [
  { left: '$$',  right: '$$',  display: true  },
  { left: '\\[', right: '\\]', display: true  },
  { left: '\\(', right: '\\)', display: false },
  { left: '$',   right: '$',   display: false },
];

/**
 * Main export — call with a string, get React nodes back.
 * Returns the original value unchanged if it's not a string
 * or contains no recognised LaTeX delimiters.
 */
function renderLatexText(text) {
  if (!text || typeof text !== 'string') return text;

  // If no LaTeX delimiters, still process markdown formatting (bold, newlines)
  const hasLatex = DELIMITERS.some(d => text.includes(d.left));
  if (!hasLatex) return renderFormattedText(text);

  // nodes holds alternating strings and {latex, displayMode} objects
  const nodes = [];
  let remaining = text;

  while (remaining.length > 0) {
    // ── Find the earliest-starting delimiter ───────────────────────────
    // When two delimiters start at the same index (e.g. $ and $$ both at 0),
    // the one listed FIRST in the DELIMITERS array wins because we use
    // strict-less-than on the index AND check in priority order.
    let best = null;
    let bestIdx = Infinity;

    for (const delim of DELIMITERS) {
      const idx = remaining.indexOf(delim.left);
      if (idx === -1) continue;

      // Strictly less-than: first delim in array wins ties ($$  beats $)
      if (idx < bestIdx) {
        bestIdx = idx;
        best = delim;
      }
    }

    if (best === null) {
      // No more delimiters — push remaining text and stop
      nodes.push(remaining);
      break;
    }

    // Push plain text that precedes the opening delimiter
    if (bestIdx > 0) {
      nodes.push(remaining.slice(0, bestIdx));
    }

    // Advance past the opening delimiter
    const afterLeft = remaining.slice(bestIdx + best.left.length);

    // Find the matching closing delimiter
    const endIdx = afterLeft.indexOf(best.right);

    if (endIdx === -1) {
      // Unclosed delimiter — emit raw text and stop
      nodes.push(remaining.slice(bestIdx));
      break;
    }

    const latex = afterLeft.slice(0, endIdx).trim();
    remaining = afterLeft.slice(endIdx + best.right.length);

    // Skip empty delimiters (e.g. $$$$)
    if (latex.length === 0) continue;

    // Store as object — key assigned in the final .map() below
    nodes.push({ latex, display: best.display });
  }

  // Single plain-text segment — process formatting and return
  if (nodes.length === 1 && typeof nodes[0] === 'string') return renderFormattedText(nodes[0]);

  // All siblings share the same index-based key space — no conflicts.
  return nodes.map((n, i) =>
    typeof n === 'string'
      ? <React.Fragment key={i}>{renderFormattedText(n)}</React.Fragment>
      : renderKatex(n.latex, n.display, i)
  );
}

/**
 * Render a single LaTeX expression to a React span using KaTeX.
 * `key` must be supplied by the caller (comes from the outer .map index).
 */
function renderKatex(latex, displayMode, key) {
  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: false,
    });

    return (
      <span
        key={key}
        className={displayMode ? 'katex-display-wrap' : 'katex-inline'}
        style={displayMode ? {
          display: 'block',
          textAlign: 'center',
          margin: '0.75em 0',
          overflowX: 'auto',
        } : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    // Malformed LaTeX — show raw text so content isn't lost
    return <span key={key} className="katex-error">{latex}</span>;
  }
}

/**
 * Process markdown-style formatting in a plain text string:
 *   **bold**  → <strong>
 *   newlines  → <br />
 *
 * Returns the original string if no formatting is found, or an array
 * of React nodes with the appropriate elements.
 */
function renderFormattedText(text) {
  if (!text || typeof text !== 'string') return text;

  const hasBold = text.includes('**');
  const hasNewline = text.includes('\n');
  if (!hasBold && !hasNewline) return text;

  // First split on **bold** markers
  const boldParts = text.split(/(\*\*[^*]+\*\*)/);

  const nodes = [];
  let key = 0;

  for (const part of boldParts) {
    if (!part) continue;

    if (part.startsWith('**') && part.endsWith('**')) {
      // Bold segment — also process newlines inside it
      const inner = part.slice(2, -2);
      if (inner.includes('\n')) {
        const lines = inner.split('\n');
        nodes.push(
          <strong key={key++}>
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </strong>
        );
      } else {
        nodes.push(<strong key={key++}>{inner}</strong>);
      }
    } else if (part.includes('\n')) {
      // Plain text with newlines
      const lines = part.split('\n');
      lines.forEach((line, li) => {
        if (li > 0) nodes.push(<br key={key++} />);
        if (line) nodes.push(<React.Fragment key={key++}>{line}</React.Fragment>);
      });
    } else {
      nodes.push(<React.Fragment key={key++}>{part}</React.Fragment>);
    }
  }

  return nodes.length === 1 ? nodes[0] : nodes;
}

export default renderLatexText;
