import re
from typing import Any, Dict, List


def parse_markdown_table(md: str) -> List[List[str]]:
    rows = []
    for line in md.strip().splitlines():
        line = line.strip()
        if not line.startswith("|"):
            continue
        parts = [c.strip() for c in line.strip("|").split("|")]
        rows.append(parts)
    return rows


def extract_tables_from_markdown(markdown: str) -> List[Dict[str, Any]]:
    tables = []
    lines = markdown.splitlines()
    i = 0
    page_guess = 1

    while i < len(lines):
        line = lines[i].rstrip()

        page_match = re.search(r"page\s+(\d+)", line, flags=re.I)
        if page_match:
            page_guess = int(page_match.group(1))

        if line.strip().startswith("|"):
            block = [line]
            j = i + 1
            while j < len(lines) and lines[j].strip().startswith("|"):
                block.append(lines[j].rstrip())
                j += 1

            if len(block) >= 2 and "---" in block[1]:
                md = "\n".join(block)
                tables.append({
                    "page_number": page_guess,
                    "source": "docling_markdown",
                    "markdown": md,
                    "rows": parse_markdown_table(md),
                })
                i = j
                continue

        i += 1

    return tables