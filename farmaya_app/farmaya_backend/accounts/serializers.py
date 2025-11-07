from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Pedido, Receta
from productos.models import Producto  # ✅ import correcto
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


User = get_user_model()

# ============================================================
# 🔹 SERIALIZER DE USUARIO (para listar, editar y mostrar datos)
# ============================================================
class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'password', 'nombre',
            'tipo_usuario', 'direccion', 'telefono',
            'horarios', 'latitud', 'longitud'
        ]
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


# ============================================================
# 🔹 SERIALIZER DE REGISTRO (para crear nuevos usuarios)
# ============================================================
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'email', 'password', 'nombre', 'tipo_usuario',
            'direccion', 'telefono', 'horarios',
            'latitud', 'longitud'
        ]

    def validate_email(self, value):
        normalized_email = value.lower()
        if User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError('Ese correo ya se encuentra en uso.')
        return normalized_email

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


# ============================================================
# 🔹 SERIALIZER ESPECIAL: LISTAR FARMACIAS
# ============================================================
class FarmaciaSerializer(serializers.ModelSerializer):
    """Usado para /accounts/usuarios/farmacias/"""
    class Meta:
        model = User
        fields = [
            'id', 'nombre', 'email', 'direccion', 'telefono',
            'horarios', 'latitud', 'longitud'
        ]


# ============================================================
# 🔹 PRODUCTOS
# ============================================================
class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
        fields = [
            'id', 'farmacia', 'nombre', 'presentacion', 'descripcion',
            'precio', 'stock', 'requiere_receta'
        ]
        read_only_fields = ['id', 'farmacia']


# ============================================================
# 🔹 RECETAS
# ============================================================
class RecetaSerializer(serializers.ModelSerializer):
    archivo_url = serializers.SerializerMethodField()

    class Meta:
        model = Receta
        fields = ['id', 'archivo', 'archivo_url', 'fecha_subida']
        read_only_fields = ['id', 'archivo_url', 'fecha_subida']

    def get_archivo_url(self, obj):
        request = self.context.get('request')
        if obj.archivo:
            if request:
                return request.build_absolute_uri(obj.archivo.url)
            return obj.archivo.url
        return None


# ============================================================
# 🔹 PEDIDOS
# ============================================================
class PedidoSerializer(serializers.ModelSerializer):
    usuario_email = serializers.ReadOnlyField(source='usuario.email')
    usuario_nombre = serializers.ReadOnlyField(source='usuario.nombre')
    producto_nombre = serializers.ReadOnlyField(source='producto.nombre')
    farmacia_nombre = serializers.ReadOnlyField(source='farmacia.nombre')
    requiere_receta = serializers.BooleanField(source='producto.requiere_receta', read_only=True)
    receta = RecetaSerializer(source='archivo_receta', read_only=True)
    receta_archivo = serializers.FileField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Pedido
        fields = [
            'id', 'producto', 'producto_nombre', 'cantidad', 'direccion_entrega',
            'metodo_pago', 'farmacia', 'farmacia_nombre', 'repartidor',
            'usuario_email', 'usuario_nombre', 'fecha', 'estado',
            'requiere_receta', 'receta', 'receta_archivo'
        ]
        read_only_fields = [
            'id', 'farmacia', 'farmacia_nombre', 'usuario_email', 'usuario_nombre',
            'fecha', 'requiere_receta', 'receta'
        ]
        extra_kwargs = {
            'repartidor': {'allow_null': True, 'required': False}
        }

    def validate_direccion_entrega(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Debes proporcionar una dirección de entrega.')
        return value.strip()

    def validate(self, attrs):
        request = self.context.get('request')
        producto = attrs.get('producto') or getattr(self.instance, 'producto', None)

        if not self.instance and producto and producto.requiere_receta:
            receta_file = None
            if request and request.FILES:
                receta_file = request.FILES.get('receta_archivo')
            if not receta_file:
                raise serializers.ValidationError({
                    'receta_archivo': 'Este producto requiere que adjuntes una receta médica.'
                })

        return attrs

    def create(self, validated_data):
        receta_file = validated_data.pop('receta_archivo', None)
        producto = validated_data['producto']
        validated_data['farmacia'] = producto.farmacia
        pedido = Pedido.objects.create(**validated_data)

        if receta_file:
            Receta.objects.create(pedido=pedido, archivo=receta_file)

        return pedido

    def update(self, instance, validated_data):
        receta_file = validated_data.pop('receta_archivo', None)
        pedido = super().update(instance, validated_data)

        if receta_file:
            Receta.objects.update_or_create(
                pedido=pedido,
                defaults={'archivo': receta_file},
            )

        return pedido


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Serializer personalizado para devolver info extra en el login."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['tipo_usuario'] = user.tipo_usuario
        token['nombre'] = user.nombre or ''
        return token
