from django.contrib import admin

from .models import Quest, TransactionHistory, UserQuest


@admin.register(TransactionHistory)
class TransactionHistoryAdmin(admin.ModelAdmin):
    list_display = ("profile", "tx_type", "amount", "balance_after", "created_at")
    list_filter = ("tx_type", "created_at")
    search_fields = ("profile__telegram_username", "profile__telegram_id", "detail")
    readonly_fields = ("profile", "tx_type", "amount", "balance_after", "detail", "created_at")
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Quest)
class QuestAdmin(admin.ModelAdmin):
    list_display = ("title", "type", "reward", "target_progress", "is_active", "icon_key", "sort_order")
    list_filter = ("type", "is_active")
    list_editable = ("reward", "target_progress", "is_active", "sort_order")
    search_fields = ("title",)


@admin.register(UserQuest)
class UserQuestAdmin(admin.ModelAdmin):
    list_display = ("user", "quest", "progress", "is_claimed", "completed_at")
    list_filter = ("is_claimed", "quest__type")
    search_fields = ("user__telegram_username",)
    raw_id_fields = ("user",)
