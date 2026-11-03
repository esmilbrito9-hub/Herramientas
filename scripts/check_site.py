"""Check generated NEXORA pages, local links, and private source data."""

from __future__ import annotations

import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = set()
        self.duplicate_ids = set()
        self.robots = ""
        self.result_lesson_urls = []
        self.language = ""

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html":
            self.language = attrs.get("lang", "")
        if attrs.get("id"):
            if attrs["id"] in self.ids:
                self.duplicate_ids.add(attrs["id"])
            self.ids.add(attrs["id"])
        if attrs.get("name", "").lower() == "robots":
            self.robots = attrs.get("content", "")
        if attrs.get("data-result-lesson-url"):
            self.result_lesson_urls.append(attrs["data-result-lesson-url"])
        for key in ("href", "src", "data-result-url"):
            if attrs.get(key):
                self.links.append((key, attrs[key]))


def main():
    failures = []
    categories = json.loads((ROOT / "data" / "categories.json").read_text(encoding="utf-8"))
    html_files = sorted(DIST.rglob("*.html"))
    if not (DIST / "index.html").is_file():
        failures.append("Falta dist/index.html")
    english_home = DIST / "en" / "index.html"
    if not english_home.is_file():
        failures.append("Falta la versión en inglés de la página principal")
    elif '<html lang="en">' not in english_home.read_text(encoding="utf-8"):
        failures.append("La página inglesa no declara lang=en")
    if not (DIST / "404.html").is_file() or (DIST / "404.html").stat().st_size == 0:
        failures.append("Falta la página 404 generada")
    for category in categories:
        if not (DIST / Path(category["url"])).is_file():
            failures.append(f"Falta la página de categoría: {category['url']}")
        if not category.get("subcategories"):
            failures.append(f"La categoría no tiene subcategorías: {category['name']}")
        if not (DIST / "en" / Path(category["url"])).is_file():
            failures.append(f"Falta la versión inglesa de la categoría: {category['url']}")
    for page in ("privacidad.html", "cookies.html", "terminos.html", "contacto.html"):
        if not (DIST / page).is_file():
            failures.append(f"Falta la página informativa: {page}")
    if not (DIST / "creditos.html").is_file():
        failures.append("Falta la página de créditos visuales")
    if not (DIST / "resultados" / "index.html").is_file():
        failures.append("Falta la página independiente de resultados del examen")
    elif 'content="noindex,nofollow"' not in (DIST / "resultados" / "index.html").read_text(encoding="utf-8"):
        failures.append("La página de resultados debe excluirse de los buscadores")
    if not (DIST / "assets" / "js" / "results.js").is_file() or not (DIST / "assets" / "css" / "results.css").is_file():
        failures.append("Faltan los recursos de presentación de resultados")
    ai_page = DIST / "pages" / "inteligencia-artificial" / "index.html"
    if ai_page.is_file():
        ai_html = ai_page.read_text(encoding="utf-8")
        for marker in ("Familias y capacidades de la IA", "Opciones gratuitas", "Opciones de pago", "2026"):
            if marker not in ai_html:
                failures.append(f"Falta en la guía de inteligencia artificial: {marker}")
        if ai_html.count('data-plan-panel=') != 2:
            failures.append("La guía de IA no genera los dos paneles de precio")
        ai_guide = json.loads((ROOT / "data" / "learning_guides.json").read_text(encoding="utf-8"))["inteligencia-artificial"]
        expected_recommendations = sum(len(group.get("items", [])) for plan in ("free_groups", "paid_groups") for group in ai_guide.get(plan, []))
        if 'id="aiTaskSelect"' not in ai_html or ai_html.count('class="ai-quick-card"') != expected_recommendations:
            failures.append("El selector de tareas de IA no muestra todas las recomendaciones registradas")
        if ai_html.count('class="ai-inline-logo"') != expected_recommendations:
            failures.append("Falta el logo de una herramienta en las listas detalladas de IA")
        for task in ai_guide.get("quick_task_labels", []):
            if f'value="{task["id"]}"' not in ai_html or f'data-ai-task-panel="{task["id"]}"' not in ai_html:
                failures.append(f"Falta la opción o el panel de recomendación de IA: {task['label']}")
    games_page = DIST / "pages" / "videojuegos" / "index.html"
    if games_page.is_file():
        games_html = games_page.read_text(encoding="utf-8")
        for product in ("Blockly Games", "CodeCombat", "CodinGame", "Coddy", "DragonBox Algebra", "Influent", "Universe Sandbox", "Kahoot!"):
            if product not in games_html:
                failures.append(f"Falta una recomendación en videojuegos: {product}")
        if games_html.count('class="game-recommendation-card"') != 9:
            failures.append("La sección de videojuegos no contiene las nueve fichas previstas")
        if games_html.count('class="game-logo"') != 9 or games_html.count('alt="Logo de ') < 9:
            failures.append("Cada recomendación de videojuegos debe incluir una imagen de logo con texto alternativo")
    programming_page = DIST / "pages" / "programacion" / "index.html"
    language_page = DIST / "pages" / "idiomas" / "index.html"
    if programming_page.is_file() and "Coddy" not in programming_page.read_text(encoding="utf-8"):
        failures.append("La categoría de programación no muestra Coddy")
    if language_page.is_file() and "Influent" not in language_page.read_text(encoding="utf-8"):
        failures.append("La categoría de idiomas no muestra Influent")
    if language_page.is_file() and "Coddy" in language_page.read_text(encoding="utf-8"):
        failures.append("Se muestra una recomendación de programación en idiomas")
    for source in (ROOT / "pages").rglob("contenido.json"):
        lesson = json.loads(source.read_text(encoding="utf-8"))
        if len(lesson.get("sections", [])) != 3:
            failures.append(f"La lección no tiene tres apartados: {source.relative_to(ROOT)}")
    for image in (ROOT / "assets" / "images").glob("*"):
        if image.is_file() and not (DIST / "assets" / "images" / image.name).is_file():
            failures.append(f"Falta la imagen copiada a dist: {image.name}")
    if list(DIST.rglob("*.json")):
        failures.append("Se copiaron archivos JSON internos a dist")

    parsed = {}
    for file in html_files:
        parser = LinkParser()
        parser.feed(file.read_text(encoding="utf-8"))
        parsed[file] = parser
        if parser.duplicate_ids:
            failures.append(f"Hay identificadores repetidos en {file.relative_to(DIST)}")

    for file, parser in parsed.items():
        if file.relative_to(DIST).parts[0] == "en" and parser.language != "en":
            failures.append(f"La página inglesa no declara lang=en: {file.relative_to(DIST)}")
        for kind, raw in parser.links:
            url = urlsplit(raw)
            if url.scheme or url.netloc or raw.startswith(("data:", "mailto:", "tel:")):
                continue
            path = unquote(url.path)
            target = (file.parent / path).resolve() if path else file.resolve()
            if path.endswith("/"):
                target = target / "index.html"
            if path and not target.is_file():
                failures.append(f"Enlace local roto en {file.relative_to(DIST)}: {raw}")
                continue
            if url.fragment:
                destination = target if target.is_file() else file.resolve()
                if destination in parsed and unquote(url.fragment) not in parsed[destination].ids:
                    failures.append(f"Ancla inexistente en {file.relative_to(DIST)}: {raw}")
        for raw in parser.result_lesson_urls:
            destination = (DIST / "resultados" / unquote(urlsplit(raw).path)).resolve()
            if raw.endswith("/"):
                destination = destination / "index.html"
            if not destination.is_file():
                failures.append(f"La ruta de regreso desde resultados no existe en {file.relative_to(DIST)}: {raw}")

    result_page = DIST / "resultados" / "index.html"
    if result_page in parsed and parsed[result_page].robots != "noindex,nofollow":
        failures.append("La página de resultados no declara noindex,nofollow")

    lesson_files = list(DIST.glob("pages/**/index.html"))
    print(f"Páginas HTML: {len(html_files)}; categorías: {len(categories)}; páginas bajo pages/: {len(lesson_files)}")
    if failures:
        print("VERIFICACIÓN FALLIDA:")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("Verificación correcta: enlaces locales, anclas, categorías y privacidad de JSON.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
