from django.contrib import admin
from .models import Pedido, DetallePedido, PedidoRechazado


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ['id', 'cliente', 'farmacia', 'repartidor', 'estado', 'fecha']
    list_filter = ['estado', 'fecha']
    search_fields = ['cliente__email', 'farmacia__nombre', 'repartidor__email']
    readonly_fields = ['fecha']


@admin.register(DetallePedido)
class DetallePedidoAdmin(admin.ModelAdmin):
    list_display = ['id', 'pedido', 'producto', 'cantidad', 'precio_unitario', 'estado_receta']
    list_filter = ['estado_receta', 'requiere_receta']
    search_fields = ['pedido__id', 'producto__nombre']


@admin.register(PedidoRechazado)
class PedidoRechazadoAdmin(admin.ModelAdmin):
    list_display = ['id', 'pedido', 'repartidor', 'fecha_rechazo']
    list_filter = ['fecha_rechazo']
    search_fields = ['pedido__id', 'repartidor__email']
    readonly_fields = ['fecha_rechazo']
