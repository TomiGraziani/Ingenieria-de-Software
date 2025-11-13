import json

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from productos.models import Producto

from .models import DetallePedido, Pedido, PedidoRechazado
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
        user = self.request.user
        tipo_usuario = getattr(user, 'tipo_usuario', None)
        
        # Si es cliente, devolver sus pedidos
        if tipo_usuario == 'cliente':
            return (
                Pedido.objects.select_related('cliente', 'farmacia', 'repartidor')
                .prefetch_related('detalles__producto')
                .filter(cliente=user)
                .order_by('-fecha')
            )
        # Si es repartidor, devolver pedidos asignados a él
        elif tipo_usuario == 'repartidor':
            return (
                Pedido.objects.select_related('cliente', 'farmacia', 'repartidor')
                .prefetch_related('detalles__producto')
                .filter(repartidor=user)
                .order_by('-fecha')
            )
        # Si es farmacia, devolver pedidos de esa farmacia
        elif tipo_usuario == 'farmacia':
            return (
                Pedido.objects.select_related('cliente', 'farmacia', 'repartidor')
                .prefetch_related('detalles__producto')
                .filter(farmacia=user)
                .order_by('-fecha')
            )
        # Por defecto, devolver pedidos del cliente (comportamiento anterior)
        else:
            return (
                Pedido.objects.select_related('cliente', 'farmacia', 'repartidor')
                .prefetch_related('detalles__producto')
                .filter(cliente=user)
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

                # Validar que haya stock suficiente
                if producto.stock < cantidad:
                    transaction.set_rollback(True)
                    return Response(
                        {
                            'detail': (
                                f'No hay stock suficiente de "{producto.nombre}". '
                                f'Stock disponible: {producto.stock}, solicitado: {cantidad}.'
                            )
                        },
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

                # Actualizar el stock del producto (restar la cantidad pedida)
                producto.stock -= cantidad
                producto.save(update_fields=['stock'])

        serializer = PedidoSerializer(pedido, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ActualizarEstadoPedidoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pedido_id):
        pedido = get_object_or_404(
            Pedido.objects.select_related('farmacia', 'cliente').prefetch_related('detalles'),
            pk=pedido_id,
        )

        nuevo_estado = request.data.get('estado')
        if nuevo_estado not in dict(Pedido.ESTADOS):
            return Response(
                {'detail': 'El estado solicitado no es válido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # La farmacia puede actualizar a cualquier estado
        if request.user == pedido.farmacia:
            if nuevo_estado == 'aceptado':
                # Verificar que no haya recetas pendientes
                pendientes = pedido.detalles.filter(
                    requiere_receta=True,
                    estado_receta='pendiente'
                )
                if pendientes.exists():
                    return Response(
                        {
                            'detail': 'No podés aceptar el pedido hasta aprobar todas las recetas requeridas.'
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                
                # Verificar que no haya recetas rechazadas sin resolver
                rechazadas_pendientes = pedido.detalles.filter(
                    requiere_receta=True,
                    estado_receta='rechazada',
                    receta_omitida=False
                )
                if rechazadas_pendientes.exists():
                    return Response(
                        {
                            'detail': 'No podés aceptar el pedido hasta que el cliente responda sobre las recetas rechazadas.'
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        # Los repartidores solo pueden actualizar a 'en_camino', 'entregado' o 'no_entregado'
        elif request.user.tipo_usuario == 'repartidor':
            if nuevo_estado not in ['en_camino', 'entregado', 'no_entregado']:
                return Response(
                    {'detail': 'Los repartidores solo pueden actualizar el estado a "en_camino", "entregado" o "no_entregado".'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            # Solo pueden actualizar si el pedido está en_camino (ya retirado de la farmacia)
            if nuevo_estado in ['entregado', 'no_entregado']:
                if pedido.estado not in ['en_camino']:
                    return Response(
                        {'detail': 'Solo podés marcar como entregado o no entregado pedidos que estén en camino.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            # Para marcar como en_camino, el pedido debe estar aceptado o en preparación
            elif nuevo_estado == 'en_camino':
                if pedido.estado not in ['aceptado', 'en_preparacion']:
                    return Response(
                        {'detail': 'Solo podés marcar como en camino pedidos que estén aceptados o en preparación.'},
                        status=status.HTTP_403_FORBIDDEN,
                    )
        else:
            return Response(status=status.HTTP_403_FORBIDDEN)

        # Actualizar estado
        pedido.estado = nuevo_estado
        
        # Si el estado es 'no_entregado', guardar el motivo
        if nuevo_estado == 'no_entregado':
            motivo_no_entrega = request.data.get('motivo_no_entrega', '')
            if motivo_no_entrega:
                pedido.motivo_no_entrega = motivo_no_entrega
                pedido.save(update_fields=['estado', 'motivo_no_entrega'])
            else:
                pedido.save(update_fields=['estado'])
        else:
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
        # Si se rechaza una receta, asegurar que receta_omitida sea False inicialmente
        if nuevo_estado == 'rechazada':
            detalle.receta_omitida = False
        detalle.save()

        serializer = DetallePedidoSerializer(detalle, context={'request': request})
        return Response(serializer.data)


class ReenviarRecetaView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, detalle_id):
        detalle = get_object_or_404(
            DetallePedido.objects.select_related('pedido__cliente', 'pedido__farmacia', 'producto'),
            pk=detalle_id,
        )

        # Solo el cliente dueño del pedido puede reenviar la receta
        if request.user != detalle.pedido.cliente:
            return Response(status=status.HTTP_403_FORBIDDEN)

        if not detalle.requiere_receta:
            return Response(
                {'detail': 'Este producto no requiere receta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if detalle.estado_receta != 'rechazada':
            return Response(
                {'detail': 'Solo se pueden reenviar recetas que fueron rechazadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Obtener el archivo de receta
        receta_file = request.FILES.get('receta')
        if not receta_file:
            return Response(
                {'detail': 'Debés adjuntar una nueva receta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Eliminar la receta anterior si existe
        if detalle.receta_archivo:
            detalle.receta_archivo.delete(save=False)

        # Guardar la nueva receta
        detalle.receta_archivo = receta_file
        detalle.estado_receta = 'pendiente'
        detalle.receta_omitida = False
        detalle.observaciones_receta = ''
        detalle.save()

        serializer = DetallePedidoSerializer(detalle, context={'request': request})
        return Response(serializer.data)


class OmitirRecetaView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, detalle_id):
        detalle = get_object_or_404(
            DetallePedido.objects.select_related('pedido__cliente', 'pedido__farmacia', 'producto'),
            pk=detalle_id,
        )

        # Solo el cliente dueño del pedido puede omitir la receta
        if request.user != detalle.pedido.cliente:
            return Response(status=status.HTTP_403_FORBIDDEN)

        if not detalle.requiere_receta:
            return Response(
                {'detail': 'Este producto no requiere receta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if detalle.estado_receta != 'rechazada':
            return Response(
                {'detail': 'Solo se pueden omitir recetas que fueron rechazadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Marcar la receta como omitida
        detalle.receta_omitida = True
        detalle.save()

        serializer = DetallePedidoSerializer(detalle, context={'request': request})
        return Response(serializer.data)


class PedidosDisponiblesView(APIView):
    """
    Vista para obtener los pedidos disponibles para un repartidor.
    Excluye los pedidos que el repartidor ya ha rechazado.
    Solo muestra pedidos que están en estado 'aceptado' o 'en_preparacion'
    y que no tienen un repartidor asignado.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if getattr(request.user, 'tipo_usuario', None) != 'repartidor':
            return Response(
                {'detail': 'Solo los repartidores pueden consultar esta información.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Obtener IDs de pedidos que el repartidor ya ha rechazado
        pedidos_rechazados_ids = PedidoRechazado.objects.filter(
            repartidor=request.user
        ).values_list('pedido_id', flat=True)

        # Obtener pedidos disponibles:
        # 1. Estado 'aceptado' o 'en_preparacion'
        # 2. No tienen repartidor asignado (repartidor es None)
        # 3. No están en la lista de pedidos rechazados por este repartidor
        pedidos_disponibles = (
            Pedido.objects.select_related('cliente', 'farmacia', 'repartidor')
            .prefetch_related('detalles__producto')
            .filter(
                estado__in=['aceptado', 'en_preparacion'],
                repartidor__isnull=True
            )
            .exclude(id__in=pedidos_rechazados_ids)
            .order_by('-fecha')
        )

        serializer = PedidoSerializer(pedidos_disponibles, many=True, context={'request': request})
        return Response(serializer.data)


class AceptarPedidoView(APIView):
    """
    Vista para que un repartidor acepte un pedido.
    Cuando se acepta, se asigna el repartidor al pedido y se cambia el estado a 'en_camino'
    si el estado era 'aceptado' o 'en_preparacion'.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pedido_id):
        if getattr(request.user, 'tipo_usuario', None) != 'repartidor':
            return Response(
                {'detail': 'Solo los repartidores pueden aceptar pedidos.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        pedido = get_object_or_404(
            Pedido.objects.select_related('cliente', 'farmacia', 'repartidor')
            .prefetch_related('detalles'),
            pk=pedido_id,
        )

        # Verificar que el pedido esté disponible
        if pedido.repartidor is not None:
            return Response(
                {'detail': 'Este pedido ya está asignado a otro repartidor.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if pedido.estado not in ['aceptado', 'en_preparacion']:
            return Response(
                {'detail': 'Solo se pueden aceptar pedidos que estén aceptados o en preparación.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verificar que el repartidor no haya rechazado este pedido antes
        # (aunque esto no debería pasar por el filtro de PedidosDisponiblesView)
        if PedidoRechazado.objects.filter(pedido=pedido, repartidor=request.user).exists():
            return Response(
                {'detail': 'Ya rechazaste este pedido anteriormente.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Asignar el repartidor al pedido y cambiar estado a 'en_camino'
        pedido.repartidor = request.user
        pedido.estado = 'en_camino'
        pedido.save(update_fields=['repartidor', 'estado'])

        # Eliminar cualquier registro de rechazo si existe (por si acaso)
        PedidoRechazado.objects.filter(pedido=pedido, repartidor=request.user).delete()

        serializer = PedidoSerializer(pedido, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class RechazarPedidoView(APIView):
    """
    Vista para que un repartidor rechace un pedido.
    Cuando se rechaza, se crea un registro en PedidoRechazado
    para que ese pedido no aparezca más en la lista de pedidos disponibles
    para ese repartidor, pero sí para los demás.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pedido_id):
        if getattr(request.user, 'tipo_usuario', None) != 'repartidor':
            return Response(
                {'detail': 'Solo los repartidores pueden rechazar pedidos.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        pedido = get_object_or_404(
            Pedido.objects.select_related('cliente', 'farmacia', 'repartidor'),
            pk=pedido_id,
        )

        # Verificar que el pedido esté disponible (no asignado a otro repartidor)
        if pedido.repartidor is not None and pedido.repartidor != request.user:
            return Response(
                {'detail': 'Este pedido ya está asignado a otro repartidor.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if pedido.estado not in ['aceptado', 'en_preparacion']:
            return Response(
                {'detail': 'Solo se pueden rechazar pedidos que estén aceptados o en preparación.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verificar que no haya rechazado este pedido antes
        if PedidoRechazado.objects.filter(pedido=pedido, repartidor=request.user).exists():
            return Response(
                {'detail': 'Ya rechazaste este pedido anteriormente.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Crear registro de rechazo
        PedidoRechazado.objects.create(
            pedido=pedido,
            repartidor=request.user
        )

        return Response(
            {'detail': 'Pedido rechazado. Ya no aparecerá en tu lista de pedidos disponibles.'},
            status=status.HTTP_200_OK
        )
