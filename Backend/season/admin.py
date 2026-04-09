from django.contrib import admin

from .models import Season, SeasonHistory


@admin.register(Season)
class SeasonAdmin(admin.ModelAdmin):
    list_display = ("number", "name", "is_active", "started_at", "ended_at")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(SeasonHistory)
class SeasonHistoryAdmin(admin.ModelAdmin):
    list_display = ("season", "profile", "final_balance", "final_rank", "final_generation")
    list_filter = ("season",)
    search_fields = ("profile__telegram_username",)
    raw_id_fields = ("profile",)
