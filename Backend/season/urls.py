from django.urls import path

from .views import ActiveSeasonView, SeasonHistoryView

urlpatterns = [
    path("active/", ActiveSeasonView.as_view(), name="season-active"),
    path("history/", SeasonHistoryView.as_view(), name="season-history"),
]
