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
            'receta_omitida',
        ]
        read_only_fields = [
            'producto_nombre',
            'precio_unitario',
            'requiere_receta',
            'estado_receta',
            'receta_url',
            'observaciones_receta',
            'receta_omitida',
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
    detalles = serializers.SerializerMethodField()
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
            'motivo_no_entrega',
            'detalles',
            'puede_aceptar',
        ]

    def get_detalles(self, obj):
        # Si el pedido está aceptado o en un estado avanzado, excluir detalles con receta rechazada omitida
        if obj.estado in ['aceptado', 'en_preparacion', 'en_camino', 'entregado']:
            detalles_validos = obj.detalles.exclude(
                requiere_receta=True,
                estado_receta='rechazada',
                receta_omitida=True
            )
        else:
            # Para pedidos pendientes, mostrar todos los detalles
            detalles_validos = obj.detalles.all()
        
        return DetallePedidoSerializer(detalles_validos, many=True, context=self.context).data

    def get_puede_aceptar(self, obj):
        # No se puede aceptar si hay recetas pendientes sin resolver
        recetas_pendientes = obj.detalles.filter(
            requiere_receta=True,
            estado_receta='pendiente'
        ).exists()
        
        # No se puede aceptar si hay recetas rechazadas sin que el cliente haya decidido (reenviar u omitir)
        recetas_rechazadas_pendientes = obj.detalles.filter(
            requiere_receta=True,
            estado_receta='rechazada',
            receta_omitida=False
        ).exists()
        
        return not recetas_pendientes and not recetas_rechazadas_pendientes
