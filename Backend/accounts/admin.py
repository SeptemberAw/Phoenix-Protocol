from datetime import timedelta
from decimal import Decimal

from django import forms
from django.contrib import admin, messages
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db.models import Count
from django.shortcuts import redirect, render
from django.urls import path

from django.utils import timezone as tz

from economy.services import log_transaction
from .models import BotProfile, UserProfile

User = get_user_model()


# ─── Override Django User admin: show only staff/superusers ───
admin.site.unregister(User)


@admin.register(User)
class StaffUserAdmin(BaseUserAdmin):
    """Only show staff/superuser accounts, not game players."""

    def get_queryset(self, request):
        return super().get_queryset(request).filter(is_staff=True)


# ─── Forms ───────────────────────────────────────────
class GiveTakeCashForm(forms.Form):
    ACTION_CHOICES = [("give", "Give"), ("take", "Take")]
    action = forms.ChoiceField(choices=ACTION_CHOICES)
    amount = forms.DecimalField(max_digits=20, decimal_places=4, min_value=Decimal("0.01"))
    reason = forms.CharField(max_length=500, required=False, initial="Admin action")


class UserProfileAdminForm(forms.ModelForm):
    enable_auto_mining = forms.BooleanField(
        required=False,
        label="Enable Auto-Miner (24h)",
        help_text="Check to enable auto-mining for 24 hours. Uncheck to disable."
    )
    enable_turbo_boost = forms.BooleanField(
        required=False,
        label="Enable Turbo x2 (24h)",
        help_text="Check to enable turbo boost (x2) for 24 hours. Uncheck to disable."
    )

    class Meta:
        model = UserProfile
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.fields['enable_auto_mining'].initial = bool(
                self.instance.auto_mining_until and self.instance.auto_mining_until > tz.now()
            )
            self.fields['enable_turbo_boost'].initial = bool(
                self.instance.turbo_boost_until and self.instance.turbo_boost_until > tz.now()
            )


class GenerateBotsForm(forms.Form):
    count = forms.IntegerField(min_value=1, max_value=500, initial=50, label="Number of bots")
    min_balance = forms.IntegerField(min_value=0, initial=50000, label="Min balance")
    max_balance = forms.IntegerField(min_value=1, initial=100000000, label="Max balance")


# ─── UserProfile Admin (real players only) ───────────
@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    form = UserProfileAdminForm
    list_display = (
        "telegram_id",
        "telegram_username",
        "balance",
        "energy",
        "generation",
        "is_mining",
        "is_verified",
        "has_auto_mining",
        "has_turbo",
        "is_banned",
        "is_shadow_banned",
        "aggressor_level",
        "fights_left",
        "network_tier",
    )
    list_filter = ("is_verified", "is_banned", "is_shadow_banned", "is_mining", "network_tier", "generation")
    search_fields = ("telegram_id", "telegram_username", "referral_code")
    readonly_fields = ("created_at", "updated_at", "referral_code", "last_energy_update", "last_sync_time", "mining_started_at", "energy_depleted_at", "auto_mining_until", "turbo_boost_until")
    change_form_template = "admin/accounts/userprofile/change_form.html"
    fieldsets = (
        ("Identity", {"fields": ("user", "telegram_id", "telegram_username", "avatar_url", "referral_code", "referred_by")}),
        ("Economy", {"fields": ("balance", "week_earned", "month_earned", "season_balance", "networth", "lifetime_balance")}),
        ("Energy", {"fields": ("energy", "max_energy", "last_energy_update")}),
        ("Mining", {"fields": ("is_mining", "mining_started_at")}),
        ("Paid Boosts", {"fields": ("enable_auto_mining", "auto_mining_until", "enable_turbo_boost", "turbo_boost_until", "energy_depleted_at")}),
        ("Progression", {"fields": ("generation", "rank_score", "network_tier")}),
        ("PvP", {"fields": ("aggressor_level", "fights_left")}),
        ("Verification", {"fields": ("is_verified",)}),
        ("Ban", {"fields": ("is_banned", "ban_until", "ban_reason", "is_shadow_banned", "is_bot")}),
        ("Timestamps", {"fields": ("created_at", "updated_at", "last_sync_time")}),
    )

    @admin.display(boolean=True, description="Auto-Miner")
    def has_auto_mining(self, obj):
        return bool(obj.auto_mining_until and obj.auto_mining_until > tz.now())

    @admin.display(boolean=True, description="Turbo x2")
    def has_turbo(self, obj):
        return bool(obj.turbo_boost_until and obj.turbo_boost_until > tz.now())

    def save_model(self, request, obj, form, change):
        now = tz.now()
        if form.cleaned_data.get('enable_auto_mining'):
            if not (obj.auto_mining_until and obj.auto_mining_until > now):
                obj.auto_mining_until = now + timedelta(hours=24)
                obj.is_mining = True
                obj.mining_started_at = now
        else:
            obj.auto_mining_until = None

        if form.cleaned_data.get('enable_turbo_boost'):
            if not (obj.turbo_boost_until and obj.turbo_boost_until > now):
                obj.turbo_boost_until = now + timedelta(hours=24)
        else:
            obj.turbo_boost_until = None

        super().save_model(request, obj, form, change)

    def get_queryset(self, request):
        return super().get_queryset(request).filter(is_bot=False)

    def get_urls(self):
        custom_urls = [
            path(
                "<path:object_id>/give-take-cash/",
                self.admin_site.admin_view(self.give_take_cash_view),
                name="accounts-give-take-cash",
            ),
            path(
                "leaderboard/",
                self.admin_site.admin_view(self.leaderboard_view),
                name="accounts-leaderboard",
            ),
        ]
        return custom_urls + super().get_urls()

    def leaderboard_view(self, request):
        PERIOD_FIELDS = {"week": "week_earned", "month": "month_earned", "all": "networth"}
        PERIOD_LABELS = {"week": "Weekly (Earned This Week)", "month": "Monthly (Month Earned)", "all": "All Time (Networth)"}
        BALANCE_LABELS = {"week": "Week Earned", "month": "Month Earned", "all": "Networth"}

        period = request.GET.get("period", "week")
        if period not in PERIOD_FIELDS:
            period = "week"
        include_bots = request.GET.get("include_bots") == "1"

        balance_field = PERIOD_FIELDS[period]
        qs = UserProfile.objects.all()
        if not include_bots:
            qs = qs.filter(is_bot=False)
        qs = qs.filter(is_banned=False)

        entries = (
            qs.annotate(ref_count=Count("referrals"))
            .order_by(f"-{balance_field}")[:100]
        )

        result = []
        for rank_idx, p in enumerate(entries, start=1):
            result.append({
                "rank": rank_idx,
                "pk": p.pk,
                "username": p.telegram_username or f"Player_{p.telegram_id}",
                "telegram_id": p.telegram_id,
                "balance": round(max(0, float(getattr(p, balance_field))), 2),
                "networth": round(max(0, float(p.networth)), 2),
                "generation": p.generation,
                "referral_count": p.ref_count,
                "network_tier": p.network_tier,
                "is_bot": p.is_bot,
                "created_at": p.created_at,
            })

        return render(request, "admin/accounts/leaderboard.html", {
            "entries": result,
            "period": period,
            "period_label": PERIOD_LABELS[period],
            "balance_label": BALANCE_LABELS[period],
            "include_bots": include_bots,
            "total_players": UserProfile.objects.filter(is_bot=False, is_banned=False).count(),
            "total_bots": UserProfile.objects.filter(is_bot=True).count(),
            "title": f"Leaderboard — {PERIOD_LABELS[period]}",
        })

    def give_take_cash_view(self, request, object_id):
        profile = UserProfile.objects.get(pk=object_id)
        if request.method == "POST":
            form = GiveTakeCashForm(request.POST)
            if form.is_valid():
                action = form.cleaned_data["action"]
                amount = form.cleaned_data["amount"]
                reason = form.cleaned_data.get("reason", "Admin action")

                if action == "take" and amount > profile.balance:
                    messages.error(request, f"Cannot take {amount} — player only has {profile.balance}")
                    return redirect("..")

                if action == "give":
                    profile.balance += amount
                    # Earning trackers: give counts as earned income
                    profile.week_earned += amount
                    profile.month_earned += amount
                    profile.season_balance += amount
                    profile.networth += amount
                    profile.lifetime_balance += amount  # legacy
                    log_transaction(profile, "admin_give", amount, f"Admin gave {amount}: {reason}")
                    messages.success(request, f"Gave {amount} to {profile.telegram_username or profile.telegram_id}")
                else:
                    # Take: only reduces spendable balance, NOT earning trackers
                    profile.balance -= amount
                    if profile.balance < 0:
                        profile.balance = Decimal("0")
                    log_transaction(profile, "admin_take", -amount, f"Admin took {amount}: {reason}")
                    messages.success(request, f"Took {amount} from {profile.telegram_username or profile.telegram_id}")

                profile.save(update_fields=["balance", "week_earned", "month_earned", "season_balance", "networth", "lifetime_balance"])
                return redirect("..")
        else:
            form = GiveTakeCashForm()
        return render(request, "admin/accounts/give_take_cash.html", {
            "form": form,
            "profile": profile,
            "title": f"Give/Take Cash — {profile.telegram_username or profile.telegram_id}",
        })


# ─── BotProfile Admin (bots only) ────────────────────
@admin.register(BotProfile)
class BotProfileAdmin(admin.ModelAdmin):
    list_display = (
        "telegram_id",
        "telegram_username",
        "balance",
        "generation",
        "aggressor_level",
        "network_tier",
    )
    list_filter = ("generation", "network_tier")
    search_fields = ("telegram_id", "telegram_username")
    readonly_fields = ("created_at", "updated_at", "referral_code")
    change_list_template = "admin/accounts/botprofile/change_list.html"
    fieldsets = (
        ("Identity", {"fields": ("telegram_id", "telegram_username", "avatar_url")}),
        ("Economy", {"fields": ("balance", "week_earned", "month_earned", "season_balance", "networth", "lifetime_balance")}),
        ("Progression", {"fields": ("generation", "rank_score", "network_tier")}),
        ("PvP", {"fields": ("aggressor_level", "fights_left")}),
    )

    def get_urls(self):
        custom_urls = [
            path("generate/", self.admin_site.admin_view(self.generate_bots_view), name="accounts-generate-bots"),
        ]
        return custom_urls + super().get_urls()

    def generate_bots_view(self, request):
        if request.method == "POST":
            form = GenerateBotsForm(request.POST)
            if form.is_valid():
                from django.core.management import call_command
                from io import StringIO
                out = StringIO()
                call_command(
                    "generate_bots",
                    count=form.cleaned_data["count"],
                    min_balance=form.cleaned_data["min_balance"],
                    max_balance=form.cleaned_data["max_balance"],
                    stdout=out,
                )
                messages.success(request, out.getvalue().strip())
                return redirect("..")
        else:
            form = GenerateBotsForm()
        return render(request, "admin/accounts/generate_bots.html", {
            "form": form,
            "title": "Generate Bot Opponents",
        })
