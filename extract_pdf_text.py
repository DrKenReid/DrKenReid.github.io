import importlib.util, subprocess, sys
from pathlib import Path

pdf_path = Path(r"C:\Users\Ken\Desktop\Basic_science_and_clinical_application_of_the_Cont.pdf")
py = Path(r"c:/Users/Ken/DrKenReid.github.io/.venv/Scripts/python.exe")
pip = Path(r"c:/Users/Ken/DrKenReid.github.io/.venv/Scripts/pip.exe")

libs = [
    ("pdfminer.six", "pdfminer"),
    ("PyPDF2", "pypdf2"),
    ("pdfplumber", "pdfplumber"),
]

def ensure_package(pkg, module_name):
    if importlib.util.find_spec(module_name) is None:
        subprocess.check_call([str(pip), "install", pkg])

for pkg, mod in libs:
    try:
        ensure_package(pkg, mod)
        if mod == "pdfminer":
            from pdfminer.high_level import extract_text
            text = extract_text(str(pdf_path))
            print(text)
            sys.exit(0)
        elif mod == "pypdf2":
            import PyPDF2
            out = []
            with open(pdf_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    out.append(page.extract_text() or "")
            print("\n".join(out))
            sys.exit(0)
        elif mod == "pdfplumber":
            import pdfplumber
            out = []
            with pdfplumber.open(str(pdf_path)) as pdf:
                for page in pdf.pages:
                    out.append(page.extract_text() or "")
            print("\n".join(out))
            sys.exit(0)
    except Exception as e:
        last_error = f"{pkg} failed: {e}"

print(last_error, file=sys.stderr)
sys.exit(1)
