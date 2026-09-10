"""Test wall picture processing: resizing, WebP output, metadata removal, GIFs, and bad input.

Edit this file when picture limits or image processing rules change.
Copy a test pattern here when you add tests for another pure helper module.
"""

from __future__ import annotations

import base64
from io import BytesIO

import pytest
from PIL import Image

from backend.images import ImageError, prepare_wall_image


def to_data_url(image: Image.Image, image_format: str, mime: str, **save_kwargs) -> str:
    buffer = BytesIO()
    image.save(buffer, format=image_format, **save_kwargs)
    return f"data:{mime};base64,{base64.b64encode(buffer.getvalue()).decode()}"


def test_large_png_is_resized_to_webp() -> None:
    result = prepare_wall_image(to_data_url(Image.new("RGB", (3000, 1500), "red"), "PNG", "image/png"))
    image = Image.open(BytesIO(result))
    assert image.format == "WEBP"
    assert max(image.size) == 1024


def test_small_picture_keeps_its_size() -> None:
    result = prepare_wall_image(to_data_url(Image.new("RGBA", (40, 20), (0, 0, 255, 128)), "PNG", "image/png"))
    assert Image.open(BytesIO(result)).size == (40, 20)


def test_exif_metadata_is_removed() -> None:
    exif = Image.Exif()
    exif[0x010F] = "SecretCameraMaker"
    data_url = to_data_url(Image.new("RGB", (100, 100), "green"), "JPEG", "image/jpeg", exif=exif.tobytes())
    result = prepare_wall_image(data_url)
    assert b"SecretCameraMaker" not in result
    assert 0x010F not in Image.open(BytesIO(result)).getexif()


def test_animated_gif_stays_animated() -> None:
    frames = [Image.new("RGB", (50, 50), color) for color in ("red", "blue", "green")]
    buffer = BytesIO()
    frames[0].save(buffer, format="GIF", save_all=True, append_images=frames[1:], duration=100, loop=0)
    data_url = f"data:image/gif;base64,{base64.b64encode(buffer.getvalue()).decode()}"
    image = Image.open(BytesIO(prepare_wall_image(data_url)))
    assert image.format == "WEBP"
    assert image.n_frames == 3


@pytest.mark.parametrize(
    "data_url",
    [
        "https://example.com/picture.png",
        "data:text/plain;base64,aGVsbG8=",
        "data:image/png;base64,@@@not-base64@@@",
        "data:image/png;base64,aGVsbG8=",
    ],
)
def test_bad_pictures_are_rejected(data_url: str) -> None:
    with pytest.raises(ImageError):
        prepare_wall_image(data_url)


def test_unsupported_format_is_rejected() -> None:
    with pytest.raises(ImageError, match="PNG, JPEG, WebP, or GIF"):
        prepare_wall_image(to_data_url(Image.new("RGB", (10, 10)), "BMP", "image/bmp"))


def test_too_big_picture_is_rejected(monkeypatch) -> None:
    monkeypatch.setattr("backend.images.MAX_UPLOAD_BYTES", 100)
    with pytest.raises(ImageError, match="too big"):
        prepare_wall_image(to_data_url(Image.effect_noise((200, 200), 50).convert("RGB"), "PNG", "image/png"))
