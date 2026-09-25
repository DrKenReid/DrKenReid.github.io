"""The weekly refresh and the reading page count reading sessions the same way.

Two programs count reading sessions from data/books.json. The weekly
refresh (refresh_books.sessions, in Python) writes data/reading.json,
whose thisYear no page displays today (the homepage reads only its books
and reviews figures); the reading page's "this year" and its calendar
count in the browser (krBookshelf.sessions, in js/bookshelf.js). Both
must count a re-read once per finish and leave out a book known only by
the date it was added; if either rule drifted, reading.json would give
one number for this year and the reading page another, and any page
that started showing thisYear would disagree with the calendar. This
runs the JS in Node against the same file and compares every year, not
only the current one.

Skipped where Node is not installed; CI installs it.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import json
import shutil
import subprocess
import sys
import unittest
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import refresh_books as rb  # noqa: E402

ROOT = rb.ROOT
NODE = shutil.which("node")

# Loads bookshelf.js in a vm with a stub window (it sets krBookshelf before
# it touches the document) and prints finishes per year as JSON.
JS = r"""
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = process.argv[1];
const ctx = { window: {}, krBookTitle: (t) => ({ title: t, series: '' }) };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'bookshelf.js'), 'utf8'), ctx);
const books = JSON.parse(fs.readFileSync(path.join(root, 'data', 'books.json'), 'utf8'));
const perYear = {};
for (const b of books.filter((b) => b && b.t)) {
    for (const s of ctx.window.krBookshelf.sessions(b)) {
        const y = String(s).slice(0, 4);
        perYear[y] = (perYear[y] || 0) + 1;
    }
}
process.stdout.write(JSON.stringify(perYear));
"""


@unittest.skipUnless(NODE, "node is not installed")
class ReadingParity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.books = json.loads((ROOT / "data" / "books.json").read_text(encoding="utf-8"))
        cls.reading = json.loads((ROOT / "data" / "reading.json").read_text(encoding="utf-8"))
        out = subprocess.run([NODE, "-e", JS, str(ROOT)], capture_output=True, text=True,
                             encoding="utf-8", check=True).stdout
        cls.js_per_year = json.loads(out)

    def python_per_year(self):
        return Counter(s[:4] for b in self.books if b.get("t") for s in rb.sessions(b))

    def test_every_year_agrees(self):
        self.assertEqual(dict(self.python_per_year()), self.js_per_year)

    def test_the_homepage_figure_is_the_reading_page_figure(self):
        # reading.json's thisYear is for the year of its last refresh.
        year = self.reading["updated"][:4]
        self.assertEqual(self.reading["thisYear"], self.js_per_year.get(year, 0))
        refreshed = date.fromisoformat(self.reading["updated"])
        self.assertEqual(rb.summarise(self.books, refreshed)["thisYear"], self.reading["thisYear"])


if __name__ == "__main__":
    unittest.main()
