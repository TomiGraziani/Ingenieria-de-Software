import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import API from "../api/api";
import { useTheme } from '../theme/ThemeProvider';

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
  const { theme } = useTheme();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userLoaded, setUserLoaded] = useState(false);
  const styles = createStyles(theme);

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

const createStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    card: {
      backgroundColor: theme.colors.surface,
      padding: 16,
      borderRadius: 16,
      marginHorizontal: 16,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 3,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    farmacia: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    badgeText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 12,
    },
    info: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      marginBottom: 2,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 10,
    },
    detalleTitulo: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 6,
    },
    detalleItem: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      padding: 10,
      marginVertical: 4,
    },
    detalleProducto: {
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '500',
    },
    detalleReceta: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    emptyContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      paddingHorizontal: 24,
    },
    emptyContent: {
      alignItems: 'center',
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
