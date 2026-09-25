#!/usr/bin/env python3
"""Install the repository's pre-commit hook into this clone.

    python .github/hooks/install.py          # install (or update) pre-commit
    python .github/hooks/install.py --check  # exit 1 if the installed one differs

git runs hooks from the clone's own hooks directory, never from the
repository's files, so a fresh clone runs none until they are copied into
place. That is how the stylesheet guard was lost once already: it existed
only in one working copy's .git/hooks, and the first anyone heard of it
missing was a red CI run. The hook itself is tracked beside this file.

Only pre-commit is installed. Every other hook in the directory,
post-commit included, is left exactly as it is: a clone can carry hooks
of its own that are none of the repository's business. For the same
reason this copies the file rather than setting core.hooksPath, which
would take over every hook at once. A pre-commit that differs from the
tracked one is kept as pre-commit.bak before it is replaced, and the
installer says so.

The hook is written with LF line endings whatever the checkout uses. A
Windows working copy holds tracked text files with CRLF, and sh reads the
carriage return as part of each command (`exit 0` becomes `exit 0\\r`,
which is not a number).
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
HOOK = "pre-commit"


def hooks_dir() -> Path:
    """This clone's hooks directory, as git itself resolves it.

    Asked of git rather than assumed to be .git/hooks: in a linked
    worktree .git is a file, and core.hooksPath moves the directory.
    """
    out = subprocess.run(["git", "rev-parse", "--git-path", "hooks"],
                         cwd=ROOT, capture_output=True, text=True, check=True)
    path = Path(out.stdout.strip())
    return path if path.is_absolute() else ROOT / path


def tracked_hook() -> bytes:
    return (HERE / HOOK).read_bytes().replace(b"\r\n", b"\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, allow_abbrev=False,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true",
                    help="report whether the installed pre-commit is the tracked one; change nothing")
    args = ap.parse_args(argv)

    want = tracked_hook()
    target = hooks_dir() / HOOK
    have = target.read_bytes() if target.exists() else None
    shown = os.path.relpath(target, ROOT).replace(os.sep, "/")

    if args.check:
        if have == want:
            print("%s is the tracked hook." % shown)
            return 0
        print("%s %s; run: python .github/hooks/install.py"
              % (shown, "is missing" if have is None else "differs from .github/hooks/pre-commit"))
        return 1

    if have == want:
        print("%s is already the tracked hook; nothing to do." % shown)
        return 0
    target.parent.mkdir(parents=True, exist_ok=True)
    if have is not None:
        backup = target.with_name(HOOK + ".bak")
        shutil.copy2(target, backup)
        print("Kept the previous hook as %s" % os.path.relpath(backup, ROOT).replace(os.sep, "/"))
    target.write_bytes(want)
    # Git skips a hook that is not executable, without a word. On Windows
    # the bit means nothing and Git for Windows runs the hook regardless.
    target.chmod(0o755)
    print("Installed %s (runs: python .github/scripts/run_checks.py --fast)" % shown)
    print("Other hooks in %s were not touched." % os.path.relpath(target.parent, ROOT).replace(os.sep, "/"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
