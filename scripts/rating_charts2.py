import csv, re
from collections import defaultdict
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
from pathlib import Path

OUT = Path(r"C:\Users\Ken\DrKenReid.github.io\blog\img")
with open(r"C:\Users\Ken\Downloads\goodreads_library_export.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
rated = [r for r in rows if r.get("My Rating") and int(r["My Rating"]) > 0]
RED = "#fc6060"

# Page count vs rating
fig, ax = plt.subplots(figsize=(8, 4))
buckets = [("<200", 0, 200), ("200-400", 200, 400), ("400-600", 400, 600), ("600+", 600, 99999)]
labels, avgs, ns = [], [], []
for label, lo, hi in buckets:
    vals = [int(r["My Rating"]) for r in rated if r.get("Number of Pages") and r["Number of Pages"].isdigit() and lo <= int(r["Number of Pages"]) < hi]
    if vals:
        labels.append(f"{label}\n(n={len(vals)})")
        avgs.append(sum(vals)/len(vals))
        ns.append(len(vals))
bars = ax.bar(labels, avgs, color=[RED if a >= 4.0 else "#aaa" for a in avgs], edgecolor="white", linewidth=1.5)
for bar, val in zip(bars, avgs):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02, f"{val:.2f}", ha='center', fontsize=11, fontweight='bold')
ax.set_ylabel("My Avg Rating")
ax.set_title("Rating by Page Count (Survivorship Bias?)", fontsize=14, fontweight='bold')
ax.set_ylim(3.4, 4.5)
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "page_count_rating.png", dpi=150)
plt.close()

# Series drift: Dresden Files
fig, ax = plt.subplots(figsize=(10, 4))
series_books = []
for r in rated:
    m = re.search(r'\(The Dresden Files,\s*#(\d+)\)', r["Title"])
    if m:
        series_books.append((int(m.group(1)), int(r["My Rating"]), r["Title"].split("(")[0].strip()))
series_books.sort()
nums = [b[0] for b in series_books]
rats = [b[1] for b in series_books]
ax.plot(nums, rats, 'o-', color=RED, linewidth=2, markersize=8)
ax.set_xlabel("Book #")
ax.set_ylabel("My Rating")
ax.set_title("The Dresden Files: A Rollercoaster in Stars", fontsize=14, fontweight='bold')
ax.set_ylim(0.5, 5.5)
ax.set_yticks([1,2,3,4,5])
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "dresden_drift.png", dpi=150)
plt.close()

print("Done")
