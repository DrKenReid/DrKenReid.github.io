import importlib.util
import subprocess
import sys
from pathlib import Path

pdf_path = Path(r"C:\Users\Ken\Desktop\edu-a0037478.pdf")
out_path = Path(r"C:\Users\Ken\DrKenReid.github.io\edu-a0037478_extracted.txt")
py = Path(r"C:\Users\Ken\DrKenReid.github.io\.venv\Scripts\python.exe")
pip = Path(r"C:\Users\Ken\DrKenReid.github.io\.venv\Scripts\pip.exe")

libs = [
    ("pdfminer.six", "pdfminer"),
    ("PyPDF2", "PyPDF2"),
    ("pdfplumber", "pdfplumber"),
]

last_error = None

def ensure_package(pkg, module_name):
    if importlib.util.find_spec(module_name) is None:
        subprocess.check_call([str(pip), "install", pkg])

for pkg, mod in libs:
    try:
        ensure_package(pkg, mod)
        if mod == "pdfminer":
            from pdfminer.high_level import extract_text
            text = extract_text(str(pdf_path))
        elif mod == "PyPDF2":
            import PyPDF2
            parts = []
            with open(pdf_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    parts.append(page.extract_text() or "")
            text = "\n".join(parts)
        elif mod == "pdfplumber":
            import pdfplumber
            parts = []
            with pdfplumber.open(str(pdf_path)) as pdf:
                for page in pdf.pages:
                    parts.append(page.extract_text() or "")
            text = "\n".join(parts)
        out_path.write_text(text, encoding="utf-8")
        print(f"SUCCESS_METHOD={pkg}")
        print(f"OUTPUT_FILE={out_path}")
        print(f"TEXT_LENGTH={len(text)}")
        sys.exit(0)
    except Exception as e:
        last_error = f"{pkg} failed: {e}"

print(last_error, file=sys.stderr)
sys.exit(1)
