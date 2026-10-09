"""Comptes de démonstration (@dah.com) créés par les commandes de seed."""
from decouple import config
from django.core.management.base import CommandError

DEMO_DOMAIN = "@dah.com"
_LOCAL_PASSWORD = "Dah@2024!"  # développement local uniquement (il figure dans le README)


def demo_password() -> str:
    """Mot de passe des comptes de démo : SEED_PASSWORD, obligatoire sur un serveur.

    Le dépôt est public : le mot de passe de développement est connu de tous et
    ne doit jamais protéger un site en ligne (la pré-production contient des
    comptes administrateurs de démo)."""
    password = config("SEED_PASSWORD", default="")
    if password:
        return password
    if config("ENV", default="dev") == "prod":
        raise CommandError(
            "SEED_PASSWORD est obligatoire sur un serveur : définir un mot de passe "
            "propre aux comptes de démo (jamais celui du README)."
        )
    return _LOCAL_PASSWORD
