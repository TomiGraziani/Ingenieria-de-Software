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
    productos = models.ManyToManyField(Producto, through='DetallePedido')  # 👈 relación intermedia
    direccion_entrega = models.CharField(max_length=255)
    metodo_pago = models.CharField(max_length=50)
    fecha = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=50, choices=ESTADOS, default='pendiente')

    def __str__(self):
        return f"Pedido #{self.id} - {self.farmacia.nombre} ({self.estado})"


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
