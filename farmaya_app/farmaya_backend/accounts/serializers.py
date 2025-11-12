import re
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth import get_user_model
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
            'horarios', 'latitud', 'longitud', 'matricula'
        ]
        extra_kwargs = {'password': {'write_only': True}}

    def validate_nombre(self, value):
        """Valida que el nombre solo contenga letras y espacios en blanco."""
        if value and value.strip():
            # Permite letras (incluyendo acentos) y espacios
            if not re.match(r'^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$', value):
                raise serializers.ValidationError(
                    'No se admiten numeros en el nombre ingrese un nombre valido'
                )
            # Validar si el nombre ya está en uso (solo en create, no en update)
            # En update se valida en el método validate para excluir el usuario actual
            if self.instance is None:  # Solo validar en create
                nombre_normalizado = value.strip()
                if User.objects.filter(nombre__iexact=nombre_normalizado).exists():
                    raise serializers.ValidationError(
                        'Ya existe un/a usuario con este/a nombre.'
                    )
        return value

    def validate(self, attrs):
        """Validación adicional para update: verificar nombre duplicado excluyendo el usuario actual."""
        if self.instance and 'nombre' in attrs:
            nombre_nuevo = attrs.get('nombre', '').strip()
            if nombre_nuevo:
                # Verificar si otro usuario (diferente al actual) tiene ese nombre
                if User.objects.filter(nombre__iexact=nombre_nuevo).exclude(pk=self.instance.pk).exists():
                    raise serializers.ValidationError({
                        'nombre': ['Ya existe un/a usuario con este/a nombre.']
                    })
        return attrs

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
            'latitud', 'longitud', 'matricula'
        ]

    def validate_email(self, value):
        normalized_email = value.lower()
        if User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError('Ya existe un/a usuario con este/a Correo electrónico.')
        return normalized_email

    def validate_nombre(self, value):
        """Valida que el nombre solo contenga letras y espacios en blanco."""
        if value and value.strip():
            # Permite letras (incluyendo acentos) y espacios
            if not re.match(r'^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$', value):
                raise serializers.ValidationError(
                    'No se admiten numeros en el nombre ingrese un nombre valido'
                )
            # Validar si el nombre ya está en uso
            nombre_normalizado = value.strip()
            if User.objects.filter(nombre__iexact=nombre_normalizado).exists():
                raise serializers.ValidationError(
                    'Ya existe un/a usuario con este/a nombre.'
                )
        return value

    def validate(self, attrs):
        tipo_usuario = attrs.get('tipo_usuario')
        telefono = attrs.get('telefono')
        matricula = attrs.get('matricula')

        if tipo_usuario == 'farmacia':
            if not telefono or not str(telefono).strip():
                raise serializers.ValidationError({
                    'telefono': 'Las farmacias deben proporcionar un teléfono de contacto.'
                })
            if not matricula or not str(matricula).strip():
                raise serializers.ValidationError({
                    'matricula': 'Las farmacias deben proporcionar un número de matrícula.'
                })

        return attrs

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
            'horarios', 'latitud', 'longitud', 'matricula'
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
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Serializer personalizado para devolver info extra en el login."""

    def validate(self, attrs):
        try:
            data = super().validate(attrs)
        except AuthenticationFailed as exc:  # credenciales inválidas
            raise AuthenticationFailed('Usuario y/o contraseña incorrectos.') from exc
        data['user'] = UserSerializer(self.user).data
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['tipo_usuario'] = user.tipo_usuario
        token['nombre'] = user.nombre or ''
        return token
