from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    CashEntryViewSet, ContributionViewSet, MyContributionsView, PaymentDeclarationViewSet, ReminderView,
)

router = DefaultRouter()
router.register("contributions", ContributionViewSet, basename="contribution")
router.register("cash", CashEntryViewSet, basename="cash-entry")
router.register("declarations", PaymentDeclarationViewSet, basename="payment-declaration")

urlpatterns = [
    path("me/", MyContributionsView.as_view(), name="my-contributions"),
    path("reminders/", ReminderView.as_view(), name="contribution-reminders"),
    *router.urls,
]
