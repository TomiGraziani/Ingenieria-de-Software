from django.db import models
from accounts.models import User
from productos.models import Producto

class Pedido(models.Model):
    ESTADOS = [
        ('pendiente', 'Pendiente'),
        ('aceptado', 'Aceptado'),
        ('rechazado', 'Rechazado'),
        ('en_preparacion', 'En preparación'),
        ('en_camino', 'En camino'),
        ('entregado', 'Entregado'),
        ('no_entregado', 'No entregado'),
        ('cancelado', 'Cancelado'),
    ]

    cliente = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='pedidos_cliente'
    )
    farmacia = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='pedidos_farmacia'
    )
    repartidor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='pedidos_asignados',
        null=True,
        blank=True,
        limit_choices_to={'tipo_usuario': 'repartidor'}
    )
    productos = models.ManyToManyField(Producto, through='DetallePedido')  # 👈 relación intermedia
    direccion_entrega = models.CharField(max_length=255)
    metodo_pago = models.CharField(max_length=50)
    fecha = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=50, choices=ESTADOS, default='pendiente')
    motivo_no_entrega = models.TextField(blank=True, null=True, verbose_name="Motivo de no entrega")

    def __str__(self):
        return f"Pedido #{self.id} - {self.farmacia.nombre} ({self.estado})"


class PedidoRechazado(models.Model):
    """
    Modelo para rastrear qué repartidores han rechazado qué pedidos.
    Cuando un repartidor rechaza un pedido, este registro se crea
    para que ese pedido no aparezca en la lista de pedidos disponibles
    para ese repartidor, pero sí para los demás.
    """
    pedido = models.ForeignKey(
        Pedido,
        on_delete=models.CASCADE,
        related_name='rechazos'
    )
    repartidor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='pedidos_rechazados',
        limit_choices_to={'tipo_usuario': 'repartidor'}
    )
    fecha_rechazo = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['pedido', 'repartidor']
        ordering = ['-fecha_rechazo']

    def __str__(self):
        return f"Pedido #{self.pedido.id} rechazado por {self.repartidor.email}"


class DetallePedido(models.Model):
    ESTADOS_RECETA = [
        ('no_requerida', 'No requiere'),
        ('pendiente', 'Pendiente'),
        ('aprobada', 'Aprobada'),
        ('rechazada', 'Rechazada'),
    ]

    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='detalles')
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    cantidad = models.PositiveIntegerField(default=1)
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    requiere_receta = models.BooleanField(default=False)
    estado_receta = models.CharField(
        max_length=20,
        choices=ESTADOS_RECETA,
        default='no_requerida'
    )
    receta_archivo = models.FileField(upload_to='recetas/', blank=True, null=True)
    observaciones_receta = models.TextField(blank=True)
    receta_omitida = models.BooleanField(default=False, verbose_name="Receta rechazada omitida por cliente")

    def __str__(self):
        return f"{self.producto.nombre} x{self.cantidad}"

    def save(self, *args, **kwargs):
        if self.requiere_receta and self.estado_receta == 'no_requerida':
            self.estado_receta = 'pendiente'
        if not self.requiere_receta:
            self.estado_receta = 'no_requerida'
            if self.receta_archivo:
                self.receta_archivo.delete(save=False)
            self.receta_archivo = None
            self.observaciones_receta = ''
        super().save(*args, **kwargs)
