from django.db import models

from accounts.models import UserProfile


class PvPConfig(models.Model):
    win_chance = models.FloatField(default=0.5, help_text="Base win probability (0.0-1.0)")
    win_multiplier = models.FloatField(default=1.3, help_text="Max multiplier on win (capped at 1.3)")
    tax_percent = models.FloatField(default=10.0, help_text="Percentage burned from wager")
    cooldown_same_opponent_minutes = models.IntegerField(default=30)
    aggressor_increase_per_fight = models.FloatField(default=15.0)
    daily_fight_limit = models.IntegerField(default=5)

    class Meta:
        verbose_name = "PvP Configuration"
        verbose_name_plural = "PvP Configuration"

    def save(self, *args, **kwargs):
        self.pk = 1
        if self.win_multiplier > 1.3:
            self.win_multiplier = 1.3
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"PvP Config (win={self.win_chance}, mult={self.win_multiplier}, tax={self.tax_percent}%)"


class PvPMatch(models.Model):
    RESULT_CHOICES = [
        ("win", "Win"),
        ("loss", "Loss"),
    ]

    attacker = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="attacks_made")
    defender = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="attacks_received")
    wager = models.DecimalField(max_digits=20, decimal_places=4)
    result = models.CharField(max_length=10, choices=RESULT_CHOICES)
    attacker_delta = models.DecimalField(max_digits=20, decimal_places=4, help_text="Balance change for attacker")
    defender_delta = models.DecimalField(max_digits=20, decimal_places=4, help_text="Balance change for defender")
    tax_burned = models.DecimalField(max_digits=20, decimal_places=4)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["attacker", "defender", "created_at"], name="idx_pvp_cooldown"),
        ]

    def __str__(self):
        return f"PvP: {self.attacker} vs {self.defender} ({self.result})"
