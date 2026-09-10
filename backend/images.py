"""Turn a pasted or uploaded picture (a data URL) into a small, safe WebP image for the wall.

Edit this file when picture size limits, allowed formats, or image processing rules change.
Do not copy this file. Reuse prepare_wall_image() when another feature needs pictures.
"""

from __future__ import annotations

import base64
import binascii
from io import BytesIO

from PIL import Image, ImageOps, ImageSequence, UnidentifiedImageError

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_SIDE = 1024
MAX_FRAMES = 120
ALLOWED_FORMATS = {"PNG", "JPEG", "WEBP", "GIF"}
Image.MAX_IMAGE_PIXELS = 40_000_000


class ImageError(ValueError):
    pass


def decode_data_url(data_url: str) -> bytes:
    if not data_url.startswith("data:image/") or ";base64," not in data_url:
        raise ImageError("The picture must be a PNG, JPEG, WebP, or GIF image.")
    encoded = data_url.split(";base64,", 1)[1]
    if len(encoded) > MAX_UPLOAD_BYTES * 4 // 3 + 8:
        raise ImageError("The picture is too big. The limit is 5 MB.")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ImageError("The picture data is broken.") from error
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ImageError("The picture is too big. The limit is 5 MB.")
    return raw


def prepare_wall_image(data_url: str) -> bytes:
    """Check the picture, shrink it to at most 1024px, drop metadata (like GPS), and save it as WebP."""
    raw = decode_data_url(data_url)
    try:
        image = Image.open(BytesIO(raw))
        image_format = image.format
        if image_format not in ALLOWED_FORMATS:
            raise ImageError("The picture must be a PNG, JPEG, WebP, or GIF image.")
        output = BytesIO()
        if getattr(image, "is_animated", False) and getattr(image, "n_frames", 1) > 1:
            frames = []
            durations = []
            for index, frame in enumerate(ImageSequence.Iterator(image)):
                if index >= MAX_FRAMES:
                    break
                converted = frame.convert("RGBA")
                converted.thumbnail((MAX_SIDE, MAX_SIDE))
                frames.append(converted)
                durations.append(int(frame.info.get("duration", 100)) or 100)
            frames[0].save(output, format="WEBP", save_all=True, append_images=frames[1:], duration=durations, loop=0, quality=80)
        else:
            image = ImageOps.exif_transpose(image)
            has_alpha = image.mode in ("RGBA", "LA", "PA") or (image.mode == "P" and "transparency" in image.info)
            image = image.convert("RGBA" if has_alpha else "RGB")
            image.thumbnail((MAX_SIDE, MAX_SIDE))
            image.save(output, format="WEBP", quality=82)
    except ImageError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as error:
        raise ImageError("This file is not a picture we can use.") from error
    return output.getvalue()
