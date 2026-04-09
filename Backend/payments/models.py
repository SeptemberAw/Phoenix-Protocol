from django.db import models

from accounts.models import UserProfile


class PaymentTransaction(models.Model):
    PAYMENT_TYPE_CHOICES = [
        ("verification", "Identity Verification"),
        ("fight_refill", "Fight Refill"),
        ("network_tier", "Network Tier Upgrade"),
        ("energy_boost", "Energy Boost"),
        ("multitap", "Turbo Uplink"),
        ("autobot", "Auto Miner"),
        ("pvp_recovery", "PvP Recovery"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("refunded", "Refunded"),
    ]

    PROVIDER_CHOICES = [
        ("telegram_stars", "Telegram Stars"),
        ("ton", "TON"),
    ]

    profile = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="payments")
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES)
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    amount = models.DecimalField(max_digits=20, decimal_places=4, default=0, help_text="Amount in provider currency")
    payload = models.JSONField(default=dict, blank=True)
    telegram_payment_charge_id = models.CharField(max_length=255, blank=True, default="")
    provider_payment_charge_id = models.CharField(max_length=255, blank=True, default="")
    ton_tx_hash = models.CharField(
        max_length=100, blank=True, default="", db_index=True,
        help_text="TON transaction hash for on-chain verification (unique per payment)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["profile", "payment_type"], name="idx_payment_profile_type"),
            models.Index(fields=["provider"], name="idx_payment_provider"),
        ]

    def __str__(self):
        return f"Payment({self.profile.telegram_id} | {self.payment_type} | {self.status})"
