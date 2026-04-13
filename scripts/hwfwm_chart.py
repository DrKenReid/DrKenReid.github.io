import csv, re
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
from pathlib import Path

OUT = Path(r"C:\Users\Ken\DrKenReid.github.io\blog\img")
with open(r"C:\Users\Ken\Downloads\goodreads_library_export.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
rated = [r for r in rows if r.get("My Rating") and int(r["My Rating"]) > 0]

books = []
for r in rated:
    m = re.search(r'\(He Who Fights with Monsters,\s*#(\d+)\)', r["Title"])
    if m:
        books.append((int(m.group(1)), int(r["My Rating"])))
books.sort()

fig, ax = plt.subplots(figsize=(10, 4))
nums = [b[0] for b in books]
rats = [b[1] for b in books]
ax.plot(nums, rats, 'o-', color="#fc6060", linewidth=2, markersize=8)
ax.set_xlabel("Book #")
ax.set_ylabel("My Rating")
ax.set_title("He Who Fights with Monsters: The Mid-Series Dip", fontsize=14, fontweight='bold')
ax.set_ylim(0.5, 5.5)
ax.set_yticks([1,2,3,4,5])
ax.set_xticks(nums)
ax.spines[['top','right']].set_visible(False)
plt.tight_layout()
plt.savefig(OUT / "hwfwm_drift.png", dpi=150)
plt.close()
print("Done")
