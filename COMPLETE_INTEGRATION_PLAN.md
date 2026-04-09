# Полный план интеграции Frontend-Backend для CashinHash

## 📋 **Объединённый анализ: Текущее состояние vs Требования**

### 🎯 **Текущий статус (из моего анализа):**
- **60% готовности** — майнинг, PvP, апгрейды работают
- **Проблема:** Dev mode fallbacks, mock данные
- **Отсутствуют:** notifications, recent blocks, network tiers API

### 📊 **Требования (из твоей спецификации):**
- **Source of Truth** — бэкенд должен контролировать всю логику
- **Anti-cheat** — валидация всех действий на бэкенде
- **Оффлайн-майнинг** — расчёт при логине
- **Синхронизация** — регулярная проверка состояния

---

## 🗄️ **Структура БД: Текущая vs Требуемая**

### **Текущие модели (Backend):**
```python
# accounts/models.py
UserProfile - ✅ Существует, но не все поля
- telegram_id, username, balance, energy, generation ✅
- max_energy, is_mining, fights_left, aggressor_level ✅
- last_energy_update ✅
- ❌ current_network (только hardcoded)
- ❌ last_sync_time (нужно для оффлайн-майнинга)

# economy/models.py  
TransactionHistory - ✅ Существует
Quest - ✅ Существует
- ❌ UserTask (нужно для прогресса заданий)

# game/models.py
Upgrade - ✅ Существует, но отличается структура
- ❌ UserUpgrade (нужна M2M связь)

# pvp/models.py
PvPMatch - ✅ Существует (называется Battle в анализе)
```

### **Что нужно добавить/исправить:**

#### **1. UserProfile (добавить поля):**
```python
class UserProfile(models.Model):
    # ... существующие поля ...
    current_network = models.CharField(max_length=20, default='Neural Link')
    last_sync_time = models.DateTimeField(auto_now_add=True)
    network_tier = models.CharField(max_length=20, default='Neural Link')  # из твоей спецификации
```

#### **2. UserUpgrade (новая M2M модель):**
```python
class UserUpgrade(models.Model):
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    upgrade = models.ForeignKey('game.Upgrade', on_delete=models.CASCADE)
    current_level = models.IntegerField(default=0)
    
    class Meta:
        unique_together = ['user', 'upgrade']
```

#### **3. UserTask (новая модель для прогресса):**
```python
class UserTask(models.Model):
    user = models.ForeignKey(UserProfile, on_delete=models.CASCADE)
    task = models.ForeignKey('economy.Quest', on_delete=models.CASCADE)
    is_completed = models.BooleanField(default=False)
    current_progress = models.IntegerField(default=0)
    
    class Meta:
        unique_together = ['user', 'task']
```

---

## 🧮 **Математика и формулы: Текущая vs Требуемая**

### **Текущая логика (фронтенд):**
```typescript
// App.tsx - считает на клиенте
const genMultiplier = Math.pow(5, generation - 1);
const miningPower = (0.005 + (quantum_level - 1) * 0.005) * 4;
```

### **Требуемая логика (бэкенд):**
```python
# utils/calculations.py
def calculate_generation_multiplier(generation):
    return 5 ** (generation - 1)

def calculate_network_multiplier(network_tier):
    multipliers = {
        'Neural Link': 1,
        'Satellite Grid': 1.5, 
        'Quantum Mesh': 2,
        'Singularity': 4
    }
    return multipliers.get(network_tier, 1)

def calculate_mining_power(user_upgrades, generation, network_tier):
    quantum_level = get_upgrade_level(user_upgrades, 'Quantum Core')
    gen_mult = calculate_generation_multiplier(generation)
    net_mult = calculate_network_multiplier(network_tier)
    return (0.005 + (quantum_level - 1) * 0.005) * 4 * gen_mult * net_mult

def calculate_max_energy(user_upgrades):
    buffer_level = get_upgrade_level(user_upgrades, 'Neural Buffer')
    return 6000 + (buffer_level - 1) * 500

def calculate_regen_rate(user_upgrades):
    cooling_level = get_upgrade_level(user_upgrades, 'Rapid Cooling')
    return 5 + (cooling_level - 1) * 2
```

---

## 🔄 **Паттерн синхронизации (Anti-Cheat)**

### **Текущая проблема:**
- Фронтенд сам считает майнинг и просто отправляет "start/stop"
- Нет валидации энергии и времени

### **Решение (из твоей спецификации):**

#### **1. Новый API endpoint:**
```python
# game/views.py
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_mining(request):
    data = request.data
    clicks = data.get('clicks', 0)
    time_spent = data.get('time_spent', 0)
    
    user = request.user.profile
    
    # Валидация
    max_possible_mining = calculate_mining_power(user) * clicks
    max_energy_spent = clicks * ENERGY_COST_PER_CLICK
    
    if user.energy < max_energy_spent:
        raise ValidationError("Not enough energy")
    
    # Расчёт награды
    reward = min(max_possible_mining, calculate_theoretical_max(time_spent))
    
    # Обновление состояния
    user.energy -= max_energy_spent
    user.balance += reward
    user.last_sync_time = timezone.now()
    user.save()
    
    return Response({
        'balance': user.balance,
        'energy': user.energy,
        'reward': reward
    })
```

#### **2. Оффлайн-майнинг при логине:**
```python
# accounts/views.py
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_state(request):
    user = request.user.profile
    
    # Оффлайн-синхронизация
    now = timezone.now()
    delta_seconds = (now - user.last_sync_time).total_seconds()
    
    # Регенерация энергии
    regen_rate = calculate_regen_rate(user.userupgrade_set.all())
    energy_regen = min(regen_rate * delta_seconds, 
                      calculate_max_energy(user.userupgrade_set.all()) - user.energy)
    user.energy += energy_regen
    
    # Пассивный доход (Auto-Sync Bot)
    if has_upgrade(user.userupgrade_set.all(), 'Auto-Sync Bot'):
        passive_income = calculate_passive_income(delta_seconds, user)
        user.balance += passive_income
        # Флаг для попапа на фронтенде
        passive_notification = True
    else:
        passive_notification = False
    
    user.last_sync_time = now
    user.save()
    
    return Response({
        'user': UserProfileSerializer(user).data,
        'upgrades': UserUpgradeSerializer(user.userupgrade_set.all(), many=True).data,
        'quests': UserQuestSerializer(user.usertask_set.all(), many=True).data,
        'passive_notification': passive_notification,
        'passive_income': passive_income if passive_notification else 0
    })
```

---

## 🛠️ **План реализации по приоритетам**

### **PHASE 1: Критические исправления (HIGH)**

#### **1.1 Убрать Dev Mode и Mock Data**
```typescript
// hooks/useAuth.ts - УДАЛИТЬ:
if (window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('ngrok')) {
    // ВЕСЬ ЭТОТ БЛОК УДАЛИТЬ
}
```

#### **1.2 Исправить fetchInit()**
```python
# game/views.py - ОБНОВИТЬ:
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def init_game(request):
    user = request.user.profile
    
    # Оффлайн-синхронизация
    sync_offline_mining(user)
    
    return Response({
        'user': UserProfileSerializer(user).data,
        'upgrades': UserUpgradeSerializer(user.userupgrade_set.all(), many=True).data,
        'quests': UserQuestSerializer(user.usertask_set.all(), many=True).data,
    })
```

#### **1.3 Добавить недостающие поля в UserProfile**
```python
# accounts/models.py - ДОБАВИТЬ:
class UserProfile(models.Model):
    # ... существующие поля ...
    current_network = models.CharField(max_length=20, default='Neural Link')
    last_sync_time = models.DateTimeField(auto_now_add=True)
```

### **PHASE 2: Математика на бэкенде (MEDIUM)**

#### **2.1 Создать utils/calculations.py**
```python
# utils/calculations.py - НОВЫЙ ФАЙЛ:
def calculate_mining_power(user, generation, network_tier):
    # Вся математика из твоей спецификации
    pass

def validate_mining_sync(user, clicks, time_spent):
    # Валидация anti-cheat
    pass
```

#### **2.2 Обновить все API endpoints**
```python
# Обновить все view функции, чтобы использовали calculate_mining_power
# вместо client-side вычислений
```

### **PHASE 3: Новые модели и API (MEDIUM)**

#### **3.1 Создать UserUpgrade модель**
#### **3.2 Создать UserTask модель**  
#### **3.3 Миграция данных существующих апгрейдов**

### **PHASE 4: Отсутствующие фичи (LOW)**

#### **4.1 Notifications API**
#### **4.2 Recent Blocks API**
#### **4.3 Network Tiers API**
#### **4.4 Transaction History UI**

---

## 🎯 **Конечная архитектура**

### **Frontend (React):**
```typescript
// Только UI и анимации
// Все расчёты через API
// Регулярная синхронизация каждые 5-10 секунд
```

### **Backend (Django):**
```python
# Source of Truth
# Вся математика и валидация
# Anti-cheat проверки
# Оффлайн-синхронизация
```

### **Data Flow:**
```
Frontend UI → API Request → Backend Validation → Database Update → Response → Frontend Update
```

---

## 📊 **Checklist для полного перехода**

### **Frontend:**
- [ ] Удалить все mock данные из constants.ts
- [ ] Убрать dev mode из useAuth.ts
- [ ] Обновить типы под реальные API ответы
- [ ] Добавить регулярную синхронизацию
- [ ] Обработать ошибки API

### **Backend:**
- [ ] Добавить поля в UserProfile
- [ ] Создать UserUpgrade модель
- [ ] Создать UserTask модель
- [ ] Реализовать всю математику в calculations.py
- [ ] Обновить все API endpoints
- [ ] Добавить sync_mining endpoint
- [ ] Реализовать оффлайн-синхронизацию

### **Testing:**
- [ ] Тест без dev mode
- [ ] Тест математических расчётов
- [ ] Тест anti-cheat валидации
- [ ] Тест оффлайн-майнинга
- [ ] Load testing

---

## 🚀 **Результат после внедрения:**

1. **100% контроль бэкенда** над всей логикой
2. **Anti-cheat защита** от читерства  
3. **Оффлайн-майнинг** и пассивный доход
4. **Реальная синхронизация** данных
5. **Масштабируемость** для тысяч юзеров

**Готовность: 100% вместо текущих 60%** 🎯
