from django.urls import path

from . import views


urlpatterns = [
    path('', views.CrearPedidoView.as_view(), name='pedidos-crear'),
    path('lista/', views.PedidoListView.as_view(), name='pedidos-lista'),
    path('mis/', views.MisPedidosView.as_view(), name='pedidos-mios'),
    path('farmacia/<int:farmacia_id>/', views.PedidosPorFarmaciaView.as_view(), name='pedidos-por-farmacia'),
    path('<int:pedido_id>/estado/', views.ActualizarEstadoPedidoView.as_view(), name='pedidos-estado'),
    path('detalles/<int:detalle_id>/receta/', views.ActualizarEstadoRecetaView.as_view(), name='pedido-detalle-receta'),
]
