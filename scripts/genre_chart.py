import csv
from collections import defaultdict
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
from pathlib import Path

OUT = Path(r"C:\Users\Ken\DrKenReid.github.io\blog\img")

with open(r"C:\Users\Ken\Downloads\goodreads_library_export.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

rated = [r for r in rows if r.get("My Rating") and int(r["My Rating"]) > 0]

genres = defaultdict(list)
for r in rated:
    g = r.get("genres", "").split("|")[0].split(",")[0].strip() if r.get("genres") else ""
    if g:
        genres[g].append(int(r["My Rating"]))

# Filter 10+ books, sort by avg
data = [(g, sum(v)/len(v), len(v)) for g, v in genres.items() if len(v) >= 10]
data.sort(key=lambda x: x[1])

fig, ax = plt.subplots(figsize=(8, 5))
colors = ["#fc6060" if avg >= 4.0 else "#aaa" for _, avg, _ in data]
ax.barh([f"{g} ({n})" for g, _, n in data], [avg for _, avg, _ in data], color=colors, edgecolor="white")
for i, (g, avg, n) in enumerate(data):
    ax.text(avg + 0.02, i, f"{avg:.2f}", va='center', fontsize=10, fontweight='bold')
ax.set_xlabel("Average Rating")
ax.set_title("My Avg Rating by Genre (10+ books)", fontsize=14, fontweight='bold')
ax.set_xlim(3.0, 4.5)
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "genre_rating_bias.png", dpi=150)
plt.close()
print("Done")
