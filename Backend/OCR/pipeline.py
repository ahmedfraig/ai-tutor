from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import time

from .image_utils import pdf_to_images, load_image
from .generation import run_batched_generation
from .quality import resolve_params

def process_file(
    path: str,
    cfg: Dict[str, Any],
    model,
    processor,
    device: str,
    eos_id: int,
    pad_id: int,
    quality: Optional[str] = None,
) -> Dict[str, Any]:

    params = resolve_params(cfg, quality)
    poppler_path = cfg["pdf"].get("poppler_path")

    p = Path(path)
    start_total = time.perf_counter()

    if p.suffix.lower() == ".pdf":
        images = pdf_to_images(str(p), dpi=params.dpi, long_side=params.long_side, poppler_path=poppler_path)
        page_numbers = list(range(1, len(images) + 1))
    else:
        images = load_image(str(p), long_side=params.long_side)
        page_numbers = [1]

    md_pages: List[str] = []
    per_page_times: List[float] = []

    for i in range(0, len(images), params.batch_size):
        batch_imgs = images[i:i + params.batch_size]
        batch_pages = page_numbers[i:i + params.batch_size]

        decoded, elapsed = run_batched_generation(
            batch_imgs, batch_pages,
            processor=processor, model=model, device=device,
            eos_id=eos_id, pad_id=pad_id,
            max_new_tokens=params.max_new_tokens,
        )

        md_pages.extend([t.strip() for t in decoded])
        each = elapsed / max(1, len(batch_pages))
        per_page_times.extend([each] * len(batch_pages))

    total_time = time.perf_counter() - start_total

    return {
        #"pages": md_pages,
        "markdown": "\n\n".join(md_pages),
        # "stats": {
        #     "num_pages": len(md_pages),
        #     "avg_time_per_page_sec": round(sum(per_page_times) / max(1, len(per_page_times)), 2),
        #     "total_runtime_sec": round(total_time, 2),
        #     "quality": quality,
        #     "params": params.__dict__,
        # }
    }
