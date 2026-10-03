import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.blog.models import Article, ArticleCategory, ArticleComment, ArticleLike

User = get_user_model()


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def bureau(db):
    return User.objects.create_user(email="sg@dah.test", password="x", first_name="SG", last_name="", role="membre", poste="secretaire_general")


@pytest.fixture
def member(db):
    return User.objects.create_user(email="m@dah.test", password="x", first_name="M", last_name="", role="membre")


@pytest.mark.django_db
class TestCategories:
    def test_creation_depuis_l_editeur(self, bureau):
        r = client_for(bureau).post("/api/v1/blog/manage/categories/", {"name": "Événements"}, format="json")
        assert r.status_code == 201
        assert r.data["slug"] == "evenements"
        r2 = client_for(bureau).post("/api/v1/blog/manage/categories/", {"name": "Evenements"}, format="json")
        assert r2.status_code == 201 and r2.data["slug"] == "evenements-2"

    def test_reservee_au_bureau(self, member):
        assert client_for(member).post("/api/v1/blog/manage/categories/", {"name": "X"}, format="json").status_code == 403


@pytest.mark.django_db
def test_compteurs_dans_la_liste_admin(bureau, member):
    article = Article.objects.create(title="Retour Data Tour", content="<p>x</p>", status="published", author=bureau)
    ArticleLike.objects.create(article=article, user=member)
    ArticleComment.objects.create(article=article, author=member, content="Bravo")
    ArticleComment.objects.create(article=article, author=bureau, content="Merci")
    r = client_for(bureau).get("/api/v1/blog/manage/articles/")
    rows = r.data["results"] if isinstance(r.data, dict) else r.data
    row = next(a for a in rows if a["id"] == article.id)
    assert row["likes_count"] == 1 and row["comments_count"] == 2


@pytest.mark.django_db
def test_article_programme_visible_une_fois_la_date_passee(bureau):
    from datetime import timedelta
    from django.utils import timezone

    past = Article.objects.create(title="Passé", content="x", status="scheduled", author=bureau,
                                  published_at=timezone.now() - timedelta(hours=1))
    Article.objects.create(title="Futur", content="x", status="scheduled", author=bureau,
                           published_at=timezone.now() + timedelta(days=1))
    titles = [a["title"] for a in APIClient().get("/api/v1/blog/").data]
    assert titles == ["Passé"]
    assert APIClient().get(f"/api/v1/blog/{past.slug}/").status_code == 200
