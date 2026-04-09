from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import InitView, SupportLookupView, TelegramAuthView
from .bot_api import bot_start_command

urlpatterns = [
    path("telegram/", TelegramAuthView.as_view(), name="telegram-auth"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("init/", InitView.as_view(), name="init"),
    path("bot/start/", bot_start_command, name="bot-start"),
    path("support-lookup/", SupportLookupView.as_view(), name="support-lookup"),
]
