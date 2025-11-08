from rest_framework import serializers

from .models import DetallePedido, Pedido


class DetallePedidoSerializer(serializers.ModelSerializer):
    producto_nombre = serializers.CharField(source='producto.nombre', read_only=True)
    receta_url = serializers.SerializerMethodField()

    class Meta:
        model = DetallePedido
        fields = [
            'id',
            'producto',
            'producto_nombre',
            'cantidad',
            'precio_unitario',
            'requiere_receta',
            'estado_receta',
            'receta_url',
            'observaciones_receta',
        ]
        read_only_fields = [
            'producto_nombre',
            'precio_unitario',
            'requiere_receta',
            'estado_receta',
            'receta_url',
            'observaciones_receta',
        ]

    def get_receta_url(self, obj):
        request = self.context.get('request')
        if obj.receta_archivo:
            if request:
                return request.build_absolute_uri(obj.receta_archivo.url)
            return obj.receta_archivo.url
        return None


class PedidoSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source='cliente.nombre', read_only=True)
    cliente_email = serializers.CharField(source='cliente.email', read_only=True)
    farmacia_nombre = serializers.CharField(source='farmacia.nombre', read_only=True)
    detalles = DetallePedidoSerializer(many=True, read_only=True)
    puede_aceptar = serializers.SerializerMethodField()

    class Meta:
        model = Pedido
        fields = [
            'id',
            'cliente_nombre',
            'cliente_email',
            'farmacia_nombre',
            'direccion_entrega',
            'metodo_pago',
            'fecha',
            'estado',
            'detalles',
            'puede_aceptar',
        ]

    def get_puede_aceptar(self, obj):
        return not obj.detalles.filter(
            requiere_receta=True
        ).exclude(estado_receta='aprobada').exists()
