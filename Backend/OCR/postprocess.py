import re
from typing import List
# ---------- Post-processing: strip leaks, enforce header + Visual format ----------

ROLE_LINE = re.compile(r"(?im)^\s*(system|user|assistant)\b.*$")
RULES_BLOCK = re.compile(
    r"(?is)(You are an OCR|Rules:|Extract the page|Output format:)[\s\S]*?(?=#\s*Page|\Z)"
)
ANY_RULES = re.compile(r"(?is)(You are an OCR|Rules:|Output format:)[\s\S]+$")
PAGE_HEADER = re.compile(r"(?im)^[^\n#]*#\s*Page\s*(\d+).*$")
MD_FENCE = re.compile(r"(?m)^\s*```.*$")
BACKTICKS = re.compile(r"`{3,}")
EXTRANEOUS_QUOTES = re.compile(r"^[\"'>\s]+(.*)$")
BLANK_COLLAPSE = re.compile(r"\n{3,}")
REF_TAGS = re.compile(r"</?ref[^>]*>", re.IGNORECASE)
BARE_PAGE_LINE = re.compile(r"(?im)^\s*Page\s+\d+\s*$")

# New: remove any big leaked block that starts at `<|grounding|>` and runs up
# to the next "# Page ..." (or end of text).
GROUNDING_BLOCK = re.compile(
    r"(?is)<\|grounding\|>.*?(?=^#\s*Page\b|\Z)", re.MULTILINE
)

# Lines that sometimes leak; nuke them if they appear (updated to match the new wording).
INSTR_LINES = [
    # generic instruction spill patterns
    r"Then write all visible text on the page as Markdown\.?",
    r"For every diagram, figure, image, chart, table, or equation, illustrative description:?\.?",
    r"Visual:\s*<Short Title>\s*—\s*<20–80 words.*?>",
    r"For multi-panel visuals, emit separate lines,.*",
    r"Do not include system(?:/| or )user text, metadata, or URLs\.?",
    r"Transcribe ALL visible text faithfully(?: as Markdown)?\.?",
    r"Preserve headings, lists, tables if obvious\.?",
    r"Extract (?:the page|text) as Markdown \(no backticks, no JSON, no extra explanations\)\.?",
    r"Keep lists and tables if clear\.?",
    r"Begin with '# Page \{page_number\}'\.?",
    r"Return ONLY Markdown \(no backticks, no JSON, no extra explanations\)\.?",
    r"Describe any diagrams\. Do not only copy captions\. Add a 'Visual:' line\.",
    r"Visual:\s*<Short Title>\s*—\s*<20-200 words describing what it shows:.*$",

    # explicit SYSTEM_MD spill patterns
    r"<\|grounding\|>.*$",
    r"Convert this document to comprehensive Markdown with high accuracy\.?",
    r"\*\*TEXT & STRUCTURE:\*\*.*$",
    r"\*\*MATHEMATICAL CONTENT:\*\*.*$",
    r"\*\*TABLES:\*\*.*$",
    r"\*\*DIAGRAMS & FIGURES:\*\*.*$",
    r"\*\*DOCUMENT FLOW:\*\*.*$",
]

INSTR_RE = re.compile(r"(?im)^\s*(?:" + "|".join(INSTR_LINES) + r")\s*$")


def enforce_page_header(md: str, page_no: int) -> str:
    """
    Ensure the first non-empty line is '# Page N' and normalize any variants
    of that header to the canonical form.
    """
    s = (md or "").strip()
    if not s:
        return f"# Page {page_no}"

    lines = s.splitlines()
    cleaned_lines = []
    header_found = False

    for ln in lines:
        stripped = ln.strip()
        if not stripped and not header_found:
            # skip leading blank lines
            continue

        match = PAGE_HEADER.match(stripped)
        if match:
            if not header_found:
                cleaned_lines.append(f"# Page {page_no}")
                header_found = True
            continue  # skip any redundant page header

        cleaned_lines.append(ln)

    result = "\n".join(cleaned_lines).strip()
    if not header_found:
        return f"# Page {page_no}\n\n{result}" if result else f"# Page {page_no}"
    return result


def normalize_visual_lines(md: str) -> str:
    """
    Normalize 'Visual:' lines to a single well-formed line, ensure an em dash
    between title and description, and ensure trailing punctuation.
    """
    lines = md.splitlines()
    out: List[str] = []

    in_visual_block = False
    current_visual_line = ""

    for ln in lines:
        stripped = ln.strip()

        # start of a new visual block
        if stripped.lower().startswith("visual"):
            if in_visual_block:
                current_visual_line += " " + stripped
            else:
                if current_visual_line:
                    out.append(current_visual_line.strip())
                current_visual_line = stripped
                in_visual_block = True
            continue

        # continuation of a visual block
        if in_visual_block and stripped:
            current_visual_line += " " + stripped
            continue

        # leaving visual block
        if current_visual_line:
            out.append(current_visual_line.strip())
            current_visual_line = ""
        in_visual_block = False
        out.append(ln)

    if current_visual_line:
        out.append(current_visual_line.strip())

    final_out: List[str] = []
    for ln in out:
        stripped = ln.strip()
        if stripped.lower().startswith("visual"):
            # remove quotes/markers
            ln_clean = EXTRANEOUS_QUOTES.sub(r"\1", stripped)
            # normalize "Visual:"
            ln_clean = re.sub(r"(?i)^visual\s*:", "Visual:", ln_clean)

            # Ensure "Visual: <title> — <desc>"
            if "—" not in ln_clean:
                # Visual: title - desc
                m_dash = re.match(r"(Visual:\s*)(.+?)\s+-\s+(.+)$", ln_clean)
                if m_dash:
                    prefix, title_part, desc_part = m_dash.groups()
                    ln_clean = f"{prefix}{title_part} — {desc_part}"
                else:
                    # Visual: title desc
                    m_space = re.match(r"(Visual:\s*)(.+?)\s+(.+)$", ln_clean)
                    if m_space:
                        prefix, title_part, desc_part = m_space.groups()
                        ln_clean = f"{prefix}{title_part} — {desc_part}"
                    else:
                        # fallback: keep whatever and add a placeholder
                        ln_clean = re.sub(
                            r"(Visual:\s*)(.+)$",
                            r"Visual: \2 — (descriptive explanation)",
                            ln_clean,
                        )

            # Ensure it ends with punctuation
            if not ln_clean.rstrip().endswith((".", "!", "?")):
                ln_clean += "."

            final_out.append(ln_clean)
        else:
            final_out.append(ln)

    return "\n".join(final_out)


def clean_qwen_echo(md: str, page_no: int) -> str:
    """
    Remove echoed roles, rules (including SYSTEM_MD spills), and fences,
    normalize Visual lines, and ensure a canonical '# Page N' header.
    Returns pure Markdown.
    """
    s = (md or "").replace("\u200b", "").strip()
    if not s:
        return f"# Page {page_no}"

    # Remove any large `<|grounding|> ... # Page` block first
    s = GROUNDING_BLOCK.sub("", s)

    s = REF_TAGS.sub("", s)
    s = ROLE_LINE.sub("", s)
    s = RULES_BLOCK.sub("", s)
    s = ANY_RULES.sub("", s)
    s = MD_FENCE.sub("", s)
    s = BACKTICKS.sub("", s)

    # Strip any leaked instruction lines or bare "Page N" lines
    s = "\n".join(ln for ln in s.splitlines() if not INSTR_RE.match(ln.strip()))
    s = "\n".join(ln for ln in s.splitlines() if not BARE_PAGE_LINE.match(ln.strip()))

    # Collapse big blank chunks
    s = BLANK_COLLAPSE.sub("\n\n", s).strip()

    # Normalize Visual blocks and page header
    s = normalize_visual_lines(s)
    s = enforce_page_header(s, page_no)

    # Final cleanup of extra blanks
    s = BLANK_COLLAPSE.sub("\n\n", s).strip()
    return s
