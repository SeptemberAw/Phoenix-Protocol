# Phoenix Protocol

[![Deploy Status](https://img.shieldдаs.io/badge/deploy-active-success)](https://cashinhash.ru)
[![Stack](https://img.shields.io/badge/stack-Django%20%2B%20React-blue)](https://cashinhash.ru)

Telegram Web App для майнинга с интеграцией TON блокчейна и Telegram Stars платежей.

## 🚀 Демо

- **Frontend:** https://cashinhash.ru
- **Admin Panel:** https://cashinhash.ru/admin/

---

## 📁 Структура проекта

```
Phoenix Protocol/
├── Front/                    # React + Vite фронтенд
│   └── Phoenix-Protocol/
│       ├── src/             # Исходный код
│       ├── index.html       # Входная точка
│       ├── vite.config.ts   # Конфиг Vite
│       └── package.json     # Зависимости
├── Back/                     # Django бэкенд (legacy)
└── Backend/                  # Django бэкенд (production)
    ├── accounts/            # Авторизация, пользователи
    ├── economy/             # Экономика, рефералы
    ├── payments/            # Платежи (TON + Stars)
    ├── bot/                 # Telegram бот
    └── core/                # Настройки Django
```

---

## 🛠 Стек технологий

### Backend
- **Django 4.2** — основной фреймворк
- **Django REST Framework** — API
- **Django Jazzmin** — админ-панель
- **PostgreSQL** — база данных
- **Redis** — кеш и брокер Celery
- **Celery** — асинхронные задачи
- **Gunicorn** — WSGI сервер

### Frontend
- **React 18.2** — UI библиотека
- **Vite 6.4** — сборщик
- **Tailwind CSS** — стилизация
- **TonConnect UI** — интеграция TON кошельков
- **Lucide React** — иконки

### Инфраструктура
- **Ubuntu 24.04** — сервер
- **Nginx** — reverse proxy и static files
- **systemd** — управление сервисами

---

## ⚙️ Установка и деплой

### Требования
- Ubuntu 22.04/24.04
- Python 3.12
- Node.js 20.x
- PostgreSQL 15
- Redis 7
- Nginx

### 1. Клонирование

```bash
git clone git@github.com:hoodmission/Phoenix-Protocol.git
cd Phoenix-Protocol
```

### 2. Backend setup

```bash
cd Backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Настройка окружения
cp .env.example .env
# Отредактируй .env — добавь свои ключи

# Миграции
python manage.py migrate
python manage.py createsuperuser
```

### 3. Frontend setup

```bash
cd Front/Phoenix-Protocol
npm install
npm run build
```

### 4. Nginx конфигурация

```bash
sudo cp /etc/nginx/sites-available/phoenix-protocol /etc/nginx/sites-available/phoenix-protocol.backup
sudo nano /etc/nginx/sites-available/phoenix-protocol
```

```nginx
server {
    listen 443 ssl http2;
    server_name cashinhash.ru;

    # Frontend
    location / {
        root /home/purex/Phoenix-Protocol/Front/Phoenix-Protocol/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }
}
```

### 5. Systemd сервисы

**Gunicorn:** `/etc/systemd/system/phoenix-gunicorn.service`
```ini
[Unit]
Description=Phoenix Gunicorn
After=network.target

[Service]
User=purex
Group=purex
WorkingDirectory=/home/purex/Phoenix-Protocol/Backend
ExecStart=/home/purex/Phoenix-Protocol/Backend/.venv/bin/gunicorn core.wsgi:application -b 127.0.0.1:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

**Celery Worker:** `/etc/systemd/system/phoenix-celery.service`
```ini
[Unit]
Description=Phoenix Celery Worker
After=network.target

[Service]
User=purex
Group=purex
WorkingDirectory=/home/purex/Phoenix-Protocol/Backend
ExecStart=/home/purex/Phoenix-Protocol/Backend/.venv/bin/celery -A core worker -l info
Restart=always

[Install]
WantedBy=multi-user.target
```

**Celery Beat:** `/etc/systemd/system/phoenix-celery-beat.service`
```ini
[Unit]
Description=Phoenix Celery Beat
After=network.target

[Service]
User=purex
Group=purex
WorkingDirectory=/home/purex/Phoenix-Protocol/Backend
ExecStart=/home/purex/Phoenix-Protocol/Backend/.venv/bin/celery -A core beat -l info
Restart=always

[Install]
WantedBy=multi-user.target
```

### 6. Запуск

```bash
# Перезагрузить systemd
sudo systemctl daemon-reload

# Запустить сервисы
sudo systemctl start phoenix-gunicorn
sudo systemctl start phoenix-celery
sudo systemctl start phoenix-celery-beat
sudo systemctl restart nginx

# Автозапуск
sudo systemctl enable phoenix-gunicorn phoenix-celery phoenix-celery-beat nginx
```

---

## 🔐 Переменные окружения (.env)

```bash
# Django
DEBUG=False
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=cashinhash.ru,localhost,127.0.0.1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/phoenix_db

# Redis
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0

# Telegram
TELEGRAM_BOT_TOKEN=8180463196:AAF8onhLDlXWa1xZO-NofPl5GErWWeIm4Ug

# TON
TON_API_KEY=your-ton-api-key
TON_CENTER_API_KEY=your-ton-center-api-key
TON_TREASURY_WALLET=EQD...  # Кошелек для получения платежей

# Домен
DOMAIN=cashinhash.ru
```

---

## 📱 API Endpoints

### Аутентификация
| Endpoint | Method | Описание |
|----------|--------|----------|
| `/api/v1/accounts/telegram/` | POST | Авторизация через Telegram |
| `/api/v1/accounts/token/refresh/` | POST | Обновление JWT токена |

### Экономика
| Endpoint | Method | Описание |
|----------|--------|----------|
| `/api/v1/economy/stats/` | GET | Статистика пользователя |
| `/api/v1/economy/click/` | POST | Клик (начисление монет) |
| `/api/v1/economy/referrals/` | GET | Реферальная статистика |

### Платежи
| Endpoint | Method | Описание |
|----------|--------|----------|
| `/api/v1/payments/prices/` | GET | Цены в TON и Stars |
| `/api/v1/payments/create/` | POST | Создать платеж |
| `/api/v1/payments/create-invoice/` | POST | Создать Telegram Stars инвойс |
| `/api/v1/payments/verify/` | POST | Верификация Stars платежа |
| `/api/v1/payments/ton/verify/` | POST | Верификация TON платежа |

### Кошелек
| Endpoint | Method | Описание |
|----------|--------|----------|
| `/api/v1/accounts/wallet/` | POST | Сохранить TON кошелек |

---

## 💳 Типы платежей

| Тип | Описание |
|-----|----------|
| `multitap` | Удвоение хешрейта на 24ч |
| `energy_boost` | Восстановление энергии |
| `autobot` | Авто-майнинг на 24ч |
| `fight_refill` | Пополнение боёв |
| `pvp_recovery` | Восстановление после PVP |
| `network_tier_satellite` | Апгрейд сети Satellite |
| `network_tier_quantum` | Апгрейд сети Quantum |
| `network_tier_singularity` | Апгрейд сети Singularity |

---

## 🛡️ Администрирование

**Доступ к админке:**
- URL: https://cashinhash.ru/admin/
- Логин: `admin`
- Пароль: `PurexAdmin2024!`

**Полезные команды:**

```bash
# Проверка статуса сервисов
sudo systemctl status phoenix-gunicorn phoenix-celery nginx

# Логи
sudo journalctl -u phoenix-gunicorn -f
sudo journalctl -u phoenix-celery -f

# Перезапуск
sudo systemctl restart phoenix-gunicorn phoenix-celery phoenix-celery-beat nginx

# Обновление кода и деплой
cd /home/purex/Phoenix-Protocol
git pull
cd Front/Phoenix-Protocol && npm run build
sudo chown -R www-data:www-data dist
sudo systemctl restart phoenix-gunicorn nginx
```

---

## 🐛 Известные проблемы

1. **TON оплата** — требуется доработка верификации транзакций
2. **Сохранение кошелька** — endpoint создан, требуется тестирование на разных устройствах
3. **Размер бандла** — frontend chunk >500KB, рекомендуется code splitting

---

## 📄 Лицензия

Private — все права защищены.

---
