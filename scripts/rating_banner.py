import csv
from collections import Counter
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
from pathlib import Path

OUT = Path(r"C:\Users\Ken\DrKenReid.github.io\blog\img")
with open(r"C:\Users\Ken\Downloads\goodreads_library_export.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
rated = [r for r in rows if r.get("My Rating") and int(r["My Rating"]) > 0]

BG = "#1e1e1e"
FG = "#e0e0e0"
RED = "#fc6060"

fig, ax = plt.subplots(figsize=(16, 6))
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
dist = Counter(int(r["My Rating"]) for r in rated)
stars = [1,2,3,4,5]
counts = [dist.get(s, 0) for s in stars]
colors = ["#555","#555","#777","#999",RED]
ax.bar([f"{s}\u2605" for s in stars], counts, color=colors, edgecolor=BG, linewidth=2, width=0.6)
for i, c in enumerate(counts):
    ax.text(i, c + 5, str(c), ha='center', fontsize=16, fontweight='bold', color=FG)
ax.set_ylabel("Books", fontsize=14, color=FG)
ax.set_title("My Rating Distribution (569 books)", fontsize=20, fontweight='bold', color=FG, pad=20)
ax.tick_params(colors=FG, labelsize=14)
for s in ax.spines.values(): s.set_color("#333")
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "rating_distribution_banner.png", dpi=200)
plt.close()
print("Done")
