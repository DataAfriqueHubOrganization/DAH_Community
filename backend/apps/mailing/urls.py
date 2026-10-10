from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MemberEmailViewSet, NewsletterSubscriberViewSet, newsletter_subscribe, newsletter_unsubscribe

router = DefaultRouter()
router.register("emails", MemberEmailViewSet, basename="member-email")
router.register("newsletter/subscribers", NewsletterSubscriberViewSet, basename="newsletter-subscriber")

urlpatterns = [
    path("newsletter/subscribe/", newsletter_subscribe, name="newsletter-subscribe"),
    path("newsletter/unsubscribe/", newsletter_unsubscribe, name="newsletter-unsubscribe"),
    path("", include(router.urls)),
]
