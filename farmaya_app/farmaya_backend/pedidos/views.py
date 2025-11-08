import json

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from productos.models import Producto

from .models import DetallePedido, Pedido
from .serializers import DetallePedidoSerializer, PedidoSerializer


User = get_user_model()


class PedidoListView(generics.ListAPIView):
    queryset = (
        Pedido.objects.select_related('cliente', 'farmacia')
        .prefetch_related('detalles__producto')
        .order_by('-fecha')
    )
    serializer_class = PedidoSerializer
    permission_classes = [permissions.IsAuthenticated]


class PedidosPorFarmaciaView(generics.ListAPIView):
    serializer_class = PedidoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        farmacia_id = self.kwargs['farmacia_id']
        estado = self.request.query_params.get('estado')

        queryset = (
            Pedido.objects.select_related('cliente', 'farmacia')
            .prefetch_related('detalles__producto')
            .filter(farmacia_id=farmacia_id)
            .order_by('-fecha')
        )

        if estado and estado != 'todos':
            queryset = queryset.filter(estado=estado)

        return queryset


class MisPedidosView(generics.ListAPIView):
    serializer_class = PedidoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Pedido.objects.select_related('cliente', 'farmacia')
            .prefetch_related('detalles__producto')
            .filter(cliente=self.request.user)
            .order_by('-fecha')
        )


class CrearPedidoView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        if getattr(request.user, 'tipo_usuario', None) != 'farmacia':
            return Response(
                {'detail': 'Solo las farmacias pueden consultar esta información.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        pedidos = (
            Pedido.objects.select_related('cliente', 'farmacia')
            .prefetch_related('detalles__producto')
            .filter(farmacia=request.user)
            .order_by('-fecha')
        )

        serializer = PedidoSerializer(pedidos, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        cliente = request.user
        data = request.data

        direccion = (data.get('direccion_entrega') or '').strip()
        if not direccion:
            return Response(
                {'detail': 'Debés indicar la dirección de entrega.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        metodo_pago = (data.get('metodo_pago') or 'efectivo').strip() or 'efectivo'

        farmacia_id = data.get('farmacia_id') or data.get('farmacia')
        if not farmacia_id:
            return Response(
                {'detail': 'No se indicó la farmacia del pedido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        farmacia = get_object_or_404(User, pk=farmacia_id, tipo_usuario='farmacia')

        raw_detalles = data.get('detalles')
        if not raw_detalles:
            return Response(
                {'detail': 'Debés seleccionar al menos un producto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if isinstance(raw_detalles, (list, tuple)):
            detalles_payload = raw_detalles
        else:
            try:
                detalles_payload = json.loads(raw_detalles)
            except (TypeError, ValueError):
                return Response(
                    {'detail': 'El formato de los productos seleccionados no es válido.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not detalles_payload:
            return Response(
                {'detail': 'Debés seleccionar al menos un producto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            pedido = Pedido.objects.create(
                cliente=cliente,
                farmacia=farmacia,
                direccion_entrega=direccion,
                metodo_pago=metodo_pago,
            )

            for index, detalle in enumerate(detalles_payload):
                producto_id = detalle.get('producto') or detalle.get('producto_id')
                if not producto_id:
                    transaction.set_rollback(True)
                    return Response(
                        {'detail': 'Uno de los productos seleccionados es inválido.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                producto = get_object_or_404(Producto, pk=producto_id, farmacia=farmacia)

                try:
                    cantidad = int(detalle.get('cantidad', 1))
                except (TypeError, ValueError):
                    cantidad = 0

                if cantidad <= 0:
                    transaction.set_rollback(True)
                    return Response(
                        {'detail': 'La cantidad debe ser un número positivo.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                receta_key = detalle.get('receta_key') or detalle.get('recetaCampo')
                receta_file = None
                if receta_key:
                    receta_file = request.FILES.get(receta_key)
                else:
                    receta_file = request.FILES.get(f'receta_{index}')

                if producto.requiere_receta and not receta_file:
                    transaction.set_rollback(True)
                    return Response(
                        {
                            'detail': (
                                f'El producto "{producto.nombre}" requiere que adjuntes una receta.'
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                detalle_obj = DetallePedido(
                    pedido=pedido,
                    producto=producto,
                    cantidad=cantidad,
                    precio_unitario=producto.precio,
                    requiere_receta=producto.requiere_receta,
                )

                if producto.requiere_receta and receta_file:
                    detalle_obj.receta_archivo = receta_file

                detalle_obj.save()

        serializer = PedidoSerializer(pedido, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ActualizarEstadoPedidoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pedido_id):
        pedido = get_object_or_404(
            Pedido.objects.select_related('farmacia', 'cliente').prefetch_related('detalles'),
            pk=pedido_id,
        )

        if request.user != pedido.farmacia:
            return Response(status=status.HTTP_403_FORBIDDEN)

        nuevo_estado = request.data.get('estado')
        if nuevo_estado not in dict(Pedido.ESTADOS):
            return Response(
                {'detail': 'El estado solicitado no es válido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if nuevo_estado == 'aceptado':
            pendientes = pedido.detalles.filter(
                requiere_receta=True
            ).exclude(estado_receta='aprobada')
            if pendientes.exists():
                return Response(
                    {
                        'detail': 'No podés aceptar el pedido hasta aprobar todas las recetas requeridas.'
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        pedido.estado = nuevo_estado
        pedido.save(update_fields=['estado'])

        serializer = PedidoSerializer(pedido, context={'request': request})
        return Response(serializer.data)


class ActualizarEstadoRecetaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, detalle_id):
        detalle = get_object_or_404(
            DetallePedido.objects.select_related('pedido__farmacia', 'producto'),
            pk=detalle_id,
        )

        if request.user != detalle.pedido.farmacia:
            return Response(status=status.HTTP_403_FORBIDDEN)

        if not detalle.requiere_receta:
            return Response(
                {'detail': 'Este producto no requiere receta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nuevo_estado = request.data.get('estado_receta')
        estados_validos = {'pendiente', 'aprobada', 'rechazada'}
        if nuevo_estado not in estados_validos:
            return Response(
                {'detail': 'Estado de receta inválido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        observaciones = (request.data.get('observaciones_receta') or '').strip()

        detalle.estado_receta = nuevo_estado
        detalle.observaciones_receta = observaciones
        detalle.save()

        serializer = DetallePedidoSerializer(detalle, context={'request': request})
        return Response(serializer.data)
