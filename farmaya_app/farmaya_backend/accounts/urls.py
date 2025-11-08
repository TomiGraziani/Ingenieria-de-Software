from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterUserView,
    UserDetailView,
    FarmaciaListView,
    CustomTokenObtainPairView,
    ProductoViewSet,
)

router = DefaultRouter()
router.register(r'productos', ProductoViewSet, basename='producto')

urlpatterns = [
    # ============================================================
    # 🔹 AUTENTICACIÓN (JWT)
    # ============================================================
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # ============================================================
    # 🔹 USUARIOS
    # ============================================================
    path('register/', RegisterUserView.as_view(), name='register_user'),
    path('usuarios/me/', UserDetailView.as_view(), name='user_detail'),

    # ============================================================
    # 🔹 FARMACIAS
    # ============================================================
    path('usuarios/farmacias/', FarmaciaListView.as_view(), name='farmacias_list'),
] + router.urls
