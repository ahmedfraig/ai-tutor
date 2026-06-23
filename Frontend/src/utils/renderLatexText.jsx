/**
 * renderLatexText — renders a plain text / markdown string as React nodes
 * with full support for:
 *   - LaTeX math:  $...$  $$...$$  \(...\)  \[...\]
 *   - Bold:        **text**
 *   - Italic:      *text*
 *   - Lists:       - item  /  1. item
 *   - Code:        `code`
 *   - Headings:    # H1  ## H2  etc.
 *   - Line breaks
 *
 * Powered by react-markdown + remark-math + rehype-katex.
 *
 * Usage:
 *   import renderLatexText from '../../utils/renderLatexText';
 *   <p>{renderLatexText(question)}</p>
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * Main export — call with a string, get React nodes back.
 * Returns the original value unchanged if it's not a string.
 */
function renderLatexText(text) {
  if (!text || typeof text !== 'string') return text;

  // Pre-process: convert \[...\] and \(...\) to $$...$$ and $...$ respectively,
  // because remark-math only recognises $/$$ delimiters by default.
  let processed = text;
  // Display math: \[...\] → $$...$$
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  // Inline math: \(...\) → $...$
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        // Render paragraphs as spans to avoid nesting <p> inside <p>/<h3>/etc.
        p: ({ children }) => <span className="md-paragraph">{children}</span>,
      }}
    >
      {processed}
    </ReactMarkdown>
  );
}

export default renderLatexText;
