# Production Deployment Guide

## Server Info
- **IP**: 185.125.200.63
- **Domain**: cashinhash.ru
- **Bot**: @purexprotocol_bot

## 1. Server Setup (Ubuntu 22.04+)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y python3.12 python3.12-venv python3-pip nginx postgresql postgresql-contrib redis-server git

# Create project user
sudo useradd -m -s /bin/bash purex
sudo usermod -aG sudo purex
su - purex
```

## 2. Clone & Setup Code

```bash
# Clone repository (replace with your repo URL)
git clone https://github.com/YOUR_USERNAME/Purex-Protocol.git
cd Purex-Protocol

# Backend setup
cd Backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Copy production env template
cp .env.production .env
# Edit .env with your actual secrets
nano .env

# Database setup
sudo -u postgres psql
CREATE DATABASE purex_protocol;
CREATE USER purex_protocol WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE purex_protocol TO purex_protocol;
\q

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Seed initial data
python manage.py seed_game_data
python manage.py setup_celery_beat
python manage.py generate_bots --count 100

# Collect static files
python manage.py collectstatic --noinput
```

## 3. Frontend Build

```bash
cd ../Front/Phoenix-Protocol
npm install
npm run build
```

## 4. Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/cashinhash.ru
```

```nginx
server {
    listen 80;
    server_name cashinhash.ru www.cashinhash.ru;
    
    # Frontend
    location / {
        root /home/purex/Purex-Protocol/Front/Phoenix-Protocol/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Django admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/cashinhash.ru /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 5. Systemd Services

### Django Backend

```bash
sudo nano /etc/systemd/system/purex-backend.service
```

```ini
[Unit]
Description=Purex Protocol Backend
After=network.target postgresql.service redis.service

[Service]
Type=exec
User=purex
Group=purex
WorkingDirectory=/home/purex/Purex-Protocol/Backend
Environment=PATH=/home/purex/Purex-Protocol/Backend/venv/bin
ExecStart=/home/purex/Purex-Protocol/Backend/venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8001 --workers 3
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Celery Worker

```bash
sudo nano /etc/systemd/system/purex-celery.service
```

```ini
[Unit]
Description=Purex Protocol Celery Worker
After=network.target postgresql.service redis.service

[Service]
Type=exec
User=purex
Group=purex
WorkingDirectory=/home/purex/Purex-Protocol/Backend
Environment=PATH=/home/purex/Purex-Protocol/Backend/venv/bin
ExecStart=/home/purex/Purex-Protocol/Backend/venv/bin/celery -A config worker --loglevel=info
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Celery Beat

```bash
sudo nano /etc/systemd/system/purex-celerybeat.service
```

```ini
[Unit]
Description=Purex Protocol Celery Beat
After=network.target postgresql.service redis.service

[Service]
Type=exec
User=purex
Group=purex
WorkingDirectory=/home/purex/Purex-Protocol/Backend
Environment=PATH=/home/purex/Purex-Protocol/Backend/venv/bin
ExecStart=/home/purex/Purex-Protocol/Backend/venv/bin/celery -A config beat --loglevel=info
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start services
sudo systemctl enable purex-backend purex-celery purex-celerybeat
sudo systemctl start purex-backend purex-celery purex-celerybeat
```

## 6. SSL Certificate (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d cashinhash.ru -d www.cashinhash.ru
sudo systemctl enable certbot.timer
```

## 7. Telegram Bot Setup

1. Set bot domain in BotFather: `https://cashinhash.ru`
2. Set Mini App URL: `https://cashinhash.ru/app`
3. Configure payment provider token in `.env`

## 8. Monitoring

```bash
# Check services
sudo systemctl status purex-backend purex-celery purex-celerybeat nginx postgresql redis

# Check logs
sudo journalctl -u purex-backend -f
sudo journalctl -u purex-celery -f
sudo journalctl -u purex-celerybeat -f

# Check database connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='purex_protocol';"
```

## 9. Updates

```bash
# Pull latest changes
cd /home/purex/Purex-Protocol
git pull

# Backend
cd Backend
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart purex-backend purex-celery purex-celerybeat

# Frontend
cd ../Front/Phoenix-Protocol
npm install
npm run build
```

## 10. Environment Variables Checklist

Edit `/home/purex/Purex-Protocol/Backend/.env`:

```bash
DEBUG=False
SECRET_KEY=your_strong_secret_key_here
ALLOWED_HOSTS=cashinhash.ru,www.cashinhash.ru,185.125.200.63
CORS_ALLOWED_ORIGINS=https://cashinhash.ru,https://www.cashinhash.ru
DATABASE_URL=postgres://purex_protocol:your_password@localhost/purex_protocol
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_BOT_USERNAME=purexprotocol_bot
TELEGRAM_PAYMENT_PROVIDER_TOKEN=your_payment_token
SUPPORT_API_KEY=your_support_key
DOMAIN=cashinhash.ru
```

## 11. Firewall

```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 12. Backup Script (Optional)

```bash
# Create backup script
sudo nano /usr/local/bin/purex-backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/home/purex/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Database backup
sudo -u postgres pg_dump purex_protocol > $BACKUP_DIR/db_$DATE.sql

# Files backup
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /home/purex/Purex-Protocol

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

```bash
sudo chmod +x /usr/local/bin/purex-backup.sh
sudo mkdir /home/purex/backups
sudo chown purex:purex /home/purex/backups

# Add to crontab (daily at 3 AM)
sudo crontab -e
# Add: 0 3 * * * /usr/local/bin/purex-backup.sh
```

## Troubleshooting

### Common Issues

1. **502 Bad Gateway**: Check if backend is running on port 8001
2. **Database connection**: Verify PostgreSQL is running and credentials are correct
3. **Celery tasks not executing**: Check Redis connection and Celery logs
4. **Static files 404**: Run `collectstatic` and check Nginx config

### Performance Tuning

```bash
# PostgreSQL tuning
sudo nano /etc/postgresql/14/main/postgresql.conf
# Set: shared_buffers = 256MB, effective_cache_size = 1GB

# Redis tuning
sudo nano /etc/redis/redis.conf
# Set: maxmemory 256mb, maxmemory-policy allkeys-lru

# Gunicorn workers (2 * CPU cores + 1)
# Update ExecStart in purex-backend.service accordingly
```

### Security

```bash
# Fail2ban for SSH protection
sudo apt install fail2ban
sudo systemctl enable fail2ban

# Regular security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```
