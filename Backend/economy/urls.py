from django.urls import path

from .views import QuestClaimView, ReferralListView, TransactionListView

urlpatterns = [
    path("transactions/", TransactionListView.as_view(), name="transactions"),
    path("quest/claim/", QuestClaimView.as_view(), name="quest-claim"),
    path("referrals/", ReferralListView.as_view(), name="referrals"),
]
