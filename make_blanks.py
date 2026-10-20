"""Create blank copies of PSPDFKit-flattened C.A.R. forms.

PSPDFKit flattens filled fields into page-level Form XObjects named FFT0, FFT1, ...
Removing the `/FFTn Do` operators leaves the underlying blank form. Originals are
opened read-only; output goes to a separate folder.

usage: python make_blanks.py <src_dir> <out_dir> [--render <png_dir>]
"""
import re
import sys
from pathlib import Path

import pymupdf

FFT_DO = re.compile(rb"/FFT\d+\s+Do")


def blank_pdf(src: Path, dst: Path) -> int:
    doc = pymupdf.open(src)
    removed = 0
    for page in doc:
        for xref in page.get_contents():
            data = doc.xref_stream(xref)
            new, n = FFT_DO.subn(b"", data)
            if n:
                doc.update_stream(xref, new)
                removed += n
    # drop signature/form widgets and any metadata pointing at the filled version
    for page in doc:
        for w in list(page.widgets() or []):
            page.delete_widget(w)
    doc.set_metadata({})
    if removed:
        doc.save(dst, garbage=4, deflate=True)
    doc.close()
    return removed


def main():
    src_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    png_dir = Path(sys.argv[sys.argv.index("--render") + 1]) if "--render" in sys.argv else None
    out_dir.mkdir(parents=True, exist_ok=True)
    if png_dir:
        png_dir.mkdir(parents=True, exist_ok=True)
    for src in sorted(src_dir.glob("*.pdf")):
        dst = out_dir / src.name
        n = blank_pdf(src, dst)
        status = f"blanked ({n} overlays removed)" if n else "SKIPPED - no FFT overlays (not a flattened C.A.R. form)"
        print(f"{src.name:14} {status}")
        if n and png_dir:
            with pymupdf.open(dst) as d:
                d[0].get_pixmap(dpi=60).save(png_dir / f"{src.stem}_blank.png")
            with pymupdf.open(src) as d:
                d[0].get_pixmap(dpi=60).save(png_dir / f"{src.stem}_orig.png")


if __name__ == "__main__":
    main()
