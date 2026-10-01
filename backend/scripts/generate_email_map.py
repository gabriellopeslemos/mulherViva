"""Gera a imagem estática do mapa usada no e-mail de confirmação.

E-mails não rodam mapas interativos, então o mapa é um PNG montado a partir de
tiles do OpenStreetMap com um pino na cor da marca. Rode de
novo sempre que CLINIC_ADDRESS mudar:

    python scripts/generate_email_map.py -15.82687 -47.90226

Saída padrão: public/email-map.png (servido em PUBLIC_BASE_URL/email-map.png).
"""

import argparse
import io
import math
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageEnhance, ImageFont

TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
TILE_SIZE = 256
PIN_COLOR = (94, 47, 82)  # --palette-1
DEFAULT_OUT = Path(__file__).resolve().parents[2] / "public" / "email-map.png"


def _world_px(lat: float, lon: float, zoom: int) -> tuple[float, float]:
    scale = TILE_SIZE * 2**zoom
    x = (lon + 180) / 360 * scale
    s = math.sin(math.radians(lat))
    y = (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * scale
    return x, y


def _draw_pin(img: Image.Image, cx: int, tip_y: int, s: int = 2) -> None:
    """Pino em gota: círculo + triângulo, com sombra suave e miolo branco."""
    r = 15 * s
    cy = tip_y - 24 * s
    draw = ImageDraw.Draw(img, "RGBA")
    draw.ellipse((cx - 9 * s, tip_y - 3 * s, cx + 9 * s, tip_y + 3 * s), fill=(0, 0, 0, 50))
    draw.polygon(
        [(cx - r * 0.82, cy + r * 0.55), (cx + r * 0.82, cy + r * 0.55), (cx, tip_y)],
        fill=PIN_COLOR,
    )
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=PIN_COLOR)
    draw.ellipse((cx - 6 * s, cy - 6 * s, cx + 6 * s, cy + 6 * s), fill=(255, 255, 255))


def generate(lat: float, lon: float, out: Path, width: int, height: int, zoom: int) -> None:
    px, py = _world_px(lat, lon, zoom)
    left, top = px - width / 2, py - height / 2
    canvas = Image.new("RGB", (width, height), (240, 240, 240))

    with httpx.Client(headers={"User-Agent": "mulherviva-email-map/1.0 (gerador de mapa estatico do e-mail)"}, timeout=20) as client:
        for tx in range(int(left // TILE_SIZE), int((left + width) // TILE_SIZE) + 1):
            for ty in range(int(top // TILE_SIZE), int((top + height) // TILE_SIZE) + 1):
                resp = client.get(TILE_URL.format(z=zoom, x=tx, y=ty))
                resp.raise_for_status()
                tile = Image.open(io.BytesIO(resp.content)).convert("RGB")
                canvas.paste(tile, (int(tx * TILE_SIZE - left), int(ty * TILE_SIZE - top)))

    # Cores do OSM mais suaves, para o pino da marca ser o destaque.
    canvas = ImageEnhance.Color(canvas).enhance(0.45)

    # Ponta do pino no ponto exato; a gota fica acima dele.
    _draw_pin(canvas, width // 2, height // 2)

    draw = ImageDraw.Draw(canvas, "RGBA")
    label = "© OpenStreetMap"
    font = ImageFont.load_default(size=18)
    tw = draw.textlength(label, font=font)
    draw.rectangle((width - tw - 20, height - 30, width, height), fill=(255, 255, 255, 190))
    draw.text((width - tw - 10, height - 27), label, fill=(90, 90, 90), font=font)

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, optimize=True)
    print(f"Mapa salvo em {out}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("lat", type=float)
    parser.add_argument("lon", type=float)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--width", type=int, default=1200)
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument("--zoom", type=int, default=17)  # 1200px exibido a 600px = nitido em tela retina
    args = parser.parse_args()
    generate(args.lat, args.lon, args.out, args.width, args.height, args.zoom)


if __name__ == "__main__":
    main()
