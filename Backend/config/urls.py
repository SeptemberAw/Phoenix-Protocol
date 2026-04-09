from django.contrib import admin
from django.urls import include, path
from admin.views import dashboard_view

urlpatterns = [
    path("admin/dashboard/", dashboard_view, name='admin_dashboard'),
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/", include("game.urls")),
    path("api/v1/pvp/", include("pvp.urls")),
    path("api/v1/economy/", include("economy.urls")),
    path("api/v1/payments/", include("payments.urls")),
    path("api/v1/season/", include("season.urls")),
]

admin.site.site_header = "Purex Protocol Admin"
admin.site.site_title = "Purex Protocol"
admin.site.index_title = "Game Control Center"
