from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.views.static import serve as static_serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path("admin/", admin.site.urls),

    # API v1
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/members/", include("apps.members.urls")),
    path("api/v1/events/", include("apps.events.urls")),
    path("api/v1/memberships/", include("apps.memberships.urls")),
    path("api/v1/payments/", include("apps.payments.urls")),
    path("api/v1/certificates/", include("apps.certificates.urls")),
    path("api/v1/departments/", include("apps.departments.urls")),
    path("api/v1/documents/", include("apps.documents.urls")),
    path("api/v1/notifications/", include("apps.notifications.urls")),
    path("api/v1/portfolios/", include("apps.portfolios.urls")),
    path("api/v1/blog/", include("apps.blog.urls")),
    path("api/v1/projects/", include("apps.projects.urls")),
    path("api/v1/engagement/", include("apps.engagement.urls")),

    # Documentation API
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

# Fichiers média (avatars, CV...) : servis par Django dans tous les environnements
# (pas de CDN/nginx dédié pour l'instant). Sur Render, le disque n'étant pas
# persistant, ces fichiers ne survivent pas à un redéploiement.
urlpatterns += [
    path(
        f"{settings.MEDIA_URL.lstrip('/')}<path:path>",
        static_serve,
        {"document_root": settings.MEDIA_ROOT},
    ),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [path("__debug__/", include(debug_toolbar.urls))]
