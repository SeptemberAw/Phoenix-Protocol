from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render
from django.db.models import Count, Sum
from django.db.models.functions import TruncDay
from django.utils import timezone
from datetime import timedelta
import json

from accounts.models import UserProfile
from economy.models import TransactionHistory
from pvp.models import PvPMatch
from payments.models import PaymentTransaction


@staff_member_required
def dashboard_view(request):
    # Основная статистика
    total_users = UserProfile.objects.count()
    active_users_today = UserProfile.objects.filter(
        user__last_login__date=timezone.now().date()
    ).count()
    
    # Статистика PvP
    total_battles = PvPMatch.objects.count()
    battles_today = PvPMatch.objects.filter(
        created_at__date=timezone.now().date()
    ).count()
    
    # Активность юзеров (пики и среднее)
    active_users_7days = []
    for i in range(7):
        date = timezone.now() - timedelta(days=i)
        count = UserProfile.objects.filter(
            user__last_login__date=date.date()
        ).count()
        active_users_7days.append(count)
    
    peak_active = max(active_users_7days) if active_users_7days else 0
    avg_active = sum(active_users_7days) / len(active_users_7days) if active_users_7days else 0
    
    # Статистика оплат
    total_payments = PaymentTransaction.objects.filter(status='completed').aggregate(
        total=Sum('amount')
    )['total'] or 0
    
    payments_today = PaymentTransaction.objects.filter(
        status='completed',
        created_at__date=timezone.now().date()
    ).aggregate(
        total=Sum('amount')
    )['total'] or 0
    
    # Новые юзеры за последние 7 дней
    new_users_7days = UserProfile.objects.filter(
        created_at__gte=timezone.now() - timedelta(days=7)
    ).count()
    
    # Графики
    users_chart = []
    activity_chart = []
    payments_chart = []
    
    for i in range(30):
        date = timezone.now() - timedelta(days=i)
        
        # Новые юзеры
        new_count = UserProfile.objects.filter(
            created_at__date=date.date()
        ).count()
        users_chart.append({
            'date': date.strftime('%m-%d'),
            'count': new_count
        })
        
        # Активность (логины)
        active_count = UserProfile.objects.filter(
            user__last_login__date=date.date()
        ).count()
        activity_chart.append({
            'date': date.strftime('%m-%d'),
            'count': active_count
        })
        
        # Оплаты
        payment_total = PaymentTransaction.objects.filter(
            status='completed',
            created_at__date=date.date()
        ).aggregate(total=Sum('amount'))['total'] or 0
        payments_chart.append({
            'date': date.strftime('%m-%d'),
            'amount': float(payment_total)
        })
    
    # Разворачиваем массивы для правильного порядка
    users_chart.reverse()
    activity_chart.reverse()
    payments_chart.reverse()
    
    context = {
        'total_users': total_users,
        'active_users_today': active_users_today,
        'peak_active': peak_active,
        'avg_active': round(avg_active, 1),
        'total_payments': total_payments,
        'payments_today': payments_today,
        'new_users_7days': new_users_7days,
        'users_chart': json.dumps(users_chart),
        'activity_chart': json.dumps(activity_chart),
        'payments_chart': json.dumps(payments_chart),
        'title': 'Purex Protocol Dashboard',
    }
    
    return render(request, 'admin/dashboard.html', context)
