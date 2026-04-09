from django.db import models

from accounts.models import UserProfile


class UpgradeConfig(models.Model):
    CATEGORY_CHOICES = [
        ("energy", "Energy"),
        ("mining", "Mining"),
        ("recharge", "Recharge"),
        ("passive", "Passive"),
    ]

    config_id = models.CharField(max_length=20, unique=True, help_text="e.g. u1, u2")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    base_cost = models.DecimalField(max_digits=20, decimal_places=4)
    cost_multiplier = models.FloatField(default=1.5)
    max_level = models.IntegerField(default=20)
    benefit_per_level = models.FloatField(default=0, help_text="500 for energy, 0.005 for mining power, etc.")
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "config_id"]

    def __str__(self):
        return f"{self.config_id}: {self.name} ({self.category})"


class UserUpgrade(models.Model):
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="upgrades")
    config = models.ForeignKey(UpgradeConfig, on_delete=models.CASCADE, related_name="user_upgrades")
    level = models.IntegerField(default=0)

    class Meta:
        unique_together = ("user", "config")

    def __str__(self):
        return f"{self.user} | {self.config.config_id} lvl {self.level}"


class BlockFeed(models.Model):
    """Server-generated extraction block entries shown in the mining feed."""
    block_number = models.IntegerField(unique=True)
    block_hash = models.CharField(max_length=20)
    reward = models.DecimalField(max_digits=12, decimal_places=2)
    finder = models.CharField(max_length=50)
    difficulty = models.CharField(max_length=10)
    participants = models.IntegerField(default=3)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Block #{self.block_number} — {self.reward} PUREX"


class NetworkTier(models.Model):
    REQUIREMENT_CHOICES = [
        ("mined_amount", "Mined Amount"),
        ("referrals", "Referrals"),
        ("stars_payment", "Stars Payment"),
    ]

    name = models.CharField(max_length=100, unique=True)
    multiplier = models.FloatField(default=1.0)
    requirement_type = models.CharField(max_length=20, choices=REQUIREMENT_CHOICES)
    requirement_value = models.IntegerField(default=0)
    stars_cost = models.IntegerField(default=0, help_text="Cost in Telegram Stars if paid tier")
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order"]

    def __str__(self):
        return f"{self.name} (x{self.multiplier})"
