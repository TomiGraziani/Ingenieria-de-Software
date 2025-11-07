from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Pedido, Receta
from productos.models import Producto  # ✅ import correcto


# -----------------------------
# 🔹 ADMIN USUARIO PERSONALIZADO
# -----------------------------
class UserAdmin(BaseUserAdmin):
    ordering = ('email',)
    list_display = ('email', 'tipo_usuario', 'is_active', 'is_staff', 'is_superuser')
    search_fields = ('email',)
    list_filter = ('tipo_usuario', 'is_staff', 'is_superuser')

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Información personal', {
            'fields': (
                'first_name',
                'last_name',
                'tipo_usuario',
                'nombre',
                'direccion',
                'telefono',
                'horarios',
                'latitud',
                'longitud',
            )
        }),
        ('Permisos', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Fechas importantes', {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'tipo_usuario', 'is_staff', 'is_superuser'),
        }),
    )


admin.site.register(User, UserAdmin)


# -----------------------------
# 🔹 ADMIN PRODUCTO
# -----------------------------
@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'presentacion', 'precio', 'stock', 'requiere_receta', 'farmacia')
    search_fields = ('nombre', 'farmacia__nombre')
    list_filter = ('requiere_receta', 'farmacia')


# -----------------------------
# 🔹 ADMIN PEDIDO
# -----------------------------
@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ('id', 'usuario', 'producto', 'cantidad', 'estado', 'fecha')
    list_filter = ('estado', 'metodo_pago')
    search_fields = ('usuario__email', 'producto__nombre')


# -----------------------------
# 🔹 ADMIN RECETA
# -----------------------------
@admin.register(Receta)
class RecetaAdmin(admin.ModelAdmin):
    list_display = ('id', 'pedido', 'fecha_subida')
    search_fields = ('pedido__usuario__email',)
