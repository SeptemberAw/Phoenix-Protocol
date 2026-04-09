from django.urls import path

from .views import PvPResolveView, PvPSearchView

urlpatterns = [
    path("search/", PvPSearchView.as_view(), name="pvp-search"),
    path("resolve/", PvPResolveView.as_view(), name="pvp-resolve"),
]
