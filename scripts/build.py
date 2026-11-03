"""Build the NEXORA static site from templates and JSON source content."""

from __future__ import annotations

import json
import posixpath
import shutil
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = ROOT / "templates"
DATA_DIR = ROOT / "data"
ASSETS_DIR = ROOT / "assets"
PAGES_DIR = ROOT / "pages"
DIST_DIR = ROOT / "dist"

environment = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
    trim_blocks=True,
    lstrip_blocks=True,
)


def load_json(path: Path):
    try:
        with path.open("r", encoding="utf-8") as source:
            return json.load(source)
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"No se pudo leer JSON válido en {path.relative_to(ROOT)}: {error}") from error


def load_site_data():
    categories = load_json(DATA_DIR / "categories.json")
    if not isinstance(categories, list) or not categories:
        raise ValueError("data/categories.json debe contener una lista de categorías.")
    seen_urls = set()
    for category in categories:
        for key in ("name", "description", "url"):
            if not isinstance(category.get(key), str) or not category[key].strip():
                raise ValueError(f"Categoría inválida: falta el campo '{key}'.")
        url = Path(category["url"])
        if url.is_absolute() or ".." in url.parts or url.suffix.lower() != ".html":
            raise ValueError(f"URL de categoría inválida: {category['url']}")
        if category["url"] in seen_urls:
            raise ValueError(f"URL de categoría duplicada: {category['url']}")
        seen_urls.add(category["url"])

    config_path = DATA_DIR / "site.json"
    config = load_json(config_path) if config_path.exists() else {}
    if not isinstance(config, dict):
        raise ValueError("data/site.json debe contener un objeto JSON.")
    legal_pages = load_json(DATA_DIR / "legal.json")
    if not isinstance(legal_pages, list) or not legal_pages:
        raise ValueError("data/legal.json debe contener una lista de páginas legales.")
    image_manifest = load_json(DATA_DIR / "images.json")
    learning_guides = load_json(DATA_DIR / "learning_guides.json")
    ai_guide = learning_guides.get("inteligencia-artificial", {})
    if ai_guide.get("quick_task_labels"):
        groups_by_plan = {"free": ai_guide.get("free_groups", []), "paid": ai_guide.get("paid_groups", [])}
        quick_tasks = []
        for task in ai_guide["quick_task_labels"]:
            entry = {"id": task["id"], "label": task["label"], "free": [], "paid": []}
            for plan, groups in groups_by_plan.items():
                for group in groups:
                    if group.get("task_key") == task["id"]:
                        for tool in group.get("items", []):
                            host = urlsplit(tool.get("site", "")).hostname or ""
                            tool["logo_domain"] = host.removeprefix("www.")
                            entry[plan].append({**tool, "task": group["task"], "plan": plan})
            if not entry["free"] and not entry["paid"]:
                raise ValueError(f"No hay recomendaciones de IA para la tarea '{task['label']}'.")
            quick_tasks.append(entry)
        ai_guide["quick_tasks"] = quick_tasks
    game_catalog = learning_guides.get("videojuegos", {}).get("recommendations", [])
    for category in categories:
        image_key = Path(category["url"]).parent.name
        image = image_manifest.get(image_key)
        if not image or not image.get("file") or not image.get("alt") or not image.get("source"):
            raise ValueError(f"Falta una imagen local con texto alternativo y fuente para {category['name']}.")
        if not (ROOT / image["file"]).is_file():
            raise ValueError(f"No existe el archivo de imagen {image['file']}.")
        category["image"] = image
        category["guide"] = learning_guides.get(image_key)
        category["game_recommendations"] = (
            game_catalog if image_key == "videojuegos" else
            [game for game in game_catalog if image_key in game.get("skills", [])]
        )

    lessons = []
    if PAGES_DIR.exists():
        for content_path in sorted(PAGES_DIR.rglob("contenido.json")):
            lesson = load_json(content_path)
            validate_lesson(lesson, content_path)
            exam_path = content_path.with_name("examen.json")
            if not exam_path.exists():
                raise ValueError(f"Falta examen.json para la lección {content_path.parent.relative_to(ROOT)}.")
            exam = load_json(exam_path)
            validate_exam(exam, exam_path)
            lessons.append((content_path, lesson, exam))
    return categories, config, lessons, legal_pages, image_manifest


def validate_lesson(lesson, path: Path):
    if not isinstance(lesson, dict):
        raise ValueError(f"La lección de {path.relative_to(ROOT)} debe ser un objeto JSON.")
    for key in ("title", "description", "category", "introduction", "sections", "summary"):
        if key not in lesson:
            raise ValueError(f"Falta '{key}' en {path.relative_to(ROOT)}.")
    if len(lesson["sections"]) != 3:
        raise ValueError(f"La lección de {path.relative_to(ROOT)} debe tener exactamente tres apartados entre la introducción y el examen.")
    for number, section in enumerate(lesson["sections"], start=1):
        if not section.get("title") or len(section.get("paragraphs", [])) < 2:
            raise ValueError(f"El apartado {number} de {path.relative_to(ROOT)} necesita título y contenido desarrollado.")


def validate_exam(exam, path: Path):
    if not isinstance(exam, dict) or not isinstance(exam.get("questions", []), list):
        raise ValueError(f"Examen inválido en {path.relative_to(ROOT)}: 'questions' debe ser una lista.")
    if not exam.get("questions"):
        raise ValueError(f"El examen de {path.relative_to(ROOT)} necesita al menos una pregunta.")
    for number, question in enumerate(exam.get("questions", []), start=1):
        options = question.get("options", [])
        answer = question.get("answer")
        if not question.get("question") or len(options) < 2 or not isinstance(answer, int) or not 0 <= answer < len(options):
            raise ValueError(f"Pregunta {number} inválida en {path.relative_to(ROOT)}.")
        if not question.get("explanation"):
            raise ValueError(f"La pregunta {number} no tiene explicación en {path.relative_to(ROOT)}.")


def render(template_name: str, output: Path, **context):
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(environment.get_template(template_name).render(**context), encoding="utf-8")


def language_switch_url(route: Path, locale: str) -> str:
    current = route if locale == "es" else Path("en") / route
    target = Path("en") / route if locale == "es" else route
    return posixpath.relpath(target.as_posix(), current.parent.as_posix())


def build_site(locale="es", output_dir=DIST_DIR):
    categories, config, lessons, legal_pages, image_manifest = load_site_data()
    year = date.today().year
    site_url = config.get("site_url", "").strip().rstrip("/")
    if site_url and not site_url.startswith(("https://", "http://")):
        raise ValueError("site_url en data/site.json debe comenzar por https:// o http://.")

    translations = load_json(DATA_DIR / "i18n.json")
    localized = translations.get(locale, {})
    ai_guide = next((category.get("guide") for category in categories if Path(category["url"]).parent.name == "inteligencia-artificial"), {})
    if locale == "en":
        for task in ai_guide.get("quick_task_labels", []):
            task["label"] = localized.get("ai_tasks", {}).get(task["id"], task["label"])
        for task in ai_guide.get("quick_tasks", []):
            task["label"] = localized.get("ai_tasks", {}).get(task["id"], task["label"])
    if locale == "en":
        for category in categories:
            key = Path(category["url"]).parent.name
            translated = localized.get("categories", {}).get(key, {})
            category["original_name"] = category["name"]
            category.update({k: v for k, v in translated.items() if k != "subcategories"})
            subcategory_translations = translated.get("subcategories", {})
            for item in category.get("subcategories", []):
                item.update(subcategory_translations.get(item["name"], {}))

    environment.globals["locale"] = locale
    environment.globals["t"] = localized.get("ui", {})

    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)
    if ASSETS_DIR.exists():
        shutil.copytree(ASSETS_DIR, output_dir / "assets")

    lesson_items = [
        {"title": lesson["title"], "description": lesson["description"],
         "search": lesson.get("search", ""),
         "url": (Path("pages") / Path(*source.parent.relative_to(PAGES_DIR).parts)).as_posix() + "/"}
        for source, lesson, _exam in lessons
    ]
    render("index.html", output_dir / "index.html", categories=categories, current_year=year,
           base_path="", home_url="index.html", site_url=site_url,
           language_url="en/index.html" if locale == "es" else "../index.html",
           lesson_items=lesson_items,
           search_items=[
               {"title": category["name"], "description": category["description"],
                "search": category.get("search", ""), "url": category["url"]}
               for category in categories
           ] + [
               {"title": item["name"], "description": item["description"],
                "search": item.get("search", ""), "url": category["url"] + "#" + item["slug"]}
               for category in categories for item in category.get("subcategories", [])
           ] + [
               {"title": item["title"], "description": item["description"],
                "search": item["search"], "url": item["url"] + "index.html"}
               for item in lesson_items
           ],
           canonical_url=urljoin(site_url + "/", "en/" if locale == "en" else "") if site_url else "")

    generated_urls = ["index.html"]
    for category in categories:
        route = Path(category["url"])
        subcategories = category.get("subcategories", [])
        category_lessons = []
        for content_path, lesson, _exam in lessons:
            if lesson.get("category") == category.get("original_name", category["name"]):
                lesson_route = content_path.parent.relative_to(PAGES_DIR / route.parent.relative_to("pages")) / "index.html"
                category_lessons.append({**lesson, "url": lesson_route.as_posix()})
        render("category.html", output_dir / route, category=category, categories=categories,
               subcategories=subcategories, lessons=category_lessons, current_year=year,
               base_path="../" * max(0, len(route.parent.parts)),
               home_url="../../index.html", site_url=site_url,
               language_url=language_switch_url(route, locale),
               canonical_url=urljoin(site_url + "/", ("en/" if locale == "en" else "") + route.as_posix()) if site_url else "")
        generated_urls.append(route.as_posix())

    for index, (content_path, lesson, exam) in enumerate(lessons):
        route = Path(*content_path.parent.relative_to(PAGES_DIR).parts) / "index.html"
        output = output_dir / "pages" / route
        depth = len(route.parent.parts) + 1
        relative_root = "../" * depth
        def neighbor_url(neighbor):
            if neighbor is None:
                return None
            neighbor_path = Path(*neighbor[0].parent.relative_to(PAGES_DIR).parts) / "index.html"
            return posixpath.relpath(neighbor_path.parent.as_posix(), route.parent.as_posix()) + "/"

        previous = lessons[index - 1] if index > 0 else None
        following = lessons[index + 1] if index + 1 < len(lessons) else None
        render("lesson.html", output, lesson=lesson, exam=exam, current_year=year,
               base_path=relative_root, home_url=relative_root + "index.html", site_url=site_url,
               language_url=language_switch_url(Path("pages") / route, locale),
               result_url=relative_root + "resultados/index.html",
               result_lesson_url=posixpath.relpath((Path("pages") / route.parent).as_posix(), "resultados") + "/",
               category_image=next((image_manifest[Path(category["url"]).parent.name]
                                    for category in load_json(DATA_DIR / "categories.json")
                                    if category["name"] == lesson["category"]), None),
               canonical_url=urljoin(site_url + "/", ("en/" if locale == "en" else "") + (Path("pages") / route).as_posix()) if site_url else "",
               previous_lesson={"title": previous[1]["title"], "url": neighbor_url(previous)} if previous else None,
               next_lesson={"title": following[1]["title"], "url": neighbor_url(following)} if following else None)
        generated_urls.append((Path("pages") / route).as_posix())

    render("results.html", output_dir / "resultados" / "index.html", current_year=year,
           base_path="../", home_url="../index.html", site_url=site_url,
           language_url="../../resultados/index.html" if locale == "en" else "../en/resultados/index.html",
           canonical_url="")

    for page in legal_pages:
        route = f"{page['slug']}.html"
        render("legal.html", output_dir / route, page=page, current_year=year,
               base_path="", home_url="index.html", site_url=site_url,
               language_url=f"en/{route}" if locale == "es" else f"../{route}",
               contact_email=config.get("contact_email", ""), publisher=config.get("publisher", ""),
               canonical_url=urljoin(site_url + "/", ("en/" if locale == "en" else "") + route) if site_url else "")
        generated_urls.append(route)

    render("credits.html", output_dir / "creditos.html", images=image_manifest.values(),
           current_year=year, base_path="", home_url="index.html", site_url=site_url,
           language_url="en/creditos.html" if locale == "es" else "../creditos.html",
           canonical_url=urljoin(site_url + "/", ("en/" if locale == "en" else "") + "creditos.html") if site_url else "")
    generated_urls.append("creditos.html")

    (output_dir / "404.html").write_text(
        environment.get_template("404.html").render(current_year=year, base_path="", home_url="index.html"),
        encoding="utf-8",
    )
    if site_url and locale == "es":
        sitemap_urls = [urljoin(site_url + "/", url) for url in generated_urls]
        sitemap_urls += [urljoin(site_url + "/", "en/" + url) for url in generated_urls]
        sitemap = environment.get_template("sitemap.xml").render(urls=sitemap_urls)
        (output_dir / "sitemap.xml").write_text(sitemap, encoding="utf-8")
        (output_dir / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {site_url}/sitemap.xml\n", encoding="utf-8")
    elif locale == "es":
        (output_dir / "robots.txt").write_text("User-agent: *\nAllow: /\n", encoding="utf-8")
    print(f"NEXORA [{locale}] generado: {len(categories)} categorías, {len(lessons)} lecciones. Salida: {output_dir}")


if __name__ == "__main__":
    try:
        build_site("es", DIST_DIR)
        build_site("en", DIST_DIR / "en")
    except (ValueError, OSError, KeyError) as error:
        print(f"Error de construcción: {error}", file=sys.stderr)
        sys.exit(1)


