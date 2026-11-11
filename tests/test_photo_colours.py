"""generate_photo_colours.py: which colour family a frame lands in.

The rule works on a list of (r, g, b) pixels, so these cases paint their
own frames as lists and need no image library: a sky over a field, a grey
street with one red coat, wood and stone, a frame with no colour at all.
Each pins a decision the module's docstring makes (chroma as the weight,
brown as a dark or dull warm colour, olive with the greens, a floor under
which a frame has no family). Then the file: one line a family, and what
--check refuses.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import generate_photo_colours as gpc  # noqa: E402

SKY = (120, 170, 235)
GRASS = (70, 140, 50)
GREY = (128, 128, 128)
RED_COAT = (200, 30, 40)
WOOD = (110, 75, 45)
SKIN = (225, 185, 160)


def frame(*parts):
    """Pixels for a frame painted in flat areas: (colour, how many)."""
    return [colour for colour, count in parts for _ in range(count)]


def family(*parts):
    return gpc.family_of(frame(*parts))[0]


class Pixels(unittest.TestCase):
    def test_each_hue_family(self):
        for rgb, name in (((220, 30, 40), "red"), ((240, 130, 20), "orange"), ((245, 215, 40), "yellow"),
                          ((60, 170, 70), "green"), ((30, 160, 170), "teal"), ((40, 90, 220), "blue"),
                          ((140, 70, 210), "purple"), ((235, 80, 170), "pink")):
            self.assertEqual(gpc.pixel_family(*rgb)[0], name, rgb)

    def test_red_closes_the_circle(self):
        self.assertEqual(gpc.pixel_family(230, 30, 60)[0], "red")     # 351 degrees
        self.assertEqual(gpc.pixel_family(230, 60, 30)[0], "red")     # 9 degrees

    def test_greys_have_no_family(self):
        for rgb in ((0, 0, 0), (255, 255, 255), GREY, (130, 126, 120), (20, 22, 30)):
            self.assertEqual(gpc.pixel_family(*rgb), (None, 0.0), rgb)

    def test_brown_is_a_dark_or_dull_warm_colour(self):
        self.assertEqual(gpc.pixel_family(*WOOD)[0], "brown")            # dark orange
        self.assertEqual(gpc.pixel_family(*SKIN)[0], "brown")            # washed-out orange
        self.assertEqual(gpc.pixel_family(120, 95, 20)[0], "brown")      # dark mustard, 45 degrees
        self.assertEqual(gpc.pixel_family(240, 130, 20)[0], "orange")    # the same hue, bright and strong
        self.assertEqual(gpc.pixel_family(110, 20, 30)[0], "red")        # a dark red stays red

    def test_dark_yellow_is_olive_and_counts_as_green(self):
        self.assertEqual(gpc.pixel_family(100, 105, 30)[0], "green")     # 64 degrees, dark
        self.assertEqual(gpc.pixel_family(235, 240, 60)[0], "yellow")    # the same hue, bright

    def test_the_weight_is_the_chroma(self):
        self.assertAlmostEqual(gpc.pixel_family(255, 0, 0)[1], 1.0)
        self.assertAlmostEqual(gpc.pixel_family(*SKY)[1], (235 - 120) / 255)


class Frames(unittest.TestCase):
    def test_a_sky_over_a_field_is_one_of_the_two(self):
        self.assertEqual(family((SKY, 700), (GRASS, 300)), "blue")
        self.assertEqual(family((SKY, 300), (GRASS, 700)), "green")
        # never a third thing, whatever the split
        for sky in range(100, 1000, 100):
            self.assertIn(family((SKY, sky), (GRASS, 1000 - sky), (GREY, 200)), ("blue", "green"))

    def test_a_vivid_subject_outweighs_a_dull_ground(self):
        # A third of the frame in strong red against two thirds of pale wood.
        self.assertEqual(family((RED_COAT, 340), (SKIN, 660)), "red")
        self.assertEqual(family((RED_COAT, 100), (WOOD, 900)), "brown")

    def test_a_grey_frame_with_an_accent(self):
        under = int(gpc.MIN_COVER * 1000) - 10
        self.assertEqual(family((GREY, 1000 - under), (RED_COAT, under)), gpc.NONE)
        self.assertEqual(family((GREY, 880), (RED_COAT, 120)), "red")

    def test_no_colour_no_family(self):
        self.assertEqual(family((GREY, 500), ((250, 250, 250), 300), ((8, 8, 8), 200)), gpc.NONE)
        self.assertEqual(gpc.family_of([])[0], gpc.NONE)

    def test_a_tie_goes_to_the_first_family_listed(self):
        tie = frame(((255, 0, 0), 10), ((0, 0, 255), 10))
        self.assertEqual(gpc.family_of(tie)[0], "red")
        self.assertEqual(gpc.family_of(list(reversed(tie)))[0], "red")


class TheFile(unittest.TestCase):
    FAMILIES = {"red": [3, 1], "blue": [2], "none": [10]}

    def test_a_family_a_line_frames_by_number(self):
        text = gpc.dump(self.FAMILIES)
        lines = text.splitlines()
        self.assertEqual(lines[0], "{")
        self.assertEqual(lines[1], '"red": [1, 3],')
        self.assertEqual(len(lines), len(gpc.FAMILIES) + 3)          # the families, "none", two braces
        self.assertEqual(list(json.loads(text)), list(gpc.FAMILIES) + [gpc.NONE])
        self.assertEqual(json.loads(text)["none"], [10])
        self.assertEqual(json.loads(text)["green"], [])

    def test_check_passes_the_file_as_written(self):
        self.assertEqual(gpc.problems(gpc.dump(self.FAMILIES), [1, 2, 3, 10]), [])
        self.assertEqual(gpc.problems(gpc.dump(self.FAMILIES).replace("\n", "\r\n"), [1, 2, 3, 10]), [])

    def test_check_names_what_is_wrong(self):
        text = gpc.dump(self.FAMILIES)
        self.assertIn("in no colour family: 4", gpc.problems(text, [1, 2, 3, 4, 10])[0])
        self.assertIn("no thumbnail: 10", gpc.problems(text, [1, 2, 3])[0])
        twice = gpc.dump({"red": [1, 3], "blue": [2, 3], "none": [10]})
        self.assertIn("in two families: 3", gpc.problems(twice, [1, 2, 3, 10])[0])
        self.assertTrue(gpc.problems(text.replace('"red": [1, 3]', '"red": [3, 1]'), [1, 2, 3, 10]))
        self.assertTrue(gpc.problems(text.replace('"pink": []', '"pink": [], "mauve": []'), [1, 2, 3, 10]))
        self.assertTrue(gpc.problems("not json", [1]))

    def test_the_committed_file_names_the_families_the_rule_does(self):
        families = json.loads(gpc.OUT.read_text(encoding="utf-8"))
        self.assertEqual(list(families), list(gpc.FAMILIES) + [gpc.NONE])


class Run(unittest.TestCase):
    """main() over stand-in thumbnails whose pixels are given, not decoded."""

    def test_write_report_and_check(self):
        pixels = {"1.webp": frame((SKY, 100)), "2.webp": frame((GREY, 100)), "3.webp": frame((WOOD, 100))}
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "photo-colours.json"
            thumbs = [Path(tmp) / name for name in pixels]
            with mock.patch.object(gpc, "OUT", out), \
                    mock.patch.object(gpc.sitelib, "thumb_files", lambda: thumbs), \
                    mock.patch.object(gpc, "thumb_pixels", lambda path: pixels[path.name]), \
                    contextlib.redirect_stdout(io.StringIO()) as said:
                self.assertEqual(gpc.main(["--check"]), 1)              # no file yet
                self.assertEqual(gpc.main(["--report"]), 0)
                self.assertFalse(out.exists())                          # --report writes nothing
                self.assertEqual(gpc.main([]), 0)
                first = out.read_bytes()
                self.assertEqual(json.loads(first)["blue"], [1])
                self.assertEqual(json.loads(first)["none"], [2])
                self.assertEqual(json.loads(first)["brown"], [3])
                self.assertNotIn(b"\r", first)
                self.assertEqual(gpc.main([]), 0)
                self.assertEqual(out.read_bytes(), first)               # a second run changes nothing
                self.assertEqual(gpc.main(["--check"]), 0)
                thumbs.append(Path(tmp) / "4.webp")                     # a frame added since
                self.assertEqual(gpc.main(["--check"]), 1)
            self.assertIn("in no colour family: 4", said.getvalue())


if __name__ == "__main__":
    unittest.main()
