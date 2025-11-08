import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import API from "../api/api";

const ESTADO_RECETA_LABEL = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

const RECETA_COLOR = {
  pendiente: "#FF9800",
  aprobada: "#2E7D32",
  rechazada: "#C62828",
};

const formatDate = (value) => {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

export default function PedidosFarmaciaScreen() {
  const [farmacia, setFarmacia] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFarmacia = useCallback(async () => {
    try {
      const response = await API.get("usuarios/me/");
      setFarmacia(response.data);
      return response.data;
    } catch (error) {
      console.error("Error al cargar datos de la farmacia:", error.response?.data || error);
      Alert.alert("Error", "No se pudieron cargar los datos de la farmacia.");
      return null;
    }
  }, []);

  const fetchOrders = useCallback(
    async (farmaciaInfo) => {
      const farmaciaData = farmaciaInfo || farmacia;
      if (!farmaciaData?.id) {
        return;
      }

      try {
        const response = await API.get(`pedidos/farmacia/${farmaciaData.id}/`, {
          params: { estado: "pendiente" },
        });
        setOrders(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Error al cargar pedidos:", error.response?.data || error);
        Alert.alert("Error", "No se pudieron cargar los pedidos.");
      }
    },
    [farmacia]
  );

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const farmaciaInfo = await fetchFarmacia();
      await fetchOrders(farmaciaInfo);
      setLoading(false);
    };

    init();
  }, [fetchFarmacia, fetchOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  }, [fetchOrders]);

  const actualizarReceta = async (detalleId, nuevoEstado) => {
    try {
      await API.patch(`pedidos/detalles/${detalleId}/receta/`, {
        estado_receta: nuevoEstado,
      });

      setOrders((prev) =>
        prev.map((pedido) => {
          const detallesActualizados = pedido.detalles.map((detalle) =>
            detalle.id === detalleId
              ? { ...detalle, estado_receta: nuevoEstado }
              : detalle
          );

          const puedeAceptarActualizado = detallesActualizados.every(
            (detalle) =>
              !detalle.requiere_receta || detalle.estado_receta === "aprobada"
          );

          return {
            ...pedido,
            detalles: detallesActualizados,
            puede_aceptar: puedeAceptarActualizado,
          };
        })
      );
    } catch (error) {
      console.error("Error actualizando receta:", error.response?.data || error);
      Alert.alert("Error", error.response?.data?.detail || "No se pudo actualizar la receta.");
    }
  };

  const actualizarEstadoPedido = async (pedidoId, nuevoEstado) => {
    try {
      await API.patch(`pedidos/${pedidoId}/estado/`, { estado: nuevoEstado });
      setOrders((prev) => prev.filter((pedido) => pedido.id !== pedidoId));
      Alert.alert(
        "Estado actualizado",
        nuevoEstado === "aceptado"
          ? "El pedido fue aceptado correctamente."
          : "El pedido fue rechazado."
      );
    } catch (error) {
      console.error("Error actualizando pedido:", error.response?.data || error);
      Alert.alert("Error", error.response?.data?.detail || "No se pudo actualizar el pedido.");
    }
  };

  const confirmarAccionReceta = (detalleId, nuevoEstado) => {
    const mensaje =
      nuevoEstado === "aprobada"
        ? "¿Querés aprobar la receta?"
        : "¿Querés rechazar la receta de este producto?";

    Alert.alert("Confirmar acción", mensaje, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        style: "destructive",
        onPress: () => actualizarReceta(detalleId, nuevoEstado),
      },
    ]);
  };

  const confirmarAccionPedido = (pedidoId, nuevoEstado) => {
    const mensaje =
      nuevoEstado === "aceptado"
        ? "¿Querés aceptar este pedido? Solo podés hacerlo si todas las recetas están aprobadas."
        : "¿Querés rechazar este pedido?";

    Alert.alert("Confirmar", mensaje, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        style: "destructive",
        onPress: () => actualizarEstadoPedido(pedidoId, nuevoEstado),
      },
    ]);
  };

  const verReceta = (url) => {
    if (!url) {
      Alert.alert("Receta no disponible", "Este detalle no tiene una receta adjunta.");
      return;
    }
    Linking.openURL(url).catch((error) => {
      console.error("Error abriendo receta:", error);
      Alert.alert("Error", "No se pudo abrir la receta adjunta.");
    });
  };

  const renderDetalle = (detalle) => (
    <View key={detalle.id} style={styles.detalleContainer}>
      <View style={{ flex: 1 }}>
        <Text style={styles.detalleProducto}>{detalle.producto_nombre}</Text>
        <Text style={styles.detalleInfo}>Cantidad: {detalle.cantidad}</Text>
        <Text style={styles.detalleInfo}>
          Precio unitario: ${Number(detalle.precio_unitario || 0)}
        </Text>
        {detalle.requiere_receta ? (
          <Text
            style={[
              styles.detalleEstadoReceta,
              { color: RECETA_COLOR[detalle.estado_receta] || "#374151" },
            ]}
          >
            Estado de receta: {ESTADO_RECETA_LABEL[detalle.estado_receta]}
          </Text>
        ) : (
          <Text style={styles.detalleEstadoReceta}>✅ No requiere receta</Text>
        )}
      </View>

      {detalle.requiere_receta ? (
        <View style={styles.detalleAcciones}>
          {detalle.receta_url ? (
            <TouchableOpacity
              style={styles.actionSmall}
              onPress={() => verReceta(detalle.receta_url)}
            >
              <Text style={styles.actionSmallText}>Ver receta</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.detalleInfo}>Receta pendiente</Text>
          )}

          {detalle.estado_receta === "pendiente" ? (
            <>
              <TouchableOpacity
                style={[styles.actionSmall, styles.actionApprove]}
                onPress={() => confirmarAccionReceta(detalle.id, "aprobada")}
              >
                <Text style={styles.actionSmallText}>Aprobar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionSmall, styles.actionReject]}
                onPress={() => confirmarAccionReceta(detalle.id, "rechazada")}
              >
                <Text style={styles.actionSmallText}>Rechazar</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const renderOrder = ({ item }) => {
    const puedeAceptar = item.puede_aceptar;
    return (
      <View style={styles.card}>
        <Text style={styles.cliente}>👤 Cliente: {item.cliente_nombre || "Cliente"}</Text>
        <Text style={styles.info}>📧 {item.cliente_email}</Text>
        <Text style={styles.info}>🏠 Entrega: {item.direccion_entrega}</Text>
        <Text style={styles.info}>🕒 {formatDate(item.fecha)}</Text>

        <View style={styles.divider} />
        <Text style={styles.detalleTitulo}>Productos solicitados</Text>
        {item.detalles.map(renderDetalle)}

        <View style={styles.divider} />
        <View style={styles.accionesPedido}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => confirmarAccionPedido(item.id, "rechazado")}
          >
            <Text style={styles.actionButtonText}>Rechazar pedido</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, puedeAceptar ? styles.acceptButton : styles.disabledButton]}
            onPress={() => confirmarAccionPedido(item.id, "aceptado")}
            disabled={!puedeAceptar}
          >
            <Text style={styles.actionButtonText}>
              {puedeAceptar ? "Aceptar pedido" : "Aprobar recetas"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#1E88E5" style={{ flex: 1 }} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📦 Pedidos pendientes</Text>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderOrder}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.emptyText}>No hay pedidos pendientes.</Text>}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 16, color: "#1E88E5" },
  emptyText: { textAlign: "center", marginTop: 40, color: "#64748B" },
  card: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cliente: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 4 },
  info: { fontSize: 14, color: "#374151", marginBottom: 4 },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 12 },
  detalleTitulo: { fontSize: 15, fontWeight: "600", marginBottom: 8, color: "#1F2937" },
  detalleContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#edf2f7",
    flexDirection: "row",
    gap: 12,
  },
  detalleProducto: { fontSize: 14, fontWeight: "600", color: "#111827" },
  detalleInfo: { fontSize: 13, color: "#4b5563" },
  detalleEstadoReceta: { fontSize: 13, marginTop: 4 },
  detalleAcciones: { justifyContent: "center", gap: 8 },
  actionSmall: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#1E88E5",
  },
  actionSmallText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  actionApprove: { backgroundColor: "#2E7D32" },
  actionReject: { backgroundColor: "#C62828" },
  accionesPedido: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  rejectButton: { backgroundColor: "#ef4444" },
  acceptButton: { backgroundColor: "#22c55e" },
  disabledButton: { backgroundColor: "#cbd5f5" },
  actionButtonText: { color: "#fff", fontWeight: "700" },
});
