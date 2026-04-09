from django.contrib import admin
from django.contrib.admin import AdminSite
from django.db.models import Count, Sum, Avg
from django.db.models.functions import TruncDay, TruncHour
from django.utils.html import format_html
from django.urls import path
from django.shortcuts import render
from django.http import JsonResponse
from datetime import datetime, timedelta
import json

from accounts.models import UserProfile
from economy.models import Transaction, Quest
from pvp.models import Battle
from payments.models import Payment


class PurexProtocolAdminSite(AdminSite):
    site_header = "Purex Protocol Administration"
    site_title = "Purex Protocol Admin"
    index_title = "Dashboard"
    
    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('dashboard/', self.admin_view(self.dashboard_view), name='dashboard'),
            path('api/stats/', self.admin_view(self.stats_api), name='stats_api'),
        ]
        return custom_urls + urls
    
    def dashboard_view(self, request):
        # Основная статистика
        total_users = UserProfile.objects.count()
        active_users_today = UserProfile.objects.filter(
            user__last_login__date=datetime.now().date()
        ).count()
        
        # Статистика оплат
        total_payments = Payment.objects.filter(status='completed').aggregate(
            total=Sum('amount')
        )['total'] or 0
        
        payments_today = Payment.objects.filter(
            status='completed',
            created_at__date=datetime.now().date()
        ).aggregate(
            total=Sum('amount')
        )['total'] or 0
        
        # Статистика PvP
        total_battles = Battle.objects.count()
        battles_today = Battle.objects.filter(
            created_at__date=datetime.now().date()
        ).count()
        
        # Новые юзеры за последние 7 дней
        new_users_7days = UserProfile.objects.filter(
            created_at__gte=datetime.now() - timedelta(days=7)
        ).count()
        
        context = {
            'total_users': total_users,
            'active_users_today': active_users_today,
            'total_payments': total_payments,
            'payments_today': payments_today,
            'total_battles': total_battles,
            'battles_today': battles_today,
            'new_users_7days': new_users_7days,
            'site_header': self.site_header,
        }
        
        return render(request, 'admin/dashboard.html', context)
    
    def stats_api(self, request):
        # График новых юзеров за последние 30 дней
        users_chart = []
        for i in range(30):
            date = datetime.now() - timedelta(days=i)
            count = UserProfile.objects.filter(
                created_at__date=date.date()
            ).count()
            users_chart.append({
                'date': date.strftime('%Y-%m-%d'),
                'count': count
            })
        users_chart.reverse()
        
        # График оплат за последние 30 дней
        payments_chart = []
        for i in range(30):
            date = datetime.now() - timedelta(days=i)
            total = Payment.objects.filter(
                status='completed',
                created_at__date=date.date()
            ).aggregate(total=Sum('amount'))['total'] or 0
            payments_chart.append({
                'date': date.strftime('%Y-%m-%d'),
                'amount': float(total)
            })
        payments_chart.reverse()
        
        # График активности (бattles) за последние 7 дней
        activity_chart = []
        for i in range(7):
            date = datetime.now() - timedelta(days=i)
            count = Battle.objects.filter(
                created_at__date=date.date()
            ).count()
            activity_chart.append({
                'date': date.strftime('%Y-%m-%d'),
                'count': count
            })
        activity_chart.reverse()
        
        return JsonResponse({
            'users_chart': users_chart,
            'payments_chart': payments_chart,
            'activity_chart': activity_chart,
        })


# Создаем кастомный админ сайт
purex_admin = PurexProtocolAdminSite(name='purex_admin')

# Регистрируем модели
from accounts.admin import UserProfileAdmin
from economy.admin import TransactionAdmin, QuestAdmin
from pvp.admin import BattleAdmin
from payments.admin import PaymentAdmin

purex_admin.register(UserProfile, UserProfileAdmin)
purex_admin.register(Transaction, TransactionAdmin)
purex_admin.register(Quest, QuestAdmin)
purex_admin.register(Battle, BattleAdmin)
purex_admin.register(Payment, PaymentAdmin)
