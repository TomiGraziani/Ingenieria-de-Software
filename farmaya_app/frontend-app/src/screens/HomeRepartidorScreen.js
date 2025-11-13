import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from '../theme/ThemeProvider';
import API from "../api/api";

export default function HomeRepartidorScreen({ navigation }) {
  const [pedidos, setPedidos] = useState([]);
  const [pedidoActivo, setPedidoActivo] = useState(null);
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();
  const styles = createStyles(theme);

  // Formatear pedidos del backend al formato esperado por el frontend
  const formatearPedido = useCallback((pedido) => {
    // Formatear productos
    const productos = pedido.detalles?.map((detalle) => {
      const cantidad = detalle.cantidad || 1;
      const nombre = detalle.producto_nombre || detalle.producto?.nombre || "Producto";
      return cantidad > 1 ? `${nombre} x${cantidad}` : nombre;
    }).join(" + ") || "Sin productos";

    return {
      id: pedido.id?.toString(),
      farmacia: pedido.farmacia_nombre || "Farmacia",
      direccionFarmacia: pedido.farmacia_direccion || "Dirección de farmacia",
      direccionCliente: pedido.direccion_entrega || "Dirección del cliente",
      distancia: 2.5, // Por defecto, se puede calcular con geolocalización
      productos: productos,
      estado: pedido.estado || "aceptado",
      repartidor_id: pedido.repartidor_id,
      detalles: pedido.detalles || [],
      // Mantener datos originales del backend
      ...pedido,
    };
  }, []);

  // Cargar pedidos disponibles desde el backend
  const loadPedidosDisponibles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await API.get("pedidos/disponibles/");
      const pedidosBackend = response.data || [];
      
      // Formatear pedidos
      const pedidosFormateados = pedidosBackend.map(formatearPedido);
      setPedidos(pedidosFormateados);
    } catch (error) {
      console.error("Error cargando pedidos disponibles:", error.response?.data || error);
      if (error.response?.status === 403) {
        Alert.alert("Error", "No tenés permisos para ver pedidos disponibles.");
      } else {
        Alert.alert("Error", "No se pudieron cargar los pedidos disponibles.");
      }
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [formatearPedido]);

  // Verificar si hay un pedido activo (en_camino) del repartidor actual
  const loadPedidoActivo = useCallback(async () => {
    try {
      // Obtener pedidos del repartidor que están en_camino
      const response = await API.get("pedidos/mis/");
      const misPedidos = response.data || [];
      
      // Buscar pedidos en_camino asignados al repartidor actual
      const activo = misPedidos.find(
        (p) => p.estado === "en_camino" && p.repartidor_id
      );
      
      if (activo) {
        const pedidoFormateado = formatearPedido(activo);
        setPedidoActivo(pedidoFormateado);
      } else {
        setPedidoActivo(null);
      }
    } catch (error) {
      console.error("Error cargando pedido activo:", error.response?.data || error);
      setPedidoActivo(null);
    }
  }, [formatearPedido]);

  // Cargar datos al montar y cuando la pantalla obtiene foco
  useEffect(() => {
    loadPedidoActivo();
    loadPedidosDisponibles();
  }, [loadPedidoActivo, loadPedidosDisponibles]);

  useFocusEffect(
    useCallback(() => {
      loadPedidoActivo();
      loadPedidosDisponibles();
    }, [loadPedidoActivo, loadPedidosDisponibles])
  );

  // Navegar a pantalla de pedido activo si existe
  useEffect(() => {
    if (pedidoActivo) {
      navigation.replace("PedidoActivo", {
        pedido: pedidoActivo,
      });
    }
  }, [pedidoActivo, navigation]);

  // Si hay un pedido activo, no mostrar nada (se navegará a PedidoActivo)
  if (pedidoActivo) {
    return null;
  }

  // Aceptar un pedido
  const aceptarPedido = async (id) => {
    try {
      const response = await API.post(`pedidos/${id}/aceptar/`);
      const pedidoAceptado = response.data;
      
      if (pedidoAceptado) {
        // Navegar a la pantalla de pedido activo
        const pedidoFormateado = formatearPedido(pedidoAceptado);
        navigation.replace("PedidoActivo", {
          pedido: pedidoFormateado,
        });
      }
    } catch (error) {
      console.error("Error aceptando pedido:", error.response?.data || error);
      const errorMessage = error.response?.data?.detail || "No se pudo aceptar el pedido.";
      Alert.alert("Error", errorMessage);
    }
  };

  // Rechazar un pedido
  const rechazarPedido = async (id) => {
    try {
      await API.post(`pedidos/${id}/rechazar/`);
      
      // Remover el pedido de la lista local
      setPedidos((prev) => prev.filter((p) => p.id?.toString() !== id.toString()));
      
      Alert.alert("✅ Pedido rechazado", "El pedido ya no aparecerá en tu lista de pedidos disponibles.");
    } catch (error) {
      console.error("Error rechazando pedido:", error.response?.data || error);
      const errorMessage = error.response?.data?.detail || "No se pudo rechazar el pedido.";
      Alert.alert("Error", errorMessage);
    }
  };

  const getDireccionFarmacia = useCallback(
    (pedido) =>
      pedido.direccionFarmacia ||
      pedido.farmacia_direccion ||
      pedido.farmaciaDireccion ||
      "Dirección de farmacia",
    []
  );

  const getDireccionCliente = useCallback(
    (pedido) =>
      pedido.direccionCliente ||
      pedido.direccion_entrega ||
      pedido.direccionEntrega ||
      "Dirección del cliente",
    []
  );

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.farmacia}</Text>
      <Text style={{color: theme.colors.textSecondary}}>📍 {getDireccionFarmacia(item)}</Text>
      <Text style={{color: theme.colors.textSecondary}}>🏠 {getDireccionCliente(item)}</Text>
      <Text style={{color: theme.colors.textSecondary}}>🛵 Distancia: {item.distancia} km</Text>
      <Text style={{color: theme.colors.textSecondary}}>💊 Pedido: {item.productos}</Text>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.accept} onPress={() => aceptarPedido(item.id)}>
          <Text style={styles.btnText}>Aceptar ✅</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.reject} onPress={() => rechazarPedido(item.id)}>
          <Text style={styles.btnText}>Rechazar ❌</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.header}>🚚 Pedidos Disponibles</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Cargando pedidos...</Text>
          </View>
        ) : pedidos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No hay pedidos disponibles por ahora</Text>
            <Text style={styles.emptySubtitle}>
              Cuando una farmacia acepte un pedido y esté listo para entrega, lo vas a ver en esta lista.
            </Text>
          </View>
        ) : (
          <FlatList
            data={pedidos.sort((a, b) => (a.distancia || 0) - (b.distancia || 0))}
            keyExtractor={item => item.id?.toString()}
            renderItem={renderItem}
            refreshing={loading}
            onRefresh={loadPedidosDisponibles}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme) => 
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background, },
  container: { flex: 1, padding: 20, backgroundColor: theme.colors.background, },
  header: { fontSize: 22, fontWeight: "700", marginBottom: 12, marginTop: 8, color: theme.colors.text, },
  card: { padding: 14, backgroundColor: theme.colors.surface, shadowColor: '#000', borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border, },
  title: { fontSize: 18, fontWeight: "600", color: theme.colors.text, },
  buttons: { flexDirection: "row", marginTop: 10, gap: 10 },
  accept: { flex: 1, backgroundColor: "#2E7D32", padding: 10, borderRadius: 6 },
  reject: { flex: 1, backgroundColor: "#C62828", padding: 10, borderRadius: 6 },
  btnText: { color: "#fff", textAlign: "center", fontWeight: "600" },
  emptyState: {
    marginTop: 32,
    padding: 24,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#1E88E5", textAlign: "center" },
  emptySubtitle: { fontSize: 14, color: "#546E7A", textAlign: "center", marginTop: 8 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
});
