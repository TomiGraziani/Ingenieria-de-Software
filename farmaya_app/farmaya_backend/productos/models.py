from django.db import models
from accounts.models import User


class Producto(models.Model):
    farmacia = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="productos_farmacia",  # 👈 nombre único, evita conflictos
    )
    nombre = models.CharField(max_length=100)
    presentacion = models.CharField(max_length=50)  # 💊 Ejemplo: "500 mg", "200 ml"
    descripcion = models.TextField(blank=True)
    precio = models.DecimalField(max_digits=8, decimal_places=2)
    stock = models.PositiveIntegerField(default=0)
    requiere_receta = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.nombre} ({self.presentacion}) - {self.farmacia.nombre}"
