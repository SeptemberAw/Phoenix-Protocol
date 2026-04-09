from django.contrib import admin

from .models import PaymentTransaction


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id", "profile", "payment_type", "provider", "status",
        "amount", "created_at", "completed_at",
    )
    list_filter = ("provider", "payment_type", "status", "created_at")
    search_fields = (
        "profile__telegram_username", "profile__telegram_id",
        "telegram_payment_charge_id", "ton_tx_hash",
    )
    readonly_fields = (
        "profile", "payment_type", "provider", "status", "amount",
        "payload", "telegram_payment_charge_id", "provider_payment_charge_id",
        "ton_tx_hash", "created_at", "completed_at",
    )
    date_hierarchy = "created_at"
    list_per_page = 50

    fieldsets = (
        ("Payment Info", {
            "fields": ("profile", "payment_type", "provider", "status", "amount"),
        }),
        ("Stars Details", {
            "fields": ("telegram_payment_charge_id", "provider_payment_charge_id"),
            "classes": ("collapse",),
        }),
        ("TON Details", {
            "fields": ("ton_tx_hash",),
            "classes": ("collapse",),
        }),
        ("Payload & Timestamps", {
            "fields": ("payload", "created_at", "completed_at"),
        }),
    )

    def has_add_permission(self, request):
        return False
