"""Download the licensed image assets listed in data/images.json."""

import json
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "data" / "images.json"


def main():
    images = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for image in images.values():
        url = image["url"]
        if urlparse(url).hostname != "images.unsplash.com":
            raise ValueError(f"Host de imagen no permitido: {url}")
        destination = ROOT / image["file"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        request = Request(url, headers={"User-Agent": "NEXORA-static-builder/1.0"})
        with urlopen(request, timeout=30) as response:
            content_type = response.headers.get_content_type()
            if content_type != "image/jpeg":
                raise ValueError(f"Formato inesperado para {image['file']}: {content_type}")
            content = response.read(8_000_001)
        if not content or len(content) > 8_000_000:
            raise ValueError(f"Tamaño de imagen inválido: {image['file']}")
        destination.write_bytes(content)
        print(f"Imagen lista: {image['file']} ({len(content):,} bytes)")


if __name__ == "__main__":
    main()
