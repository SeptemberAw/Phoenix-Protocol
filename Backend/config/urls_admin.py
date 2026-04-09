from django.urls import path, include
from admin.dashboard import purex_admin

urlpatterns = [
    path('admin/', purex_admin.urls),
]
