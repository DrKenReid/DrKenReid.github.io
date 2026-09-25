#!/usr/bin/env python3
"""The docs and the code comments name files that exist, and nothing private.

    python .github/scripts/check_docs.py           # report what it finds
    python .github/scripts/check_docs.py --check   # exit 1 if anything is found
    python .github/scripts/check_docs.py --list    # every path it read, and where

Why. The developer docs (.github/docs/), the README and the comments in the
site's own scripts send the next reader to files by path: "the markup is in
style.css §11", "run .github/scripts/generate_post_head.py --fix", "see
js/kr-viz.js". A rename that leaves one of those behind sends that reader to
a file that is not there, and nothing else notices: the component doc sat in
blog/ for months after the audit had stopped pointing at it, and two
stylesheet comments still gave the carousel script's old path long after it
moved under js/default-assets/.

WHAT IT READS

  .github/docs/*.md and README.md
      Every code span and fenced block, and every relative link target.
      A link is resolved from the Markdown file's own folder, as GitHub
      resolves it.
  Comments and docstrings
      in the first-party scripts (js/*.js, js/default-assets/*.js and the
      service worker, sw.js; the minified vendor files and js/vendor/ are
      not ours), the Python under .github/scripts/ and tests/, the
      workflows and hooks under .github/, and style.css. Only the
      comments: a path in code is the code's business, and a wrong one
      fails at run time.
  Never read: post prose (blog/*.html) and blog/downloads/, which are
  writing for readers, not instructions for maintainers.

WHAT COUNTS AS A PATH

  A word whose first folder is one git tracks at the top of the
  repository (js/, data/, .github/ and so on), with a leading /, ./ or one
  ../ taken off (a post's ../js/x.js is the site's js/x.js), and any query,
  #fragment or :line suffix dropped. In the Markdown, a bare file name with
  a site extension (`posts.json`, `style.min.css`) counts too, and must be
  the name of some tracked file. It must name a tracked file or folder:
  tracked rather than on disk, so a run here and a run in CI, which has no
  untracked files, give the same answer. A glob (`blog/*.html`) must match
  at least one tracked file. A word holding a <placeholder> is a pattern,
  not a path, and is skipped: write `img/og/<slug>.jpg` for "any post's
  share card", never a made-up slug. So is a file named by one letter
  (blog/x.html, hero/N.webp), the usual way to write an example.

  In a comment, a site-absolute URL (/blog/nope.html) is not checked. It
  is what a browser asks for, and comments name wrong ones on purpose: the
  URL the 404 page is served at, the path a fixed bug used to request.
  The docs have no such case, so there it is checked like any other path.

WHAT IS NEVER NAMED

  Tracked text is public, and some files beside it are not: private
  maintenance notes and tools, and the untracked drafts. A pointer to one
  of them is a dead link to everyone else, so these fail wherever they
  appear in the scope:

  - the names in PRIVATE_ALWAYS below: the publishing checklist (the one
    private file the tracked .gitignore already names) and the folder of
    local tools;
  - every plain name in this clone's .git/info/exclude, read at run time.
    That file is where private files are kept out of git without a
    tracked .gitignore line announcing them, so it is the list of what
    must not be named, and this script never has to spell those names
    out itself. It is the one rule that can differ between a laptop and
    CI, on purpose: in CI the file is empty, and a private name can only
    be written by someone who has the private file, whose pre-commit
    hook runs this check.
  - the drafts folder. It is a path the code handles (the site root from
    a draft preview, the prerender rules, the --drafts modes), so a
    comment may name blog/drafts/ as a folder; it may not point at a
    file in it. The docs do not name it at all.

  Also refused: review ids (a number and a letter, like 10a, after the
  word "review" or alone in brackets, several joined by slashes; see
  REVIEW_IDS). They were labels from one review of the code, meaningless
  once that review closed; a comment says the reason itself instead.

Exit status: 0 when nothing is found (or without --check), 1 with --check
when anything is, 2 on a bad flag.
"""
from __future__ import annotations

import ast
import bisect
import fnmatch
import functools
import io
import re
import subprocess
import sys
import tokenize
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT

# --- scope ---------------------------------------------------------------

DOC_GLOBS = ("README.md", ".github/docs/*.md")
# (pathspec, language). git pathspecs: * crosses folders.
COMMENT_GLOBS = (
    ("js/*.js", "js"),
    ("sw.js", "js"),
    ("style.css", "css"),
    (".github/scripts/*.py", "py"),
    ("tests/*.py", "py"),
    (".github/hooks/*", "hash"),
    (".github/workflows/*.yml", "hash"),
)
# Third-party code inside js/: the minified libraries and js/vendor/.
# alime.bundle.js is two vendor plugins under a header of ours; its
# comments are the plugins' own.
NOT_OURS = re.compile(r"(\.min\.js$|^js/vendor/|^js/alime\.bundle\.js$)")

# A bare file name in the docs counts as a path when it ends in one of
# these, so `posts.json` must be some tracked file's name.
FILE_EXTS = {"html", "js", "css", "json", "py", "md", "yml", "yaml", "xml",
             "txt", "webp", "png", "jpg", "svg", "woff2", "pdf"}

# --- what is never named ---------------------------------------------------

PRIVATE_ALWAYS = [
    (re.compile(r"\bPUBLISHING\.md\b"), "names the private publishing notes"),
    (re.compile(r"scripts-local\b"), "names scripts-local/, which is not in the repository"),
]


def local_excludes() -> list[tuple[re.Pattern, str]]:
    """The rules for this clone's .git/info/exclude (see WHAT IS NEVER
    NAMED), or none where git or the file is missing."""
    try:
        out = subprocess.run(["git", "rev-parse", "--git-path", "info/exclude"],
                             cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return []
    path = Path(out) if Path(out).is_absolute() else ROOT / out
    if not path.exists():
        return []
    return exclude_rules(path.read_text(encoding="utf-8", errors="replace"))


def exclude_rules(text: str) -> list[tuple[re.Pattern, str]]:
    """A rule for every plain name in an exclude file's text. Globs and
    negations are skipped: they describe shapes of files, not a name a
    sentence would write. A folder entry ('notes/') matches the folder's
    name followed by a slash."""
    rules = []
    for raw in text.splitlines():
        name = raw.strip()
        if not name or name.startswith(("#", "!")) or any(ch in name for ch in "*?[\\"):
            continue
        name = name.lstrip("/")
        folder = name.endswith("/")
        name = name.rstrip("/")
        if not name:
            continue
        pattern = r"(?<![\w.-])" + re.escape(name) + (r"/" if folder else r"(?![\w-])")
        rules.append((re.compile(pattern), "names a file this clone keeps out of git "
                                           "(.git/info/exclude), which is not in the repository"))
    return rules
# In the docs the drafts folder is not named at all; in a comment it may be
# named as the folder the code handles, but not a file inside it.
DRAFTS_ANY = re.compile(r"blog/drafts/")
DRAFTS_FILE = re.compile(r"blog/drafts/(?:[\w<>*-]+/)*[\w<>*-]+\.\w+")
REVIEW_IDS = [
    re.compile(r"\breview \d+[a-z]\b"),
    re.compile(r"\(\d+[a-z](?:/\d+[a-z])*\)"),
]


@dataclass(frozen=True)
class Finding:
    file: str
    line: int
    rule: str
    message: str

    def __str__(self) -> str:
        return f"{self.file}:{self.line}: {self.rule}: {self.message}"


# --- the tracked tree -----------------------------------------------------

class Tree:
    """What git tracks, as posix paths relative to the root: the files, the
    folders above them, the top-level names and every file's base name."""

    def __init__(self, files: list[str]):
        self.files = set(files)
        self.dirs = {str(p) for f in files for p in PurePosixPath(f).parents if str(p) != "."}
        self.top = {f.split("/", 1)[0] for f in files if "/" in f}
        self.names = {f.rsplit("/", 1)[-1] for f in files}

    @classmethod
    def from_git(cls) -> "Tree":
        return cls([p.relative_to(ROOT).as_posix() for p in sitelib.tracked()])

    def exists(self, rel: str) -> bool:
        rel = rel.rstrip("/")
        return rel in self.files or rel in self.dirs

    def glob(self, pattern: str) -> bool:
        return any(fnmatch.fnmatchcase(f, pattern) for f in self.files)


# --- finding the paths in a piece of text ----------------------------------

SPLIT = re.compile(r"[\s\"'`(),;=|\[\]{}]+")
# Everything from the first '?' is a query, never part of the path: the
# split below breaks `x.js?v=<stamp>` at the '=', so what is left is
# `x.js?v`, and a leftover '?' must not be read as a glob character.
QUERY = re.compile(r"\?.*$")
LINE_SUFFIX = re.compile(r":\d+(?:-\d+)?$")
TRAILING = ".,:;!?)'\""


def candidates(text: str, tree: Tree, bare_names: bool, urls: bool = True):
    """(word, normalised path) for every word in `text` that is meant as a
    repository path. See WHAT COUNTS AS A PATH in the module docstring.
    urls=False leaves out site-absolute words (/blog/x.html)."""
    for word in SPLIT.split(text):
        # Trailing punctuation only: a leading '.' is part of .github/.
        word = word.rstrip(TRAILING)
        if not word or "://" in word or word.startswith(("#", "@", "~", "$", "-")):
            continue
        path = QUERY.sub("", word).split("#", 1)[0]
        path = LINE_SUFFIX.sub("", path).rstrip(TRAILING)
        if path.startswith("../"):
            path = path[3:]
        elif path.startswith("./"):
            path = path[2:]
        elif path.startswith("/"):
            if not urls:
                continue
            path = path[1:]
        if not path or path.startswith(("../", "/")):
            continue
        if "/" in path:
            if path.split("/", 1)[0] in tree.top:
                yield word, path
        elif bare_names and "." in path:
            if path.rsplit(".", 1)[1] in FILE_EXTS and re.fullmatch(r"[\w.*<>-]+", path):
                yield word, path


def check_path(path: str, tree: Tree, bare_name: bool) -> str | None:
    """None when `path` is fine, else why it is not."""
    if "<" in path or ">" in path:
        return None                                   # a pattern, not a path
    if re.fullmatch(r"[A-Za-z]\.\w+", path.rsplit("/", 1)[-1]):
        return None                                   # an example: x.html, N.webp
    if "*" in path:
        return None if tree.glob(path) else "matches no tracked file"
    if bare_name and "/" not in path:
        return None if (path in tree.files or path in tree.names) else "is not the name of any tracked file"
    if path.startswith("blog/drafts/"):
        return None                                   # the private rules cover it
    if path.endswith("/"):
        return None if path.rstrip("/") in tree.dirs else "is not a tracked folder"
    return None if tree.exists(path) else "is not a tracked file or folder"


# --- reading comments -------------------------------------------------------

def _line_index(src: str):
    starts = [0] + [m.end() for m in re.finditer("\n", src)]
    return lambda pos: bisect.bisect_right(starts, pos)


REGEX_AFTER = set("(,=:[!&|?{};+-*%<>~^")
REGEX_WORDS = {"return", "typeof", "case", "do", "else", "in", "of", "new",
               "delete", "void", "throw", "instanceof", "yield", "await"}


def js_comments(src: str) -> list[tuple[int, str]]:
    """(line, text) for every // and /* */ comment in a script, stepping
    over strings, template literals and regular expression literals so a
    '//' inside a URL string or a regex is not taken for a comment."""
    line_of = _line_index(src)
    out: list[tuple[int, str]] = []
    i, n = 0, len(src)
    prev, prev_word = "", ""
    while i < n:
        c = src[i]
        if c in " \t\r\n":
            i += 1
            continue
        if src.startswith("//", i):
            j = src.find("\n", i)
            j = n if j < 0 else j
            out.append((line_of(i), src[i + 2:j]))
            i = j
            continue
        if src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j < 0 else j
            out.append((line_of(i), src[i + 2:j]))
            i = j + 2
            continue
        if c in "\"'`":
            i += 1
            while i < n and src[i] != c:
                if src[i] == "\\":
                    i += 1
                elif c != "`" and src[i] == "\n":
                    break
                i += 1
            i += 1
            prev, prev_word = c, ""
            continue
        if c == "/":
            if prev == "" or prev in REGEX_AFTER or prev_word in REGEX_WORDS:
                i += 1
                in_class = False
                while i < n and src[i] != "\n":
                    ch = src[i]
                    if ch == "\\":
                        i += 2
                        continue
                    if ch == "[":
                        in_class = True
                    elif ch == "]":
                        in_class = False
                    elif ch == "/" and not in_class:
                        break
                    i += 1
                i += 1
                while i < n and src[i].isalpha():
                    i += 1
            else:
                i += 1
            prev, prev_word = "/", ""
            continue
        if c.isalnum() or c in "_$":
            j = i
            while j < n and (src[j].isalnum() or src[j] in "_$"):
                j += 1
            prev, prev_word = "a", src[i:j]
            i = j
            continue
        prev, prev_word = c, ""
        i += 1
    return out


def css_comments(src: str) -> list[tuple[int, str]]:
    """(line, text) for every /* */ comment in a stylesheet."""
    line_of = _line_index(src)
    out: list[tuple[int, str]] = []
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        if src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j < 0 else j
            out.append((line_of(i), src[i + 2:j]))
            i = j + 2
        elif c in "\"'":
            j = i + 1
            while j < n and src[j] != c and src[j] != "\n":
                j += 2 if src[j] == "\\" else 1
            i = j + 1
        else:
            i += 1
    return out


def py_comments(src: str) -> list[tuple[int, str]]:
    """(line, text) for every # comment and every docstring in a module."""
    out: list[tuple[int, str]] = []
    try:
        for tok in tokenize.generate_tokens(io.StringIO(src).readline):
            if tok.type == tokenize.COMMENT:
                out.append((tok.start[0], tok.string[1:]))
    except (tokenize.TokenError, SyntaxError):
        pass
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return out
    lines = src.splitlines()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            body = getattr(node, "body", [])
            if (body and isinstance(body[0], ast.Expr)
                    and isinstance(body[0].value, ast.Constant)
                    and isinstance(body[0].value.value, str)):
                first, last = body[0].lineno, body[0].end_lineno or body[0].lineno
                out.append((first, "\n".join(lines[first - 1:last])))
    return out


def hash_comments(src: str) -> list[tuple[int, str]]:
    """(line, text) for every # comment in a shell script or YAML file.
    A '#' only starts a comment at the start of a line or after a space,
    as both languages read it."""
    out = []
    for k, line in enumerate(src.splitlines(), 1):
        m = re.search(r"(?:^|\s)#(?!!)(.*)$", line)
        if m:
            out.append((k, m.group(1)))
    return out


READERS = {"js": js_comments, "css": css_comments, "py": py_comments, "hash": hash_comments}


def comment_lines(src: str, lang: str):
    """Every comment line as (line number, text)."""
    for start, text in READERS[lang](src):
        for k, line in enumerate(text.split("\n")):
            yield start + k, line


# --- reading Markdown ---------------------------------------------------------

FENCE = re.compile(r"^\s*(```+|~~~+)")
CODE_SPAN = re.compile(r"(`+)(.+?)\1")
LINK = re.compile(r"(?<!\!)\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)|!\[[^\]]*\]\(([^)\s]+)\)")


def markdown_parts(src: str):
    """(line number, kind, text): kind is 'code' for a code span or a line
    of a fenced block, 'link' for a relative link target, 'prose' for the
    whole line (the private-name rules read everything)."""
    fence = None
    for k, line in enumerate(src.splitlines(), 1):
        yield k, "prose", line
        m = FENCE.match(line)
        if fence:
            if m and m.group(1)[0] == fence[0] and len(m.group(1)) >= len(fence):
                fence = None
            else:
                yield k, "code", line
            continue
        if m:
            fence = m.group(1)
            continue
        for span in CODE_SPAN.finditer(line):
            yield k, "code", span.group(2)
        bare = CODE_SPAN.sub("", line)
        for link in LINK.finditer(bare):
            target = link.group(1) or link.group(2)
            if not re.match(r"^[a-z][a-z0-9+.-]*:|^#", target, re.I):
                yield k, "link", target


# --- the checks ---------------------------------------------------------------

@functools.lru_cache(maxsize=None)
def private_names() -> tuple[tuple[re.Pattern, str], ...]:
    return tuple(PRIVATE_ALWAYS) + tuple(local_excludes())


def private_rules(text: str, file: str, line: int, is_doc: bool) -> list[Finding]:
    found = []
    for pattern, why in private_names():
        if pattern.search(text):
            found.append(Finding(file, line, "private", why))
            break                       # one finding per line is enough
    drafts = DRAFTS_ANY if is_doc else DRAFTS_FILE
    m = drafts.search(text)
    if m:
        what = "the drafts folder" if is_doc else "a draft (" + m.group(0) + ")"
        found.append(Finding(file, line, "private", f"names {what}, which is not in the repository"))
    for pattern in REVIEW_IDS:
        m = pattern.search(text)
        if m:
            found.append(Finding(file, line, "review-id",
                                 f"'{m.group(0)}' is a review label; say the reason instead"))
    return found


def check_doc(rel: str, src: str, tree: Tree, listing: list | None = None) -> list[Finding]:
    found: list[Finding] = []
    here = PurePosixPath(rel).parent
    for line, kind, text in markdown_parts(src):
        if kind == "prose":
            found += private_rules(text, rel, line, is_doc=True)
        elif kind == "code":
            for word, path in candidates(text, tree, bare_names=True):
                why = check_path(path, tree, bare_name="/" not in path)
                if listing is not None:
                    listing.append((rel, line, path, why))
                if why:
                    found.append(Finding(rel, line, "missing-path", f"`{word}` {why}"))
        elif kind == "link":
            target = text.split("#", 1)[0]
            if not target:
                continue
            resolved = str(PurePosixPath(*(here / target).parts))
            parts: list[str] = []
            for part in resolved.split("/"):
                if part == "..":
                    if parts:
                        parts.pop()
                elif part not in (".", ""):
                    parts.append(part)
            resolved = "/".join(parts)
            if listing is not None:
                listing.append((rel, line, resolved, None if tree.exists(resolved) else "missing"))
            if not tree.exists(resolved):
                found.append(Finding(rel, line, "broken-link",
                                     f"link to {text} resolves to {resolved}, which is not tracked"))
    return found


def check_comments(rel: str, src: str, lang: str, tree: Tree,
                   listing: list | None = None) -> list[Finding]:
    found: list[Finding] = []
    for line, text in comment_lines(src, lang):
        found += private_rules(text, rel, line, is_doc=False)
        for word, path in candidates(text, tree, bare_names=False, urls=False):
            why = check_path(path, tree, bare_name=False)
            if listing is not None:
                listing.append((rel, line, path, why))
            if why:
                found.append(Finding(rel, line, "missing-path", f"{word} {why}"))
    return found


def scope(tree: Tree) -> tuple[list[str], list[tuple[str, str]]]:
    docs = sorted(f for f in tree.files if any(fnmatch.fnmatchcase(f, g) for g in DOC_GLOBS))
    code = []
    for pattern, lang in COMMENT_GLOBS:
        for f in sorted(tree.files):
            if fnmatch.fnmatchcase(f, pattern) and not NOT_OURS.search(f):
                code.append((f, lang))
    # js/*.js as a pathspec crosses folders; as an fnmatch pattern it does
    # too, which is what takes in js/default-assets/active.js.
    return docs, code


def run(tree: Tree, listing: list | None = None) -> list[Finding]:
    docs, code = scope(tree)
    found: list[Finding] = []
    for rel in docs:
        found += check_doc(rel, (ROOT / rel).read_text(encoding="utf-8"), tree, listing)
    for rel, lang in code:
        found += check_comments(rel, (ROOT / rel).read_text(encoding="utf-8"), lang, tree, listing)
    return found


def main(argv: list[str] | None = None) -> int:
    ap = sitelib.arg_parser(__doc__)
    ap.add_argument("--check", action="store_true",
                    help="exit 1 when anything is found")
    ap.add_argument("--list", action="store_true",
                    help="print every path read, with where it was read and whether it exists")
    args = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")

    tree = Tree.from_git()
    listing: list | None = [] if args.list else None
    found = run(tree, listing)
    if listing is not None:
        for rel, line, path, why in listing:
            print(f"{'ok  ' if not why else 'MISS'}  {rel}:{line}  {path}")
    docs, code = scope(tree)
    for f in found:
        print(f)
    if found:
        print(f"\n{len(found)} finding(s) in {len(docs)} docs and the comments of "
              f"{len(code)} files. A renamed file: update the reference. A private "
              f"file: say what it holds instead of where it is.")
        return 1 if args.check else 0
    print(f"The {len(docs)} docs and the comments of {len(code)} files name only "
          f"tracked files, and nothing private.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
