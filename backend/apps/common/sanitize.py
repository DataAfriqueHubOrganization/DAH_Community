"""Nettoyage du HTML saisi dans les éditeurs (articles, descriptions d'événements).

Le contenu est affiché tel quel sur le site (dangerouslySetInnerHTML) : seules les
balises de mise en forme de l'éditeur sont conservées ; scripts, gestionnaires
d'événements (onclick…), styles et liens javascript: sont supprimés.
"""
import re

import nh3

ALLOWED_TAGS = {
    "p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s",
    "ul", "ol", "li", "blockquote", "a", "img", "hr", "code", "pre",
}
ALLOWED_ATTRIBUTES = {
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "title"},
}
URL_SCHEMES = {"http", "https", "mailto"}

_LOOKS_LIKE_HTML = re.compile(r"^\s*<")


def clean_html(value: str) -> str:
    if not value:
        return value
    return nh3.clean(
        value,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes=URL_SCHEMES,
        link_rel="noopener noreferrer",
    )


def clean_rich_text(value: str) -> str:
    """Pour les champs qui acceptent HTML *ou* texte brut (anciens contenus) :
    le texte brut est laissé intact, il est affiché comme du texte côté site."""
    if value and _LOOKS_LIKE_HTML.match(value):
        return clean_html(value)
    return value
