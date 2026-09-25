"""run_checks.py: the registry's order and the workflow parity rules.

The registry is the one list of checks the pre-commit hook, CI and a
local run all share; --ci-parity holds site-checks.yml to it, and
generate_colophon.py counts the workflow's check steps for the colophon.
These cases fix the invariants that make that work: names are unique,
the colophon measures last, the parity comparison ignores shell quoting,
and a workflow step is a check only when it runs one.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import contextlib
import io
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import run_checks  # noqa: E402


class Registry(unittest.TestCase):
    def test_names_are_unique(self):
        names = [c.name for c in run_checks.CHECKS]
        self.assertEqual(len(names), len(set(names)))

    def test_the_colophon_measures_last(self):
        # It publishes byte and step counts that every other entry can move.
        self.assertEqual(run_checks.CHECKS[-1].name, "colophon")

    def test_a_fixer_runs_the_same_program_as_its_check(self):
        for c in run_checks.CHECKS:
            if c.fix and c.program == "python" and c.check[0].endswith(".py"):
                with self.subTest(check=c.name):
                    self.assertEqual(c.fix[0], c.check[0])

    def test_the_post_normaliser_runs_before_anything_counts_a_post(self):
        order = [c.name for c in run_checks.CHECKS]
        self.assertLess(order.index("post-markup"), order.index("read-times"))
        self.assertLess(order.index("css-rules"), order.index("css"))


class Parity(unittest.TestCase):
    def test_quoting_does_not_matter(self):
        self.assertEqual(run_checks.words('node --test "tests/js/*.test.js"'),
                         run_checks.words("node --test tests/js/*.test.js"))
        self.assertEqual(run_checks.words("python  a.py   --check"), ("python", "a.py", "--check"))
        # An unbalanced quote falls back to whitespace rather than crashing.
        self.assertEqual(run_checks.words('echo "oops'), ("echo", '"oops'))

    def test_a_check_step_runs_a_check(self):
        text = """
jobs:
  audit:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
      - name: Install Python dependencies
        run: pip install -r requirements.txt
      # - name: A commented-out step
      #   run: python nothing.py
      - name: Feed is current
        if: ${{ !cancelled() }}
        run: python .github/scripts/generate_feed.py --check
      - name: JavaScript unit tests
        run: node --test "tests/js/*.test.js"
"""
        steps = run_checks.check_steps(text)
        self.assertEqual([s["name"] for s in steps], ["Feed is current", "JavaScript unit tests"])

    def test_the_workflow_runs_the_registry(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = run_checks.ci_parity()
        self.assertEqual(code, 0, out.getvalue())


if __name__ == "__main__":
    unittest.main()
