"""Tests de sécurité transverses (audit d'octobre 2026)."""
import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.accounts.tokens import make_password_reset_token, read_password_reset_token
from apps.blog.models import Article
from apps.events.models import Event

User = get_user_model()
PASSWORD = "Sécurité-2026!"


@pytest.fixture
def member(db):
    return User.objects.create_user(email="membre@dah.test", password=PASSWORD, first_name="M", last_name="",
                                    role="membre", email_verified=True)


@pytest.fixture
def bureau(db):
    return User.objects.create_user(email="sg@dah.test", password=PASSWORD, first_name="S", last_name="",
                                    role="membre", poste="secretaire_general", email_verified=True,
                                    sections=["events", "members", "departments", "news", "ranking"])


def as_user(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def login(client, email, password=PASSWORD):
    return client.post("/api/v1/auth/login/", {"email": email, "password": password}, format="json")


@pytest.mark.django_db
class TestPasswordReset:
    def test_lien_a_usage_unique(self, member):
        token = make_password_reset_token(member)
        client = APIClient()
        body = {"token": token, "new_password": "Nouveau-mdp-2026", "new_password_confirm": "Nouveau-mdp-2026"}
        assert client.post("/api/v1/auth/password/reset/confirm/", body, format="json").status_code == 200
        # Deuxième utilisation du même lien : refusée.
        body["new_password"] = body["new_password_confirm"] = "Encore-autre-2026"
        assert client.post("/api/v1/auth/password/reset/confirm/", body, format="json").status_code == 400

    def test_lien_invalide_apres_changement_de_mot_de_passe(self, member):
        token = make_password_reset_token(member)
        member.set_password("Change-entre-temps-1")
        member.save()
        with pytest.raises(ValueError):
            read_password_reset_token(token)

    def test_jeton_falsifie(self, member):
        with pytest.raises(ValueError):
            read_password_reset_token("MQ.faux-jeton")
        with pytest.raises(ValueError):
            read_password_reset_token("n-importe-quoi")

    def test_reinitialisation_ferme_les_sessions(self, member):
        client = APIClient()
        refresh = login(client, member.email).cookies["refresh_token"].value
        member.refresh_from_db()  # la connexion a mis à jour last_login, qui entre dans le jeton
        body = {"token": make_password_reset_token(member), "new_password": "Nouveau-mdp-2026",
                "new_password_confirm": "Nouveau-mdp-2026"}
        APIClient().post("/api/v1/auth/password/reset/confirm/", body, format="json")
        r = APIClient().post("/api/v1/auth/token/refresh/", {"refresh": refresh}, format="json")
        assert r.status_code == 401

    def test_changement_de_mot_de_passe_ferme_les_autres_sessions(self, member):
        other_device = login(APIClient(), member.email).cookies["refresh_token"].value
        r = as_user(member).post("/api/v1/auth/password/change/", {
            "old_password": PASSWORD, "new_password": "Nouveau-mdp-2026", "new_password_confirm": "Nouveau-mdp-2026",
        }, format="json")
        assert r.status_code == 200 and r.cookies["refresh_token"]["httponly"]
        assert APIClient().post("/api/v1/auth/token/refresh/", {"refresh": other_device}, format="json").status_code == 401


@pytest.mark.django_db
class TestRateLimits:
    def test_force_brute_sur_la_connexion(self, member):
        client = APIClient()
        codes = [login(client, member.email, "mauvais").status_code for _ in range(11)]
        assert codes[:10] == [401] * 10
        assert codes[10] == 429

    def test_quota_par_visiteur_derriere_cloudflare(self, member, settings):
        """Deux visiteurs derrière le même proxy ont chacun leur quota."""
        settings.CLIENT_IP_HEADER = "HTTP_CF_CONNECTING_IP"
        attacker, visitor = APIClient(HTTP_CF_CONNECTING_IP="203.0.113.7"), APIClient(HTTP_CF_CONNECTING_IP="198.51.100.4")
        for _ in range(10):
            login(attacker, member.email, "mauvais")
        assert login(attacker, member.email, "mauvais").status_code == 429
        assert login(visitor, member.email).status_code == 200

    def test_en_tete_ignore_sans_proxy_de_confiance(self, member, settings):
        """Sans proxy déclaré, l'en-tête envoyé par le client ne permet pas de contourner le quota."""
        settings.CLIENT_IP_HEADER = None
        for i in range(10):
            login(APIClient(HTTP_CF_CONNECTING_IP=f"203.0.113.{i}"), member.email, "mauvais")
        assert login(APIClient(HTTP_CF_CONNECTING_IP="203.0.113.99"), member.email, "mauvais").status_code == 429

    def test_demandes_de_reinitialisation(self, member):
        client = APIClient()
        codes = [client.post("/api/v1/auth/password/reset/", {"email": member.email}, format="json").status_code for _ in range(6)]
        assert codes[-1] == 429


@pytest.mark.django_db
class TestStoredXss:
    PAYLOAD = '<p onclick="steal()">Bonjour<script>alert(1)</script> <a href="javascript:alert(1)">lien</a></p><img src=x onerror="alert(1)">'

    def _assert_clean(self, html):
        assert "<script" not in html and "onclick" not in html and "onerror" not in html and "javascript:" not in html
        assert "Bonjour" in html

    def test_article_nettoye_a_l_enregistrement_et_a_la_lecture(self, bureau):
        r = as_user(bureau).post("/api/v1/blog/manage/articles/", {
            "title": "Test", "content": self.PAYLOAD, "status": "published",
        }, format="json")
        assert r.status_code == 201
        self._assert_clean(Article.objects.get(pk=r.data["id"]).content)
        # Ancien contenu non nettoyé en base : nettoyé en sortie.
        Article.objects.filter(pk=r.data["id"]).update(content=self.PAYLOAD)
        self._assert_clean(APIClient().get(f"/api/v1/blog/{r.data['slug']}/").data["content"])

    def test_description_d_evenement(self, bureau):
        from django.utils import timezone
        event = Event.objects.create(title="E", description=self.PAYLOAD, event_type="meetup",
                                     start_date=timezone.now(), is_published=True)
        self._assert_clean(APIClient().get(f"/api/v1/events/{event.pk}/").data["description"])
        r = as_user(bureau).patch(f"/api/v1/events/{event.pk}/", {"description": self.PAYLOAD}, format="json")
        assert r.status_code == 200
        event.refresh_from_db()
        self._assert_clean(event.description)


@pytest.mark.django_db
class TestUploads:
    def test_cv_du_profil_pdf_uniquement(self, member):
        evil = SimpleUploadedFile("cv.html", b"<script>alert(1)</script>", content_type="text/html")
        r = as_user(member).patch("/api/v1/members/me/profile/", {"cv": evil}, format="multipart")
        assert r.status_code == 400

    def test_requete_trop_lourde(self, member):
        from django.http import HttpResponse
        from django.test import RequestFactory

        from apps.common.middleware import MaxRequestSizeMiddleware
        middleware = MaxRequestSizeMiddleware(lambda request: HttpResponse("ok"))
        too_big = RequestFactory().post("/api/v1/members/me/profile/", data=b"x", content_type="application/octet-stream")
        too_big.META["CONTENT_LENGTH"] = str(25 * 1024 * 1024)
        assert middleware(too_big).status_code == 413
        normal = RequestFactory().post("/api/v1/members/me/profile/", data=b"x", content_type="application/octet-stream")
        assert middleware(normal).status_code == 200


@pytest.mark.django_db
class TestAccessControl:
    """Endpoints sensibles : refusés aux anonymes, et aux simples membres."""
    ANONYMOUS_DENIED = [
        ("get", "/api/v1/members/"), ("get", "/api/v1/memberships/candidatures/list/"),
        ("get", "/api/v1/payments/contributions/"), ("get", "/api/v1/payments/cash/"),
        ("get", "/api/v1/payments/declarations/"), ("get", "/api/v1/engagement/ranking/?period=month"),
        ("get", "/api/v1/events/participants/"), ("get", "/api/v1/blog/manage/articles/"),
        ("get", "/api/v1/auth/users/"),
    ]
    MEMBER_DENIED = [
        "/api/v1/members/", "/api/v1/memberships/candidatures/list/", "/api/v1/payments/contributions/", "/api/v1/payments/cash/",
        "/api/v1/payments/declarations/", "/api/v1/events/participants/", "/api/v1/blog/manage/articles/",
        "/api/v1/auth/users/",
    ]

    def test_anonymes(self, db):
        client = APIClient()
        for method, url in self.ANONYMOUS_DENIED:
            assert getattr(client, method)(url).status_code in (401, 403), url

    def test_membres(self, member):
        client = as_user(member)
        for url in self.MEMBER_DENIED:
            assert client.get(url).status_code == 403, url

    def test_un_membre_ne_peut_pas_s_attribuer_un_role(self, member):
        as_user(member).patch("/api/v1/auth/me/", {"role": "admin", "poste": "president", "email": "x@y.z"}, format="json")
        member.refresh_from_db()
        assert member.role == "membre" and member.poste is None and member.email == "membre@dah.test"
