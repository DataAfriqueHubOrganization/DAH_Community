from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CashEntryViewSet, ContributionViewSet, MyContributionsView

router = DefaultRouter()
router.register("contributions", ContributionViewSet, basename="contribution")
router.register("cash", CashEntryViewSet, basename="cash-entry")

urlpatterns = [
    path("me/", MyContributionsView.as_view(), name="my-contributions"),
    *router.urls,
]
