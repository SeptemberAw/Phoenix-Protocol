import uuid

from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    telegram_id = models.BigIntegerField(unique=True, db_index=True)
    telegram_username = models.CharField(max_length=255, blank=True, default="")
    avatar_url = models.URLField(blank=True, default="")

    balance = models.DecimalField(max_digits=20, decimal_places=4, default=0)
    # Earning trackers — only grow, reset periodically
    week_earned = models.DecimalField(max_digits=20, decimal_places=4, default=0, help_text="Earned this week — reset every Monday")
    month_earned = models.DecimalField(max_digits=20, decimal_places=4, default=0, help_text="Earned this month — reset monthly")
    season_balance = models.DecimalField(max_digits=20, decimal_places=4, default=0, help_text="Earned this season — reset on season end only")
    networth = models.DecimalField(max_digits=20, decimal_places=4, default=0, help_text="Total all-time earnings — never decreases")
    lifetime_balance = models.DecimalField(max_digits=20, decimal_places=4, default=0, help_text="Legacy field — mirrors balance historically")

    # Peak rank tracking — best (lowest) rank ever achieved per period
    peak_week_rank = models.IntegerField(default=0, help_text="Best weekly rank ever achieved (0 = unranked)")
    peak_month_rank = models.IntegerField(default=0, help_text="Best monthly rank ever achieved (0 = unranked)")
    peak_all_time_rank = models.IntegerField(default=0, help_text="Best all-time rank ever achieved (0 = unranked)")

    energy = models.IntegerField(default=6000)
    max_energy = models.IntegerField(default=6000)
    last_energy_update = models.DateTimeField(auto_now_add=True)
    last_sync_time = models.DateTimeField(auto_now_add=True)

    generation = models.IntegerField(default=1)
    rank_score = models.IntegerField(default=0)

    is_mining = models.BooleanField(default=False)
    mining_started_at = models.DateTimeField(null=True, blank=True)
    last_mining_toggle = models.DateTimeField(null=True, blank=True, help_text="Cooldown: last start/stop action")

    auto_mining_until = models.DateTimeField(null=True, blank=True, help_text="Auto-miner active until (24h paid boost, no energy cost)")
    last_auto_harvest = models.DateTimeField(null=True, blank=True, help_text="Last time auto-mining was harvested")
    turbo_boost_until = models.DateTimeField(null=True, blank=True, help_text="Turbo x2 mining boost active until (24h paid boost)")
    energy_depleted_at = models.DateTimeField(null=True, blank=True, help_text="When energy last hit 0 (for notification stub)")

    aggressor_level = models.FloatField(default=0)
    last_attack_at = models.DateTimeField(null=True, blank=True, help_text="When user last initiated a PvP attack (for aggressor decay)")
    daily_attacks_initiated = models.IntegerField(default=0, help_text="Attacks initiated today (0=green/immune, 1-2=yellow, 3+=red/priority)")
    fights_left = models.IntegerField(default=5)

    is_verified = models.BooleanField(default=False)

    is_banned = models.BooleanField(default=False)
    ban_until = models.DateTimeField(null=True, blank=True)
    ban_reason = models.CharField(max_length=500, blank=True, default="")
    is_shadow_banned = models.BooleanField(default=False)
    is_bot = models.BooleanField(default=False, help_text="Bot opponent for PvP")

    referral_code = models.CharField(max_length=20, unique=True, db_index=True)
    referred_by = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="referrals"
    )

    ton_wallet_address = models.CharField(
        max_length=100, blank=True, default="",
        help_text="Connected TON wallet address (raw or user-friendly)",
    )

    network_tier = models.CharField(
        max_length=50,
        choices=[
            ("Neural Link", "Neural Link"),
            ("Satellite Grid", "Satellite Grid"),
            ("Quantum Mesh", "Quantum Mesh"),
            ("Singularity", "Singularity"),
        ],
        default="Neural Link",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["balance"], name="idx_profile_balance"),
            models.Index(fields=["aggressor_level"], name="idx_profile_aggressor"),
        ]

    def save(self, *args, **kwargs):
        if not self.referral_code:
            self.referral_code = uuid.uuid4().hex[:12]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Profile({self.telegram_id} | {self.telegram_username})"

    @property
    def network_multiplier(self) -> float:
        mapping = {
            "Neural Link": 1.0,
            "Satellite Grid": 1.5,
            "Quantum Mesh": 2.0,
            "Singularity": 4.0,
        }
        return mapping.get(self.network_tier, 1.0)


class BotProfile(UserProfile):
    """Proxy model for bot opponents — separate admin list."""

    class Meta:
        proxy = True
        verbose_name = "Bot"
        verbose_name_plural = "Bots"

    class BotManager(models.Manager):
        def get_queryset(self):
            return super().get_queryset().filter(is_bot=True)

    objects = BotManager()
