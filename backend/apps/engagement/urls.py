from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import AdjustmentView, AwardViewSet, CheckInViewSet, MyPointsView, RankingView

router = DefaultRouter()
router.register("checkins", CheckInViewSet, basename="checkin")
router.register("awards", AwardViewSet, basename="award")

urlpatterns = [
    path("ranking/", RankingView.as_view(), name="engagement-ranking"),
    path("me/", MyPointsView.as_view(), name="engagement-me"),
    path("adjustments/", AdjustmentView.as_view(), name="engagement-adjustments"),
    *router.urls,
]
