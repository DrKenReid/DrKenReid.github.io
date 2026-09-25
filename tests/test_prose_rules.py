"""The house style rules in audit_site.py, pinned by example.

Each rule is a regular expression with its reasoning in the comments above
it: which phrasing it exists to stop, and which near miss in the corpus it
has to leave alone ("a paragraph that stuck" in the memory post, "[sic]" in
a quotation). Those examples are the specification, so they are lifted into
tables here. Editing a pattern without rerunning these is how a rule starts
flagging a published post, or stops flagging anything at all.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import audit_site  # noqa: E402


class RuleTable:
    """A pattern plus the phrases it must and must not find.

    A mixin rather than a TestCase, so the loader only runs it through the
    subclasses that supply a pattern. One subTest per phrase, so a failure
    names the phrase instead of stopping at the first one.
    """

    pattern = None
    must_match = ()
    must_not_match = ()

    def test_flags(self):
        for text in self.must_match:
            with self.subTest(text=text):
                self.assertIsNotNone(self.pattern.search(text),
                                     f"should be flagged: {text!r}")

    def test_leaves_alone(self):
        for text in self.must_not_match:
            with self.subTest(text=text):
                found = self.pattern.search(text)
                self.assertIsNone(
                    found, f"flagged {found and found.group(0)!r} in {text!r}")


class BannedWordsInProse(RuleTable, unittest.TestCase):
    """BANNED_PROSE: words and constructions kept out of visible prose."""

    pattern = audit_site.BANNED_PROSE
    must_match = (
        # the adjective and its adverb, in any case
        "the quiet car",
        "It worked, quietly.",
        "A quieter approach.",
        "Honestly, it was fine.",
        "It was honest work.",
        # adverbs only for these two
        "It failed embarrassingly.",
        "She politely declined.",
        # the habitual present, presenting a tic as a considered position
        "I keep thinking about the ending.",
        "Three playlists I keep coming back to",
        # asserting settled authority by declining to defend it
        "I no longer argue with people about tabs.",
        # self-characterisation standing in for a reason
        "I have a soft spot for trains.",
        "I've a soft spot for trains.",
        "I've got a soft spot for trains.",
        # implies rejected alternatives the reader is never shown
        "That was the fix that stuck.",
        "the name that stuck",
        # a confession that confesses nothing
        "more times than I will admit to",
        "more often than I care to admit",
        "than I would admit",
        # line counts as a measure of anything
        "It is 400 lines of code.",
        "about 1,200 lines of JavaScript",
        "The widget was only 90 lines.",
        "The whole thing is around 300 lines",
        "It fits in 50 lines.",
        "it fit in ~80 lines",
    )
    must_not_match = (
        # the adjectives earn their place: a post about an embarrassing
        # t-shirt, another about politeness as a subject
        "an embarrassing t-shirt",
        "politeness is a subject in itself",
        "the polite thing to do",
        # past and perfect forms are fine, and so is "keep" with an object
        "I kept thinking about the ending.",
        "I've been thinking about the ending.",
        "I keep it in the repository.",
        # only "the ... that stuck"; the memory post's literal use survives
        "a paragraph that stuck",
        # a line count followed by something other than code
        "3 lines explaining yourself",
        # whole words only
        "a dishonest answer",
    )


class StraightQuotesInProse(RuleTable, unittest.TestCase):
    """CURLY_PROSE: house style is straight ' and " in prose."""

    pattern = audit_site.CURLY_PROSE
    must_match = (
        "it’s",
        "‘single’",
        "“double”",
    )
    must_not_match = (
        "it's",
        "'single'",
        '"double"',
        # primes are not quotation marks
        "5′11″",
        "`code`",
    )


class StraightenMatchesCurlyProse(unittest.TestCase):
    """STRAIGHTEN must undo exactly what CURLY_PROSE flags, or two copies of
    a title differing only in quote style would still disagree."""

    def test_round_trip(self):
        curly = "‘a’ “b”"
        straight = curly.translate(audit_site.STRAIGHTEN)
        self.assertEqual(straight, "'a' \"b\"")
        self.assertIsNone(audit_site.CURLY_PROSE.search(straight))


class UnwrittenPlaceholders(RuleTable, unittest.TestCase):
    """PLACEHOLDER_PROSE: scaffolding left in visible text."""

    pattern = audit_site.PLACEHOLDER_PROSE
    must_match = (
        # the reference slot that shipped in factorio-live.html
        "[Placeholder: a general operational research reference]",
        # anything announcing itself
        "[TODO]",
        "[todo: check this figure]",
        "[TBD]",
        "[TK]",
        "[XXX]",
        "[FIXME later]",
        "[Write the answer to this question]",
        "[Add a diagram here]",
        "[Expand on the second case]",
        "[fill in]",
        "Lorem ipsum dolor sit amet",
        # a whole visible sentence in brackets, which is how the FAQ stubs
        # were written
        "[This paragraph explains why the second run converged faster.]",
        "The first run failed. [A sentence about the second run goes here.]",
    )
    must_not_match = (
        # editorial insertions stay legal
        "It was [sic] a disaster.",
        "he [Popper] argued that it could not be verified",
        # a long bracket mid-sentence is an aside, not a stub
        "he said [The author later retracted this in full] in 1999",
        # citation markers and intervals
        "as shown before [1]",
        "the interval [0, 1]",
        # the announcing words only as whole words
        "see the notes [additional ones follow]",
        "see the note [Writers often disagree]",
    )


if __name__ == "__main__":
    unittest.main()
