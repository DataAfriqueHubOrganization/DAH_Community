from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.views.static import serve as static_serve
from apps.common.views import private_file
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
    path("api/v1/mailing/", include("apps.mailing.urls")),
    # Documents privés (CV, preuves, justificatifs) : liens signés et expirants.
    path("api/v1/files/", private_file, name="private-file"),

    # Documentation API
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

# Fichiers publics (avatars, couvertures…) : servis par nginx en production
# (emplacement /media/) ; Django prend le relais en développement ou sans nginx.
# Les documents privés ne sont jamais ici (voir apps.common.storage).
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
