from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.views import TokenRefreshView

from .models import Pedido, Receta
from productos.models import Producto  # ✅ import correcto

from .serializers import (
    UserSerializer,
    RegisterSerializer,
    ProductoSerializer,
    PedidoSerializer,
    RecetaSerializer,
    FarmaciaSerializer,  # ✅ Serializer para farmacias
    CustomTokenObtainPairSerializer,
)

from rest_framework_simplejwt.views import TokenObtainPairView

User = get_user_model()

# ============================================================
# 🔹 REGISTRO DE USUARIOS
# ============================================================
class RegisterUserView(generics.CreateAPIView):
    """
    Endpoint: /api/register/
    Permite registrar nuevos usuarios (cliente, farmacia o repartidor)
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]  # 👈 acceso público


# ============================================================
# 🔹 LISTADO DE FARMACIAS (para el mapa en el frontend)
# ============================================================
class FarmaciaListView(generics.ListAPIView):
    """
    Endpoint: /api/farmacias/
    Devuelve todas las farmacias registradas con dirección y coordenadas.
    """
    serializer_class = FarmaciaSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        # Filtra solo usuarios tipo farmacia con coordenadas
        return User.objects.filter(tipo_usuario='farmacia').exclude(latitud=None, longitud=None)


# ============================================================
# 🔹 PERFIL DEL USUARIO AUTENTICADO
# ============================================================
class UserDetailView(generics.RetrieveAPIView):
    """
    Endpoint: /api/usuarios/me/
    Devuelve la información del usuario autenticado
    """
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


# ============================================================
# 🔹 PRODUCTOS
# ============================================================
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class ProductoViewSet(viewsets.ModelViewSet):
    """
    CRUD completo de productos.
    Rutas automáticas: /api/productos/
    """
    queryset = Producto.objects.select_related('farmacia').all()
    serializer_class = ProductoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        farmacia_param = self.request.query_params.get('farmacia')

        if self.action == 'listar_por_farmacia' and 'farmacia_id' in self.kwargs:
            return queryset.filter(farmacia_id=self.kwargs['farmacia_id'])

        if farmacia_param:
            return queryset.filter(farmacia_id=farmacia_param)

        user = self.request.user
        if user.is_authenticated and self.action == 'list' and user.tipo_usuario == 'farmacia':
            return queryset.filter(farmacia=user)

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        if user.tipo_usuario != 'farmacia':
            raise PermissionDenied('Solo las farmacias pueden cargar productos.')
        serializer.save(farmacia=user)

    def perform_update(self, serializer):
        instance = self.get_object()
        user = self.request.user
        if user.tipo_usuario != 'farmacia' or instance.farmacia != user:
            raise PermissionDenied('No podés editar productos de otra farmacia.')
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.tipo_usuario != 'farmacia' or instance.farmacia != user:
            raise PermissionDenied('No podés eliminar productos de otra farmacia.')
        instance.delete()

    @action(detail=False, methods=['get'], url_path='farmacia/(?P<farmacia_id>[^/.]+)')
    def listar_por_farmacia(self, request, farmacia_id=None):
        productos = self.get_queryset().filter(farmacia_id=farmacia_id)
        page = self.paginate_queryset(productos)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(productos, many=True)
        return Response(serializer.data)


# ============================================================
# 🔹 PEDIDOS
# ============================================================
class PedidoViewSet(viewsets.ModelViewSet):
    """
    CRUD completo de pedidos.
    Rutas automáticas: /api/pedidos/
    """
    queryset = (
        Pedido.objects.select_related('usuario', 'producto', 'farmacia', 'repartidor')
        .prefetch_related('archivo_receta')
        .all()
    )
    serializer_class = PedidoSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        base_queryset = super().get_queryset()

        if user.tipo_usuario == 'farmacia':
            return base_queryset.filter(farmacia=user)
        if user.tipo_usuario == 'repartidor':
            return base_queryset.filter(repartidor=user)
        if user.tipo_usuario == 'cliente':
            return base_queryset.filter(usuario=user)
        return base_queryset

    def perform_create(self, serializer):
        user = self.request.user
        if user.tipo_usuario != 'cliente':
            raise PermissionDenied('Solo los clientes pueden generar pedidos.')
        serializer.save(usuario=user)

    def perform_update(self, serializer):
        pedido = self.get_object()
        user = self.request.user

        if user.tipo_usuario == 'farmacia' and pedido.farmacia != user:
            raise PermissionDenied('No podés actualizar pedidos de otra farmacia.')

        if user.tipo_usuario == 'cliente' and pedido.usuario != user:
            raise PermissionDenied('No podés actualizar pedidos de otro cliente.')

        if user.tipo_usuario == 'repartidor' and pedido.repartidor and pedido.repartidor != user:
            raise PermissionDenied('No podés actualizar pedidos asignados a otro repartidor.')

        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.tipo_usuario == 'farmacia' and instance.farmacia != user:
            raise PermissionDenied('No podés eliminar pedidos de otra farmacia.')
        if user.tipo_usuario == 'cliente' and instance.usuario != user:
            raise PermissionDenied('No podés eliminar pedidos de otro cliente.')
        if user.tipo_usuario == 'repartidor' and instance.repartidor and instance.repartidor != user:
            raise PermissionDenied('No podés eliminar pedidos asignados a otro repartidor.')
        instance.delete()


# ============================================================
# 🔹 RECETAS
# ============================================================
class RecetaViewSet(viewsets.ModelViewSet):
    """
    CRUD completo de recetas médicas asociadas a pedidos.
    Rutas automáticas: /api/recetas/
    """
    queryset = Receta.objects.select_related('pedido', 'pedido__producto', 'pedido__usuario')
    serializer_class = RecetaSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ['get', 'head', 'options']
