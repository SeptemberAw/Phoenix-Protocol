from django.db import models

from accounts.models import UserProfile


class Season(models.Model):
    name = models.CharField(max_length=100)
    number = models.IntegerField(unique=True)
    is_active = models.BooleanField(default=False)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-number"]

    def __str__(self):
        status = "ACTIVE" if self.is_active else "ENDED"
        return f"Season {self.number}: {self.name} ({status})"


class SeasonHistory(models.Model):
    season = models.ForeignKey(Season, on_delete=models.CASCADE, related_name="history_entries")
    profile = models.ForeignKey(UserProfile, on_delete=models.CASCADE, related_name="season_history")
    final_balance = models.DecimalField(max_digits=20, decimal_places=4)
    final_rank = models.IntegerField(default=0)
    final_generation = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("season", "profile")
        ordering = ["final_rank"]

    def __str__(self):
        return f"S{self.season.number} | {self.profile.telegram_username} | rank={self.final_rank}"
