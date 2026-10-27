"""
Layout analysis and post-processing helpers for Vietnamese license plates.
Inspired by techniques from the VLPR (Vietnamese License Plate Recognition) pipeline:
- Minimum resolution enlargement with Lanczos interpolation
- Variance-based row split for two-line (compact/square/motorbike) license plates
- Vietnamese plate plausible format validation and safety classification
"""

from __future__ import annotations
import unicodedata
import cv2
import numpy as np

PLATE_STATUS_VALID = "valid"
PLATE_STATUS_LOW_CONFIDENCE = "low_confidence"
PLATE_STATUS_INVALID_FORMAT = "invalid_format"
PLATE_STATUS_EMPTY = "empty"


def enlarge_small_crop(image: np.ndarray, minimum_side: int = 48) -> np.ndarray:
    """
    Upscale tiny crops before OCR using Lanczos interpolation so interpolation
    happens once before line splitting or recognition.
    """
    if image is None or image.size == 0:
        return image

    h, w = image.shape[:2]
    min_dim = min(h, w)
    if min_dim >= minimum_side or min_dim == 0:
        return image

    scale = minimum_side / min_dim
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)


def find_compact_row_split(
    image: np.ndarray,
    search_start: float = 0.35,
    search_end: float = 0.65,
) -> int:
    """
    Find the row of lowest horizontal variation between two text lines in a compact plate crop.
    Between the upper line (province + series) and lower line (digits), there is a horizontal
    spacing band where pixel intensity standard deviation across rows reaches a local minimum.
    """
    if image is None or image.size == 0:
        raise ValueError("Empty image cannot be split.")

    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.float32)
    else:
        gray = image.astype(np.float32)

    height = gray.shape[0]
    if height < 4:
        raise ValueError(f"Compact crop is too short to split rows: {height}")

    first = max(1, int(round(height * search_start)))
    last = min(height - 1, int(round(height * search_end)))
    if first >= last:
        raise ValueError(f"Empty split search range with height={height}")

    # Standard deviation along axis 1 (horizontal rows)
    row_variation = np.std(gray, axis=1)

    # 1D moving average smoothing kernel to eliminate pixel noise
    kernel_size = min(5, max(1, last - first))
    kernel = np.ones(kernel_size, dtype=np.float32) / kernel_size
    smoothed = np.convolve(row_variation, kernel, mode="same")

    return int(first + np.argmin(smoothed[first:last]))


def split_compact_crop(
    image: np.ndarray,
    search_start: float = 0.35,
    search_end: float = 0.65,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Split a compact two-line plate crop into top and bottom line crops.
    Returns (top_line_crop, bottom_line_crop).
    Raises ValueError if image cannot be split.
    """
    split_row = find_compact_row_split(image, search_start=search_start, search_end=search_end)
    top = image[0:split_row, :]
    bottom = image[split_row:, :]

    if top.shape[0] == 0 or bottom.shape[0] == 0:
        raise ValueError("Row split produced an empty crop.")

    return top, bottom


def is_compact_plate(image: np.ndarray, aspect_ratio_threshold: float = 1.6) -> bool:
    """
    Detect whether a plate crop is compact (2-line: motorbike 190x140mm or square car 280x200mm)
    vs wide (1-line car: 520x110mm).
    Typical aspect ratios (width / height):
    - Motorbike / Square: ~ 1.3 - 1.45
    - Wide car plate: ~ 4.2 - 4.8
    """
    if image is None or image.size == 0:
        return False
    h, w = image.shape[:2]
    if h == 0:
        return False
    return (w / h) < aspect_ratio_threshold


def normalize_plate_text(text: str) -> str:
    """
    Normalize Unicode NFKC, convert to uppercase, and remove all non-alphanumeric characters.
    """
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKC", text).upper()
    return "".join(c for c in normalized if c.isalnum())


def has_plausible_plate_format(text: str) -> bool:
    """
    Validate plausible Vietnamese plate format:
    - Length between 6 and 10 alphanumeric characters.
    - Contains at least one letter (series) and at least one digit (province/order).
    """
    cleaned = normalize_plate_text(text)
    return (
        6 <= len(cleaned) <= 10
        and any(c.isalpha() for c in cleaned)
        and any(c.isdigit() for c in cleaned)
    )


def assess_plate_text(
    raw_text: str,
    confidence: float,
    min_confidence: float = 0.60,
    high_confidence: float = 0.85,
) -> tuple[str, bool, str]:
    """
    Assess plate recognition results:
    Returns (normalized_text, format_valid, status)
    where status is one of: 'valid', 'low_confidence', 'invalid_format', 'empty'
    """
    normalized = normalize_plate_text(raw_text)
    if not normalized:
        return "", False, PLATE_STATUS_EMPTY

    valid_format = has_plausible_plate_format(normalized)
    if not valid_format:
        return normalized, False, PLATE_STATUS_INVALID_FORMAT

    if confidence < min_confidence:
        return normalized, True, PLATE_STATUS_LOW_CONFIDENCE

    return normalized, True, PLATE_STATUS_VALID
