import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import API from "../api/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ESTADO_LABEL = {
  creado: "Pedido creado",
  pendiente: "Pedido pendiente",
  aceptado: "Pedido aceptado",
  rechazado: "Pedido rechazado",
  en_preparacion: "En preparación",
  en_camino: "En camino",
  entregado: "Entregado",
  no_entregado: "No entregado",
  cancelado: "Cancelado",
};

const estadoColor = (estado) => {
  switch (estado) {
    case "creado":
    case "pendiente":
      return "#1E88E5";
    case "aceptado":
    case "en_preparacion":
      return "#2E7D32";
    case "en_camino":
      return "#FF8F00";
    case "entregado":
      return "#6D4C41";
    case "no_entregado":
      return "#D32F2F";
    case "rechazado":
    case "cancelado":
      return "#C62828";
    default:
      return "#1E88E5";
  }
};

const formatDate = (value) => {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

export default function MisPedidosScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userLoaded, setUserLoaded] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem("user");
        if (!stored) {
          setUserEmail("");
          return;
        }

        const parsed = JSON.parse(stored);
        const email = (parsed?.email || parsed?.usuario?.email || "").toString().toLowerCase();
        setUserEmail(email);
      } catch (error) {
        console.error("Error cargando datos del usuario para MisPedidos:", error);
        setUserEmail("");
      } finally {
        setUserLoaded(true);
      }
    };

    loadUser();
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!userLoaded) {
      return;
    }

    try {
      const response = await API.get("pedidos/mis/");
      const data = Array.isArray(response.data) ? response.data : [];

      const normalizedEmail = userEmail?.toString().toLowerCase();
      const filtered = normalizedEmail
        ? data.filter((order) => {
          const email = (order?.cliente_email || "").toString().toLowerCase();
          return email === normalizedEmail;
        })
        : data;

      setOrders(filtered);
    } catch (error) {
      console.error("Error cargando pedidos del cliente:", error.response?.data || error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userEmail, userLoaded]);

  useEffect(() => {
    navigation.setOptions({ headerShown: true, title: "Mis pedidos" });
  }, [navigation]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [fetchOrders])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const renderDetalle = (detalle) => (
    <View key={detalle.id} style={styles.detalleItem}>
      <Text style={styles.detalleProducto}>
        {detalle.producto_nombre} × {detalle.cantidad}
      </Text>
      {detalle.requiere_receta ? (
        <Text style={styles.detalleReceta}>
          {detalle.estado_receta === "aprobada"
            ? "Receta aprobada"
            : detalle.estado_receta === "rechazada"
              ? "Receta rechazada"
              : "Receta pendiente"}
        </Text>
      ) : (
        <Text style={styles.detalleReceta}>Sin receta</Text>
      )}
    </View>
  );

  // Filtrar detalles para mostrar solo los que tienen receta aprobada o no requieren receta
  // Solo filtrar si el pedido está aceptado o en un estado avanzado
  const filtrarDetalles = (detalles, estadoPedido) => {
    if (!detalles || !Array.isArray(detalles)) return [];

    // Si el pedido está aceptado o en un estado avanzado, filtrar detalles
    const estadosAvanzados = ['aceptado', 'en_preparacion', 'en_camino', 'entregado', 'no_entregado'];
    const estadoNormalizado = (estadoPedido || '').toString().toLowerCase();

    if (estadosAvanzados.includes(estadoNormalizado)) {
      return detalles.filter(
        (detalle) =>
          !detalle.requiere_receta ||
          detalle.estado_receta === "aprobada" ||
          (detalle.estado_receta === "rechazada" && detalle.receta_omitida)
      );
    }

    // Para pedidos pendientes, mostrar todos los detalles
    return detalles;
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.farmacia}>{item.farmacia_nombre}</Text>
        <View style={[styles.badge, { backgroundColor: estadoColor(item.estado) }]}>
          <Text style={styles.badgeText}>{ESTADO_LABEL[item.estado] || item.estado}</Text>
        </View>
      </View>
      <Text style={styles.info}>Fecha: {formatDate(item.fecha)}</Text>
      <Text style={styles.info}>Entrega: {item.direccion_entrega}</Text>

      <View style={styles.divider} />
      <Text style={styles.detalleTitulo}>Productos</Text>
      {filtrarDetalles(item.detalles, item.estado).map(renderDetalle)}
    </View>
  );

  if (loading) {
    return <ActivityIndicator size="large" color="#1E88E5" style={{ flex: 1 }} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={orders.length === 0 && styles.emptyContainer}
        ListEmptyComponent={
          <View style={styles.emptyContent}>
            <Text style={styles.emptyTitle}>Todavía no tenés pedidos registrados</Text>
            <Text style={styles.emptySubtitle}>
              Cuando realices compras desde la app, vas a poder verlas acá.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1E88E5"]} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  farmacia: { fontSize: 16, fontWeight: "700", color: "#1F2937" },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  info: { fontSize: 14, color: "#424242", marginTop: 6 },
  divider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 12 },
  detalleTitulo: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: "#1F2937" },
  detalleItem: { marginBottom: 6 },
  detalleProducto: { fontSize: 14, fontWeight: "600", color: "#111827" },
  detalleReceta: { fontSize: 12, color: "#4b5563", marginTop: 2 },
  emptyContainer: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyContent: { alignItems: "center", paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1E88E5", textAlign: "center" },
  emptySubtitle: {
    fontSize: 14,
    color: "#607D8B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});
