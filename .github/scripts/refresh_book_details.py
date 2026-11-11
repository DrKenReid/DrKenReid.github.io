"""
Give every book in data/books.json the year it first came out (y) and a
genre or two (gn), for the filters and sorts on books.html.

    python .github/scripts/refresh_book_details.py               # ask about new books, write
    python .github/scripts/refresh_book_details.py --dry-run     # ask, write nothing
    python .github/scripts/refresh_book_details.py --offline     # no network: apply what is on file
    python .github/scripts/refresh_book_details.py --export FILE # seed from a Goodreads export, no network

It runs weekly in the live-data workflow, after refresh_books.py, so a
book marked read on Goodreads gets both on its own. Standard library only.

Where the two come from, best first:

    year   1. data/book-overrides.json, by hand
           2. a Goodreads library export: "Original Publication Year",
              else the edition's "Year Published" (--export)
           3. the read-shelf feed's book_published, which refresh_books.py
              writes as y for a new book (and never over a year on file)
           4. Open Library's first_publish_year for the work
    genre  1. data/book-overrides.json, by hand
           2. the genres readers shelve the book under on Goodreads, with
              their votes: the "genres" column of an export enhanced with
              Enhance-GoodReads-Export (--export)
           3. Open Library's subjects for the work

What was learned is kept in data/book-details.json, one entry a book by
Goodreads id: the year and where it came from, the labels (a Goodreads
genre and its votes, or an Open Library subject counted once) and where
they came from, and the day Open Library was last asked. That file is the
cache: a book with an entry is not asked about again, so a normal Monday
asks only about the week's new books. A book Open Library could not place
is asked again after RETRY_DAYS. The labels are kept as they arrived, not
as genres, so a change to the table below reaches every book on the next
run without asking anyone anything.

The genres (GENRES, in the order the page lists them) and how a label
becomes one (RULES): each label is matched whole, in lower case, against
the rules in order, and the first rule it matches decides it; a rule with
no genre shadows the ones after it ("history and criticism" is not
history, "progression fantasy" is LitRPG before it is fantasy). A
Goodreads label with under GENRE_MIN_SHARE of the top label's votes is
left out, as stray shelving. Each genre scores the weight of its labels;
the best is the book's genre, and the runner-up joins it when it scores
at least SECOND_SHARE of the best (a horror novel with a strong science
fiction following is both). LitRPG and progression fantasy, which
readers shelve as "Fantasy" first, take the first place at a much lower
share (NARROW), with the best other genre second. WEAK labels
("Classics", "Fiction", "Short Stories") count only for a book no strong
label places. One genre or two, never more; a book nothing places has
none and shows under no genre filter until data/book-overrides.json
places it.

Network rules (lookup): a pause of OL_PAUSE seconds between requests, up
to OL_TRIES attempts at one with a longer wait before each, a generic
User-Agent, at most MAX_LOOKUPS a run (the rest wait a week), and a
failure is a warning: the book stays unasked and is tried next time.
After OL_GIVE_UP failures in a row the run stops asking, so a host that
is down cannot use up the job's time. The script exits 0 whatever Open
Library does, so it never fails the job.

Stages, so the rules can be tested without a network:

    from_export(rows, books)     pure: entries from an export's rows
    genres_of(labels)            pure: the table, labels -> genre keys
    needs_lookup(entry, b, day)  pure: whether to ask Open Library
    lookup(b, fetch)             the network: an entry's labels and year
    apply(books, details, over)  pure: books.json with y and gn
"""
from __future__ import annotations

import csv
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402
import refresh_books  # noqa: E402  (books.json's reader and writer)

ROOT = sitelib.ROOT
BOOKS = refresh_books.BOOKS
DETAILS = ROOT / "data" / "book-details.json"
OVERRIDES = ROOT / "data" / "book-overrides.json"

# --- the genres ----------------------------------------------------------------

# Key (the URL's ?genre= and books.json's gn) and the name js/bookwall.js
# gives it. The order is the page's.
GENRES = (
    ("fantasy", "Fantasy"),
    ("litrpg", "LitRPG and progression"),
    ("scifi", "Science fiction"),
    ("horror", "Horror"),
    ("crime", "Crime and thriller"),
    ("literary", "Literary fiction"),
    ("history", "History"),
    ("science", "Science and technology"),
    ("philosophy", "Philosophy and religion"),
    ("psychology", "Psychology and self-help"),
    ("biography", "Biography and memoir"),
    ("politics", "Politics and society"),
)
GENRE_KEYS = tuple(k for k, _ in GENRES)

# (pattern, genre key or None). A label is lower case with hyphens and
# underscores as spaces; the pattern must match all of it. First match
# wins, so the narrow rules come before the broad ones.
RULES = (
    # Not genres, or not the book's: a study of a novel, a subject heading
    # about how a theme appears in fiction, an age band, a format.
    (r"history and criticism|criticism|.* in (literature|fiction)|literary criticism", None),
    (r"(young adult|juvenile|children'?s|middle grade|teen|ya)( fiction| literature)?", None),
    (r"science fiction and fantasy|sci fi fantasy|fantasy sci ?fi|sff|speculative fiction", None),
    # LitRPG and its neighbours, before fantasy claims "progression fantasy".
    (r"lit ?rpg|gamelit|game lit|litrpg .*|progression( fantasy)?|cultivation|xianxia|wuxia"
     r"|isekai|dungeon core|system apocalypse|portal fantasy litrpg", "litrpg"),
    (r"(epic |high |urban |dark |grimdark |cozy |heroic |historical |military |comic )?fantasy"
     r"|fantasy fiction|fiction,? fantasy.*|.*fantasy fiction|fantastic fiction|sword and sorcery"
     r"|magic|dragons?|fairy tales?|fairies|wizards|elves|mythology|witches", "fantasy"),
    (r"(hard |military |classic )?science fiction|sci ?fi|sf|space opera|dystopi(a|an|as)"
     r"|cyberpunk|time travel|(post )?apocalyptic|aliens?|space|robots|artificial intelligence fiction"
     r"|fiction,? science fiction.*|.*science fiction|extraterrestrial.*|interplanetary.*", "scifi"),
    (r"horror|horror (tales|fiction)|fiction,? horror.*|ghost stories|zombies?|gothic"
     r"|lovecraftian|weird fiction|haunted.*", "horror"),
    (r"mystery|mysteries|mystery thriller|thrillers?|psychological thriller|crime|true crime"
     r"|suspense|noir|espionage|spy|detective.*|fiction,? (thrillers?|mystery|crime|suspense).*"
     r"|.*detective and mystery stories|serial murderers?", "crime"),
    (r"literary fiction|literary|historical fiction|contemporary( fiction)?|magical realism"
     r"|classic literature|fiction,? (literary|historical|psychological|war).*"
     r"|war( fiction)?|plays|drama|poetry|satire|southern gothic|domestic fiction"
     r"|psychological fiction|booker prize", "literary"),
    # "Historical" alone is shelved on novels and on histories alike.
    (r"historical", None),
    (r"natural history", "science"),
    # Non-fiction: politics and psychology before science, so "political
    # science" and "cognitive science" land where a reader would look.
    (r"politics|political science|economics|sociology|feminism|race|racism|social justice"
     r"|anarchism|socialism|marxism|capitalism|law|society|social (science|issues)"
     r"|current affairs|journalism|activism|government|world politics|policy|globalization", "politics"),
    (r"psychology|.* psychology|self help|self improvement|personal development|productivity"
     r"|business|leadership|management|communication|public speaking|mental health"
     r"|cognitive science|behavioral economics|decision making|relationships|parenting"
     r"|personal finance|habits|motivation|writing|education|career|negotiation", "psychology"),
    (r"(auto)?biograph(y|ies)|memoirs?|biography (&|and) autobiography.*|diaries|personal narratives?"
     r"|.*biography", "biography"),
    (r"history|.* history|world war (i|ii|1|2|one|two)|ancient|medieval"
     r"|.* -- history|civilization|archaeology", "history"),
    (r"science|popular science|physics|biology|chemistry|astronomy|mathematics|maths?"
     r"|evolution|neuroscience|.*medicine|medical|genetics|nature"
     r"|technology|tech|computer science|computers?|computing|programming|software"
     r"|machine learning|artificial intelligence|data science|engineering|ecology|environment"
     r"|health|food|nutrition|cosmology|climate( change)?|operating systems.*", "science"),
    (r"philosophy|.* philosophy|stoicism|ethics|religion|spirituality|buddhism|christianity"
     r"|theology|meditation|atheism|mindfulness|existentialism", "philosophy"),
)
_RULES = tuple((re.compile(p), g) for p, g in RULES)

# Labels that say "fiction" and little more. They place a book only when
# nothing stronger does: a classic shelved only as a classic, fiction and
# short stories is literary fiction. "Non-fiction" alone places nothing:
# a lecture series shelved only so stays unplaced (an override can place
# it).
WEAK = (
    (r"classics?|fiction|fiction,? general|short stor(y|ies)|novels?|novellas?|literature"
     r"|anthologies|(english|american|british|irish|scottish) (fiction|literature)"
     r"|fiction in english|.* \(fictional works.*", "literary"),
)
_WEAK = tuple((re.compile(p), g) for p, g in WEAK)

# A Goodreads label below this share of the top label's votes is left
# out (the same cut GoodReads-Analysis uses for its genre figures).
GENRE_MIN_SHARE = 0.10
# The runner-up joins the top genre at this share of its score or more.
SECOND_SHARE = 0.40
# LitRPG and progression fantasy are shelved under the broad "Fantasy"
# (or "Sci Fi") first and their own names well below it: Cradle's books
# have a fifth as many "Litrpg" and "Progression Fantasy" votes as
# "Fantasy", Dungeon Crawler Carl's a quarter to a half. So the narrow
# genre takes the first place whenever it reaches this share of the best
# score (an eighth: a space opera with a few such votes stays out), and
# the best of the others is second.
NARROW = {"litrpg": 0.125}
# Labels kept a book: of Goodreads', the ones that can count (see
# GENRE_MIN_SHARE); of Open Library's subjects, which can run to a
# hundred, mostly places and characters, the ones the table reads first.
KEEP_LABELS = 20


def label_key(label: str) -> str:
    """A label as the rules read it: lower case, accents off, hyphens and
    underscores as spaces, runs of spaces as one."""
    s = unicodedata.normalize("NFKD", str(label or ""))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return " ".join(re.sub(r"[-_]+", " ", s).split())


def genre_of_label(label: str) -> tuple[str | None, bool]:
    """(genre key or None, weak?) for one label."""
    key = label_key(label)
    for rx, g in _RULES:
        if rx.fullmatch(key):
            return g, False
    for rx, g in _WEAK:
        if rx.fullmatch(key):
            return g, True
    return None, False


def genres_of(labels) -> list[str]:
    """The book's genre keys, best first: one, two, or none.

    `labels` is [[label, weight], ...] as data/book-details.json keeps
    them. See the module docstring for the rules.
    """
    labels = [(str(l), int(w or 0)) for l, w in (labels or []) if l]
    if not labels:
        return []
    top = max(w for _, w in labels)
    strong: dict[str, int] = {}
    weak: dict[str, int] = {}
    for label, w in labels:
        if top and w < GENRE_MIN_SHARE * top:
            continue
        g, is_weak = genre_of_label(label)
        if g:
            bucket = weak if is_weak else strong
            bucket[g] = bucket.get(g, 0) + max(w, 1)
    scores = strong or weak
    if not scores:
        return []
    order = sorted(scores, key=lambda g: (-scores[g], GENRE_KEYS.index(g)))
    for narrow, share in NARROW.items():
        if narrow in order[1:] and scores[narrow] >= share * scores[order[0]]:
            return [narrow, order[0]]
    best = order[:1]
    if len(order) > 1 and scores[order[1]] >= SECOND_SHARE * scores[order[0]]:
        best.append(order[1])
    return best


# --- the export ----------------------------------------------------------------

def year_of(value) -> int | None:
    """'1954', '1954.0' -> 1954; anything that is not a year -> None."""
    m = re.fullmatch(r"\s*(-?\d{1,4})(\.0+)?\s*", str(value or ""))
    if not m:
        return None
    y = int(m.group(1))
    return y if 0 < y <= 9999 else None


def export_labels(cell: str) -> list[list]:
    """An enhanced export's genres cell, 'Fantasy|311;Cultivation|98',
    as [["Fantasy", 311], ["Cultivation", 98]]: the first name of each
    entry (the rest are its synonyms) and its votes, most first, without
    those too few to count (GENRE_MIN_SHARE)."""
    out = []
    for entry in str(cell or "").split(";"):
        entry = entry.strip()
        if not entry:
            continue
        names, sep, votes = entry.rpartition("|")
        if not sep:
            names, votes = entry, ""
        name = names.split(",")[0].strip()
        if name:
            out.append([name, int(votes) if votes.strip().isdigit() else 0])
    out.sort(key=lambda lw: -lw[1])
    top = out[0][1] if out else 0
    return [lw for lw in out if lw[1] >= GENRE_MIN_SHARE * top][:KEEP_LABELS]


def from_export(rows, books: list[dict]) -> dict[str, dict]:
    """Entries for the books on file from a Goodreads export's rows (dicts
    keyed by the export's column names), by Goodreads id. The year is the
    original publication year, else the edition's; the labels need the
    enhanced export's genres column, and a book with none there gets
    only its year."""
    on_file = {b["g"] for b in books if b.get("g")}
    out: dict[str, dict] = {}
    for row in rows:
        g = str(row.get("Book Id") or "").strip()
        if g not in on_file:
            continue
        e: dict = {"g": g}
        y = year_of(row.get("Original Publication Year")) or year_of(row.get("Year Published"))
        if y:
            e["year"] = y
            e["yearFrom"] = "export"
        labels = export_labels(row.get("genres", ""))
        if labels:
            e["labels"] = labels
            e["labelsFrom"] = "export"
        if len(e) > 1:
            out[g] = e
    return out


def merge_entries(old: dict[str, dict], new: dict[str, dict]) -> dict[str, dict]:
    """`old` with each of `new`'s fields laid over it: an export speaks for
    what it has, and what it lacks (a book with no genres in it) keeps
    what was learned before."""
    out = {g: dict(e) for g, e in old.items()}
    for g, e in new.items():
        out.setdefault(g, {"g": g}).update(e)
    return out


# --- Open Library ----------------------------------------------------------------

OL_SEARCH = "https://openlibrary.org/search.json?"
OL_FIELDS = "key,title,author_name,first_publish_year,subject"
# Says what is asking and nothing about who.
OL_UA = "Mozilla/5.0 (compatible; book-details-lookup)"
OL_TIMEOUT = 20      # seconds for one answer
OL_TRIES = 3         # attempts at one request, a longer wait before each
OL_PAUSE = 1.0       # seconds between two requests
MAX_LOOKUPS = 60     # books asked about in one run; the rest wait a week
OL_GIVE_UP = 3       # failures in a row before the rest wait a week (a host that is down)
RETRY_DAYS = 90      # a book Open Library could not place is asked again after this


class AskError(RuntimeError):
    """Open Library could not be asked just now (not: it had no answer)."""


def fetch_json(url: str, sleep=time.sleep) -> dict:
    """The JSON `url` answers with, or AskError after OL_TRIES tries
    at an answer that may differ next time (a timeout, a reset, a 5xx, a
    429). Any other refusal is believed at once."""
    why = "no answer"
    for attempt in range(OL_TRIES):
        if attempt:
            sleep(2 ** attempt)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": OL_UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=OL_TIMEOUT) as r:
                return json.loads(r.read(2_000_000).decode("utf-8"))
        except urllib.error.HTTPError as e:
            why = "HTTP %d" % e.code
            if e.code < 500 and e.code != 429:
                break
        except Exception as e:  # noqa: BLE001 - a timeout, a reset, bad JSON
            why = "%s: %s" % (type(e).__name__, e)
    raise AskError(why)


def plain_title(t: str) -> str:
    """A shelf title as a search: no series in brackets, no subtitle."""
    t = re.sub(r"\s*\([^)]*#[^)]*\)\s*$", "", str(t or ""))
    t = re.sub(r"\s*\([^)]*\)\s*$", "", t)
    return t.split(":")[0].strip() or str(t or "").strip()


def name_key(name: str) -> str:
    """An author's name as a key, as authorKey in js/bookwall.js has it."""
    s = unicodedata.normalize("NFKD", str(name or ""))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "", s)


def surname_key(name: str) -> str:
    parts = re.findall(r"[a-z0-9]+", label_key(name))
    return parts[-1] if parts else ""


def pick(docs: list[dict], b: dict, by_isbn: bool) -> dict | None:
    """The search result that is this book. An ISBN search names the
    edition, so its work is taken as it is. A title search needs the
    book's author first among the result's authors (by full name, or by
    surname when the shelf spells the rest differently); the most
    relevant such result wins, a matching title first."""
    if by_isbn:
        return docs[0] if docs else None
    want, want_surname = name_key(b.get("a")), surname_key(b.get("a"))
    title = label_key(plain_title(b.get("t")))
    candidates = []
    for d in docs:
        authors = d.get("author_name") or []
        if not authors:
            continue
        first = authors[0]
        if name_key(first) == want or (want_surname and surname_key(first) == want_surname):
            candidates.append(d)
    for d in candidates:
        if label_key(plain_title(d.get("title"))) == title:
            return d
    return candidates[0] if candidates else None


def lookup(b: dict, fetch=None, sleep=time.sleep) -> dict:
    """What Open Library says of book `b`: {} when it has no such book,
    else {"year": ..., "labels": [[subject, 1], ...]} with what it has.
    Raises AskError when it could not be asked."""
    fetch = fetch or (lambda url: fetch_json(url, sleep=sleep))
    doc = None
    if b.get("i"):
        data = fetch(OL_SEARCH + urllib.parse.urlencode(
            {"isbn": b["i"], "fields": OL_FIELDS, "limit": 1}))
        doc = pick(data.get("docs") or [], b, by_isbn=True)
        if doc is None:
            sleep(OL_PAUSE)
    if doc is None:
        q = "%s %s" % (plain_title(b.get("t")), b.get("a") or "")
        data = fetch(OL_SEARCH + urllib.parse.urlencode(
            {"q": q.strip(), "fields": OL_FIELDS, "limit": 10}))
        doc = pick(data.get("docs") or [], b, by_isbn=False)
    if doc is None:
        return {}
    out: dict = {}
    y = year_of(doc.get("first_publish_year"))
    if y:
        out["year"] = y
    subjects = [s for s in (doc.get("subject") or []) if isinstance(s, str) and s.strip()]
    # Kept are the subjects the table can read first, then the rest, so
    # the cap never drops the one that places the book.
    placed = [s for s in subjects if genre_of_label(s)[0]]
    rest = [s for s in subjects if s not in placed]
    if subjects:
        out["labels"] = [[s, 1] for s in (placed + rest)[:KEEP_LABELS]]
    return out


def needs_lookup(entry: dict | None, b: dict, today: date) -> bool:
    """True when Open Library should be asked about book `b`: something
    is missing (labels, or a year the record has none of either), and it
    has not been asked, or was asked more than RETRY_DAYS ago."""
    e = entry or {}
    missing = not e.get("labels") or not (e.get("year") or b.get("y"))
    if not missing:
        return False
    asked = e.get("asked")
    if not asked:
        return True
    try:
        return date.fromisoformat(asked) + timedelta(days=RETRY_DAYS) <= today
    except ValueError:
        return True


def learn(entry: dict | None, g: str, found: dict, today: date) -> dict:
    """The entry after asking: what was missing filled from `found`, never
    what an export said, and the day it was asked."""
    e = dict(entry or {"g": g})
    if found.get("labels") and not e.get("labels"):
        e["labels"] = found["labels"]
        e["labelsFrom"] = "openlibrary"
    if found.get("year") and not e.get("year"):
        e["year"] = found["year"]
        e["yearFrom"] = "openlibrary"
    e["asked"] = today.isoformat()
    return e


# --- applying ---------------------------------------------------------------------

# A record's keys in the order refresh_books.merge_one() writes them, so
# a record reads the same whichever of the two scripts wrote it last.
KEY_ORDER = ("t", "a", "r", "v", "i", "g", "c", "k", "s", "n", "y", "gn", "w", "d", "e", "p", "m")


def ordered(b: dict) -> dict:
    rank = {k: i for i, k in enumerate(KEY_ORDER)}
    return dict(sorted(b.items(), key=lambda kv: rank.get(kv[0], len(rank))))


def apply(books: list[dict], details: dict[str, dict], overrides: dict[str, dict]) -> list[dict]:
    """books.json with each record's y and gn as the sources say (module
    docstring, best first). Pure. A record nothing speaks for keeps the
    y it has (the feed's) and has no gn."""
    out = []
    for b in books:
        e = details.get(b.get("g")) or {}
        o = overrides.get(b.get("g")) or {}
        nb = {k: v for k, v in b.items() if k not in ("y", "gn")}
        y = o.get("y")
        if not y and e.get("yearFrom") == "export":
            y = e.get("year")
        y = y or b.get("y") or e.get("year")
        if y:
            nb["y"] = int(y)
        gn = list(o.get("gn") or []) or genres_of(e.get("labels"))
        if gn:
            nb["gn"] = gn[:2]
        out.append(ordered(nb))
    return out


# --- files ---------------------------------------------------------------------------

def load_details(path: Path = None) -> dict[str, dict]:
    path = path or DETAILS
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {e["g"]: e for e in data.get("books") or [] if e.get("g")}


def dump_details(details: dict[str, dict]) -> str:
    """One entry a line, by Goodreads id, so a week's change is a few lines."""
    entry_order = ("g", "year", "yearFrom", "labels", "labelsFrom", "asked")
    lines = []
    for g in sorted(details, key=lambda g: (len(g), g)):
        e = details[g]
        e = {k: e[k] for k in entry_order if k in e}
        lines.append(json.dumps(e, ensure_ascii=False, separators=(",", ":")))
    return '{"books":[\n' + ",\n".join(lines) + "\n]}\n"


def load_overrides(path: Path = None) -> dict[str, dict]:
    """data/book-overrides.json by Goodreads id. A genre the table does
    not have is dropped with a warning, so a typo never reaches a page."""
    path = path or OVERRIDES
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    out = {}
    for o in data.get("books") or []:
        g = str(o.get("g") or "")
        if not g:
            continue
        gn = [k for k in o.get("gn") or [] if k in GENRE_KEYS]
        bad = [k for k in o.get("gn") or [] if k not in GENRE_KEYS]
        if bad:
            print("::warning::book-overrides.json: %s has no genre %s" % (g, ", ".join(bad)))
        entry = {}
        if gn:
            entry["gn"] = gn
        if year_of(o.get("y")):
            entry["y"] = year_of(o.get("y"))
        out[g] = entry
    return out


def read_export(path: Path) -> list[dict]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def coverage(books: list[dict]) -> str:
    return "%d books: %d with a year, %d with a genre (%d with two)" % (
        len(books), sum(1 for b in books if b.get("y")), sum(1 for b in books if b.get("gn")),
        sum(1 for b in books if len(b.get("gn") or []) > 1))


# --- entry point ---------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    ap = sitelib.arg_parser(__doc__)
    ap.add_argument("--dry-run", action="store_true", help="ask, report, write nothing")
    ap.add_argument("--offline", action="store_true", help="ask no one: apply what is on file")
    ap.add_argument("--export", type=Path, metavar="CSV",
                    help="seed data/book-details.json from a Goodreads export (no network)")
    ap.add_argument("--max", type=int, default=MAX_LOOKUPS, help="books to ask about this run")
    args = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")

    if not BOOKS.exists():
        print("no books.json; nothing to do")
        return 0
    books = json.loads(BOOKS.read_text(encoding="utf-8"))
    details = load_details()
    overrides = load_overrides()
    today = date.today()

    if args.export:
        seeded = from_export(read_export(args.export), books)
        details = merge_entries(details, seeded)
        print("export: %d of %d books found, %d with genres"
              % (len(seeded), len(books), sum(1 for e in seeded.values() if e.get("labels"))))
    elif not args.offline:
        asked = found = failed_in_a_row = 0
        # A book whose override names its genres and that has a year
        # needs nothing Open Library could add.
        due = [b for b in books if b.get("g") and needs_lookup(details.get(b["g"]), b, today)
               and not ((overrides.get(b["g"]) or {}).get("gn") and (b.get("y") or overrides[b["g"]].get("y")))]
        for b in due[:max(args.max, 0)]:
            if failed_in_a_row >= OL_GIVE_UP:
                print("::warning::Open Library failed %d times in a row; the rest wait for the next run"
                      % OL_GIVE_UP)
                break
            if asked:
                time.sleep(OL_PAUSE)
            asked += 1
            try:
                got = lookup(b)
            except AskError as e:
                failed_in_a_row += 1
                print("::warning::Open Library, %s (%s): %s; asked again next run" % (b.get("t"), b["g"], e))
                continue
            except Exception as e:  # noqa: BLE001 - one book never fails the job
                print("::warning::Open Library, %s (%s): %s: %s" % (b.get("t"), b["g"], type(e).__name__, e))
                continue
            failed_in_a_row = 0
            found += bool(got)
            details[b["g"]] = learn(details.get(b["g"]), b["g"], got, today)
        if len(due) > asked:
            print("%d more books wait for the next run" % (len(due) - asked))
        print("Open Library: asked about %d books, found %d" % (asked, found))

    new_books = apply(books, details, overrides)
    print(coverage(new_books))
    if args.dry_run:
        changed = sum(1 for a, b in zip(books, new_books) if a != b)
        print("dry run: %d records would change" % changed)
        return 0
    text = dump_details(details)
    if not DETAILS.exists() or DETAILS.read_text(encoding="utf-8") != text:
        refresh_books.write_whole(DETAILS, text.encode("utf-8"))
    if new_books != books:
        refresh_books.write_books(new_books)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
