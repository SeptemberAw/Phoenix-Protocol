from django.db import models

from accounts.models import UserProfile


class TransactionHistory(models.Model):
    TX_TYPE_CHOICES = [
        ("mining", "Mining"),
        ("upgrade", "Upgrade"),
        ("ascend", "Ascend"),
        ("pvp_attack", "PvP Attack"),
        ("pvp_defend", "PvP Defend"),
        ("quest_reward", "Quest Reward"),
        ("referral_bonus", "Referral Bonus"),
        ("payment", "Payment"),
        ("season_reset", "Season Reset"),
        ("admin_adjust", "Admin Adjustment"),
        ("admin_give", "Admin Give"),
        ("admin_take", "Admin Take"),
    ]

    profile = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="transactions")
    tx_type = models.CharField(max_length=20, choices=TX_TYPE_CHOICES, db_index=True)
    amount = models.DecimalField(max_digits=20, decimal_places=4)
    balance_after = models.DecimalField(max_digits=20, decimal_places=4)
    detail = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["profile", "tx_type", "created_at"], name="idx_tx_profile_type"),
        ]

    def __str__(self):
        return f"TX({self.profile.telegram_id} | {self.tx_type} | {self.amount})"


class Quest(models.Model):
    TYPE_CHOICES = [
        ("social", "Social"),
        ("referral", "Referral"),
        ("wallet", "Wallet"),
        ("partner", "Partner"),
        ("daily", "Daily"),
    ]

    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    reward = models.IntegerField(default=0, help_text="CHASH reward amount")
    action_url = models.URLField(blank=True, default="")
    target_progress = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
    icon_key = models.CharField(max_length=50, blank=True, default="star", help_text="Lucide icon key")
    button_label = models.CharField(max_length=50, blank=True, default="Start")
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "-created_at"]

    def __str__(self):
        return f"Quest: {self.title} ({self.type})"


class UserQuest(models.Model):
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="quests")
    quest = models.ForeignKey(Quest, on_delete=models.CASCADE, related_name="user_quests")
    progress = models.IntegerField(default=0)
    is_claimed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("user", "quest")

    def __str__(self):
        return f"{self.user} | {self.quest.title} ({self.progress}/{self.quest.target_progress})"
