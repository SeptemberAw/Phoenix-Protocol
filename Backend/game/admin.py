from django.contrib import admin

from .models import NetworkTier, UpgradeConfig, UserUpgrade


@admin.register(UpgradeConfig)
class UpgradeConfigAdmin(admin.ModelAdmin):
    list_display = ("config_id", "name", "category", "base_cost", "cost_multiplier", "max_level", "benefit_per_level", "is_active", "sort_order")
    list_filter = ("category", "is_active")
    list_editable = ("base_cost", "cost_multiplier", "max_level", "benefit_per_level", "is_active", "sort_order")
    search_fields = ("config_id", "name")


@admin.register(UserUpgrade)
class UserUpgradeAdmin(admin.ModelAdmin):
    list_display = ("user", "config", "level")
    list_filter = ("config__category",)
    search_fields = ("user__telegram_username", "config__config_id")
    raw_id_fields = ("user",)


@admin.register(NetworkTier)
class NetworkTierAdmin(admin.ModelAdmin):
    list_display = ("name", "multiplier", "requirement_type", "requirement_value", "stars_cost", "sort_order")
    list_editable = ("multiplier", "requirement_value", "stars_cost", "sort_order")
