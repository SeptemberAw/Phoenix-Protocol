import os
from datetime import timedelta
from pathlib import Path
from celery.schedules import crontab

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("SECRET_KEY", "insecure-dev-key-change-me")

DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

INSTALLED_APPS = [
    "jazzmin",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    "django_celery_beat",
    # Project apps
    "core",
    "accounts",
    "game",
    "pvp",
    "economy",
    "payments",
    "season",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.BanCheckMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Support both sqlite:// and postgres:// DATABASE_URL
db_url = os.getenv("DATABASE_URL", "")
if db_url.startswith("sqlite://"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", "purex_protocol"),
            "USER": os.getenv("POSTGRES_USER", "purex_protocol"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", "purex_protocol"),
            "HOST": os.getenv("POSTGRES_HOST", "postgres"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
        }
    }

_redis_url = os.getenv("REDIS_URL", "")
if _redis_url and not _redis_url.startswith("redis://redis:"):
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": _redis_url,
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
            },
        }
    }
else:
    # Fallback to local memory cache when Redis is not available
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "purex-protocol-cache",
        }
    }

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ──────────────────────────────────────────────
# CORS
# ──────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173"
).split(",")
CORS_ALLOW_CREDENTIALS = True

# ──────────────────────────────────────────────
# DRF
# ──────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_THROTTLE_CLASSES": [
        "core.throttling.GameBurstRateThrottle",
        "core.throttling.GameSustainedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "game_burst": "60/min",
        "game_sustained": "600/hour",
    },
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    "EXCEPTION_HANDLER": "core.utils.custom_exception_handler",
}

# ──────────────────────────────────────────────
# SimpleJWT
# ──────────────────────────────────────────────
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=24),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "username",
    "USER_ID_CLAIM": "user_id",
}

# ──────────────────────────────────────────────
# Celery
# ──────────────────────────────────────────────
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/1")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# Periodic tasks
CELERY_BEAT_SCHEDULE = {
    'generate-block-every-minute': {
        'task': 'generate_block',
        'schedule': 60.0,  # Every 60 seconds
    },
    'reset-weekly-earnings': {
        'task': 'reset_weekly_earnings',
        'schedule': crontab(hour=0, minute=0, day_of_week='monday'),  # Every Monday midnight UTC
    },
    'reset-monthly-earnings': {
        'task': 'reset_monthly_earnings',
        'schedule': crontab(hour=0, minute=0, day_of_month=1),  # 1st of month at midnight
    },
    'cleanup-old-blocks-daily': {
        'task': 'cleanup_old_blocks', 
        'schedule': 86400.0,  # Every 24 hours
    },
    'decay-aggressor-levels': {
        'task': 'decay_aggressor_levels',
        'schedule': 3600.0,  # Every hour
    },
    'reset-daily-fights': {
        'task': 'reset_daily_fights',
        'schedule': 86400.0,  # Every 24 hours at midnight
    },
    'auto-stop-zero-energy-miners': {
        'task': 'auto_stop_zero_energy_miners',
        'schedule': 300.0,  # Every 5 minutes
    },
}

# ──────────────────────────────────────────────
# Redis
# ──────────────────────────────────────────────
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))

# ──────────────────────────────────────────────
# Telegram
# ──────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "purexprotocol_bot")

# ──────────────────────────────────────────────
# Game Constants
# ──────────────────────────────────────────────
ENERGY_REGEN_PER_SEC = int(os.getenv("ENERGY_REGEN_PER_SEC", "5"))
ENERGY_COST_RATIO = int(os.getenv("ENERGY_COST_RATIO", "50"))
MAX_ENERGY_DEFAULT = int(os.getenv("MAX_ENERGY_DEFAULT", "6000"))
ENERGY_DEFAULT = int(os.getenv("ENERGY_DEFAULT", "6000"))
REFERRAL_BONUS_PERCENT = float(os.getenv("REFERRAL_BONUS_PERCENT", "0.10"))  # 10% of referral mining

# ──────────────────────────────────────────────
# Support Bot
# ──────────────────────────────────────────────
SUPPORT_API_KEY = os.getenv("SUPPORT_API_KEY", "")

# ──────────────────────────────────────────────
# TON Payments
# ──────────────────────────────────────────────
TON_TREASURY_WALLET = os.getenv("TON_TREASURY_WALLET", "")  # Project wallet address (user-friendly)
TON_API_KEY = os.getenv("TON_API_KEY", "")  # toncenter.com API key
TON_API_BASE = os.getenv("TON_API_BASE", "https://toncenter.com/api/v3")
TON_IS_TESTNET = os.getenv("TON_IS_TESTNET", "false").lower() in ("true", "1")

# Prices in nanoTON (1 TON = 1_000_000_000 nanoTON)
TON_PRICES = {
    "verification": 0.5,      # 0.5 TON
    "fight_refill": 0.3,      # 0.3 TON
    "network_tier": 0.5,      # 0.5 TON (base, can vary by tier)
    "energy_boost": 0.2,      # 0.2 TON
    "multitap": 0.3,          # 0.3 TON
    "autobot": 0.5,           # 0.5 TON
    "pvp_recovery": 0.05,     # 0.05 TON
}

# Stars prices (centralized here for reference)
STARS_PRICES = {
    "verification": 100,
    "fight_refill": 150,
    "network_tier_satellite": 100,
    "network_tier_quantum": 250,
    "network_tier_singularity": 500,
    "energy_boost": 50,
    "multitap": 100,
    "autobot": 200,
    "pvp_recovery": 50,
}

# ──────────────────────────────────────────────
# Jazzmin Admin Theme
# ──────────────────────────────────────────────
JAZZMIN_SETTINGS = {
    "site_title": "Purex Protocol Admin",
    "site_header": "Purex Protocol Administration",
    "site_logo": "",
    "login_logo": "",
    "site_logo_classes": "img-circle",
    "login_signin": "Sign In",
    "login_welcome": "Welcome to Purex Protocol Admin Panel",
    "welcome_sign": "Welcome to Purex Protocol",
    "copyright": "Purex Protocol",
    "navigation_expanded": True,
    "show_ui_builder": False,
    "hide_models": ["auth.Group"],
    "order_with_respect_to": [
        "accounts",
        "accounts.UserProfile",
        "accounts.BotProfile",
        "pvp",
        "economy",
        "payments",
        "season",
        "auth",
    ],
    "menu_flatten": [],
    "custom_links": {
        "accounts": [{
            "name": "📊 Dashboard",
            "url": "/admin/dashboard/",
            "icon": "fas fa-chart-line",
        }],
    },
    "menu_include": [],
    "menu_exclude": [],
    "custom_css": "",
    "custom_js": "",
    "theme": "dark",
    "custom_css": "body { background: #050505 !important; color: #FFFFFF !important; } .navbar { background: #111111 !important; border-bottom: 2px solid #FF3B00 !important; } .sidebar { background: #0D0D0D !important; } .btn-primary { background: #FF3B00 !important; border-color: #FF3B00 !important; color: #000000 !important; } .btn-primary:hover { background: #CC2F00 !important; } .card { background: #111111 !important; border: 1px solid #FF3B00 !important; } .table { background: #111111 !important; color: #FFFFFF !important; } .table th { background: #0D0D0D !important; color: #FF3B00 !important; } .form-control { background: #0D0D0D !important; border: 1px solid #333333 !important; color: #FFFFFF !important; }",
    "buttons": {
        "show": True,
        "actions": [],
        "add_form": True,
        "change_form": True,
        "list": True,
        "class": "btn-info",
    },
    "related_modal": False,
    "changeform_format": "single",
    "changeform_tabs": True,
    "search_form": True,
    "show_view_switcher": True,
    "preserve_filters": True,
    "date_hierarchy": True,
    "pagination": {
        "show": True,
        "per_page": [25, 50, 100],
    },
    "actions": {
        "show": True,
        "position": "top",
        "class": "btn-primary",
    },
    "detail_links": {
        "show": True,
        "class": "btn-primary",
    },
    "language_selector": True,
    "user_avatar": None,
}
REPLAY_PROTECTION_TTL = 300
