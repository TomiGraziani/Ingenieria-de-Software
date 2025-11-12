from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.conf import settings
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut


# ----------------------------------------------------
# 🔹 MANAGER PERSONALIZADO DE USUARIO
# ----------------------------------------------------
class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("El email debe estar configurado.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser debe tener is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser debe tener is_superuser=True.")

        return self._create_user(email, password, **extra_fields)


# ----------------------------------------------------
# 🔹 MODELO DE USUARIO PERSONALIZADO
# ----------------------------------------------------
class User(AbstractUser):
    username = None
    email = models.EmailField("Correo electrónico", unique=True)

    TIPOS_USUARIO = [
        ("cliente", "Cliente"),
        ("farmacia", "Farmacia"),
        ("repartidor", "Repartidor"),
    ]

    tipo_usuario = models.CharField(max_length=20, choices=TIPOS_USUARIO, default="cliente")
    nombre = models.CharField(max_length=100, blank=True)
    dni = models.CharField(max_length=10, blank=True, null=True, unique=True, verbose_name="DNI")
    direccion = models.CharField(max_length=255, blank=True, null=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    horarios = models.CharField(max_length=100, blank=True, null=True)
    matricula = models.CharField(max_length=50, blank=True, null=True, verbose_name="Número de matrícula")

    # 🗺️ Campos para geolocalización
    latitud = models.FloatField(blank=True, null=True)
    longitud = models.FloatField(blank=True, null=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def save(self, *args, **kwargs):
        """
        Si el usuario es una farmacia y tiene dirección escrita,
        se geocodifica automáticamente para obtener latitud/longitud.
        """
        if self.tipo_usuario == "farmacia" and self.direccion:
            try:
                geolocator = Nominatim(user_agent="farmaya_app")
                location = geolocator.geocode(self.direccion, timeout=10)
                if location:
                    self.latitud = location.latitude
                    self.longitud = location.longitude
                    print(f"✅ Geocodificada '{self.direccion}' -> ({self.latitud}, {self.longitud})")
                else:
                    print(f"⚠️ No se encontró ubicación para '{self.direccion}'")
            except GeocoderTimedOut:
                print("⏱️ Error: geocodificación tardó demasiado")
            except Exception as e:
                print(f"❌ Error geocodificando dirección: {e}")

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.email} ({self.tipo_usuario})"


# ----------------------------------------------------
# 🔹 PEDIDO
# ----------------------------------------------------
class Pedido(models.Model):
    METODOS_PAGO = [
        ("efectivo", "Efectivo"),
        ("tarjeta", "Tarjeta"),
        ("transferencia", "Transferencia"),
    ]

    ESTADOS = [
        ("pendiente", "Pendiente"),
        ("aprobado", "Aprobado"),
        ("enviado", "Enviado"),
        ("entregado", "Entregado"),
        ("no_entregado", "No entregado"),
        ("cancelado", "Cancelado"),
    ]

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pedidos_realizados",
    )

    # 🔹 Importante: el Producto viene del app 'productos'
    producto = models.ForeignKey(
        "productos.Producto",   # 👈 así evitamos el conflicto
        on_delete=models.CASCADE,
        related_name="pedidos",
    )

    cantidad = models.PositiveIntegerField(default=1)
    direccion_entrega = models.CharField(max_length=255)
    metodo_pago = models.CharField(max_length=20, choices=METODOS_PAGO, default="efectivo")

    farmacia = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="pedidos_recibidos",
        null=True,
        blank=True,
    )

    repartidor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="pedidos_entregados",
        null=True,
        blank=True,
    )

    fecha = models.DateTimeField(auto_now_add=True)
    estado = models.CharField(max_length=20, choices=ESTADOS, default="pendiente")
    motivo_no_entrega = models.TextField(blank=True, null=True, verbose_name="Motivo de no entrega")

    def __str__(self):
        return f"Pedido de {self.usuario.email} - {self.producto.nombre}"

    class Meta:
        ordering = ["-fecha"]


# ----------------------------------------------------
# 🔹 RECETA
# ----------------------------------------------------
class Receta(models.Model):
    pedido = models.OneToOneField(Pedido, on_delete=models.CASCADE, related_name="archivo_receta")
    archivo = models.FileField(upload_to="recetas/")  # ✅ acepta imagen o PDF
    fecha_subida = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Receta para {self.pedido.producto.nombre}"
