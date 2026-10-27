"""Unit tests for layout analysis and split_compact_crop algorithms."""

import unittest
import numpy as np
import cv2
import sys
from pathlib import Path

# Add app directory to sys.path
APP_DIR = Path(__file__).resolve().parents[1] / "app"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

from layout import (
    enlarge_small_crop,
    find_compact_row_split,
    split_compact_crop,
    is_compact_plate,
    has_plausible_plate_format,
    assess_plate_text,
    PLATE_STATUS_VALID,
    PLATE_STATUS_LOW_CONFIDENCE,
    PLATE_STATUS_INVALID_FORMAT,
    PLATE_STATUS_EMPTY,
)


class TestLayoutModule(unittest.TestCase):
    def test_enlarge_small_crop_upscales_when_too_small(self):
        # Create a tiny 20x30 image
        tiny = np.zeros((20, 30, 3), dtype=np.uint8)
        upscaled = enlarge_small_crop(tiny, minimum_side=48)
        self.assertGreaterEqual(min(upscaled.shape[:2]), 48)
        # Aspect ratio should be preserved: 30/20 = 1.5 -> (72, 48)
        self.assertEqual(upscaled.shape[0], 48)
        self.assertEqual(upscaled.shape[1], 72)

    def test_enlarge_small_crop_preserves_large_enough_image(self):
        img = np.zeros((60, 100, 3), dtype=np.uint8)
        same = enlarge_small_crop(img, minimum_side=48)
        self.assertEqual(same.shape, (60, 100, 3))

    def test_is_compact_plate_detection(self):
        # Motorbike / Square plate: 140 height, 190 width -> ratio 1.35 < 1.6
        compact_plate = np.zeros((140, 190, 3), dtype=np.uint8)
        self.assertTrue(is_compact_plate(compact_plate, aspect_ratio_threshold=1.6))

        # Wide car plate: 110 height, 520 width -> ratio 4.7 > 1.6
        wide_plate = np.zeros((110, 520, 3), dtype=np.uint8)
        self.assertFalse(is_compact_plate(wide_plate, aspect_ratio_threshold=1.6))

    def test_split_compact_crop_finds_gap_between_lines(self):
        # Synthesize a 2-line plate image: 100x140
        # White background (value 255)
        # Line 1 text: row 15 to row 35 has high variance pattern
        # Line 2 text: row 65 to row 85 has high variance pattern
        # Gap between lines: row 40 to 60 is pure white (0 variance)
        img = np.full((100, 140), 255, dtype=np.uint8)

        # Draw dark text patterns in line 1 and line 2
        img[15:35, 20:120:10] = 0
        img[65:85, 20:120:8] = 0

        # The row split should be around row 40 to 60 (the white band)
        split_row = find_compact_row_split(img, search_start=0.35, search_end=0.65)
        self.assertGreaterEqual(split_row, 35)
        self.assertLessEqual(split_row, 65)

        top, bottom = split_compact_crop(img, search_start=0.35, search_end=0.65)
        self.assertEqual(top.shape[0], split_row)
        self.assertEqual(bottom.shape[0], 100 - split_row)
        self.assertEqual(top.shape[1], 140)
        self.assertEqual(bottom.shape[1], 140)

    def test_plausible_format_validation(self):
        # Valid Vietnamese plates
        self.assertTrue(has_plausible_plate_format("51K88888"))
        self.assertTrue(has_plausible_plate_format("59-P1 678.90"))
        self.assertTrue(has_plausible_plate_format("29A-123.45"))
        self.assertTrue(has_plausible_plate_format("43A12345"))

        # Invalid formats
        self.assertFalse(has_plausible_plate_format(""))  # Empty
        self.assertFalse(has_plausible_plate_format("ABCDEF"))  # No digits
        self.assertFalse(has_plausible_plate_format("12345678"))  # No letters
        self.assertFalse(has_plausible_plate_format("51"))  # Too short

    def test_assess_plate_text(self):
        norm, valid, status = assess_plate_text("51K-888.88", confidence=0.92)
        self.assertEqual(norm, "51K88888")
        self.assertTrue(valid)
        self.assertEqual(status, PLATE_STATUS_VALID)

        norm, valid, status = assess_plate_text("51K-888.88", confidence=0.55)
        self.assertEqual(norm, "51K88888")
        self.assertTrue(valid)
        self.assertEqual(status, PLATE_STATUS_LOW_CONFIDENCE)

        norm, valid, status = assess_plate_text("INVALID", confidence=0.90)
        self.assertFalse(valid)
        self.assertEqual(status, PLATE_STATUS_INVALID_FORMAT)

        norm, valid, status = assess_plate_text("", confidence=0.0)
        self.assertFalse(valid)
        self.assertEqual(status, PLATE_STATUS_EMPTY)


if __name__ == "__main__":
    unittest.main()
