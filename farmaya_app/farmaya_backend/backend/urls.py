from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # 🔹 Endpoints principales (rutas limpias)
    path('api/', include('accounts.urls')),      # ✅ usuarios: login, registro, perfil y CRUDs principales
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
