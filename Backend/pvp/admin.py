from django.contrib import admin

from .models import PvPConfig, PvPMatch


@admin.register(PvPConfig)
class PvPConfigAdmin(admin.ModelAdmin):
    list_display = (
        "win_chance", "win_multiplier", "tax_percent",
        "cooldown_same_opponent_minutes", "aggressor_increase_per_fight", "daily_fight_limit",
    )

    def has_add_permission(self, request):
        return not PvPConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PvPMatch)
class PvPMatchAdmin(admin.ModelAdmin):
    list_display = ("attacker", "defender", "wager", "result", "attacker_delta", "defender_delta", "tax_burned", "created_at")
    list_filter = ("result", "created_at")
    search_fields = ("attacker__telegram_username", "defender__telegram_username")
    readonly_fields = ("attacker", "defender", "wager", "result", "attacker_delta", "defender_delta", "tax_burned", "created_at")
    date_hierarchy = "created_at"
