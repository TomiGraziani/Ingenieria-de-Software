import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

const normalizeRepartidorStatus = (estado) => {
  const value = (estado || "").toString().trim().toLowerCase();
  const map = {
    "en camino": "en_camino",
    en_camino: "en_camino",
    recogido: "en_camino",
    retirado: "en_camino",
  };

  return map[value] || value;
};

export default function HomeRepartidorScreen({ navigation }) {
  const [pedidos, setPedidos] = useState([]);

  const getDireccionFarmacia = useCallback(
    (pedido) =>
      pedido.direccionFarmacia ||
      pedido.farmaciaDireccion ||
      pedido.farmacia_direccion ||
      "Dirección de farmacia",
    []
  );

  const getDireccionCliente = useCallback(
    (pedido) =>
      pedido.direccionCliente ||
      pedido.direccionEntrega ||
      pedido.direccion_entrega ||
      "Dirección del cliente",
    []
  );

  const loadPedidos = useCallback(async () => {
    const stored = await AsyncStorage.getItem("pedidosRepartidor");

    if (stored) {
      let parsed = [];
      try {
        const raw = JSON.parse(stored);
        parsed = Array.isArray(raw) ? raw : [];
      } catch (error) {
        console.error("Error leyendo pedidos del repartidor:", error);
      }

      const normalized = parsed.map((pedido) => {
        const estadoNormalizado = normalizeRepartidorStatus(pedido?.estado);
        if (estadoNormalizado === pedido?.estado) {
          return pedido;
        }

        return { ...pedido, estado: estadoNormalizado };
      });

      setPedidos(normalized);

      const hasChanges = normalized.some((pedido, index) => pedido !== parsed[index]);
      if (hasChanges) {
        await AsyncStorage.setItem("pedidosRepartidor", JSON.stringify(normalized));
      }
    } else {
      // ✅ Pedidos simulados LISTOS para repartidor
      const mockPedidos = [
        {
          id: "1",
          farmacia: "Farmacia Central",
          direccionFarmacia: "Av. Siempre Viva 742",
          direccionCliente: "Calle 50 #800",
          distancia: 2.4,
          productos: "Ibuprofeno + Amoxicilina",
          estado: "confirmado", // 👈 IMPORTANTE
        },
        {
          id: "2",
          farmacia: "Farmacity",
          direccionFarmacia: "Calle 12 #1200",
          direccionCliente: "Av. 7 #1420",
          distancia: 4.7,
          productos: "Paracetamol 500mg",
          estado: "confirmado", // 👈 IMPORTANTE
        }
      ];

      setPedidos(mockPedidos);
      await AsyncStorage.setItem("pedidosRepartidor", JSON.stringify(mockPedidos));
    }
  }, []);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  useFocusEffect(
    useCallback(() => {
      loadPedidos();
    }, [loadPedidos])
  );

  const updateClienteOrderStatus = async (id, estado) => {
    try {
      const stored = await AsyncStorage.getItem("clienteOrders");
      if (!stored) return;
      const orders = JSON.parse(stored);
      const updated = orders.map((order) =>
        order.id?.toString() === id.toString()
          ? { ...order, estado }
          : order
      );
      await AsyncStorage.setItem("clienteOrders", JSON.stringify(updated));
    } catch (error) {
      console.error("Error actualizando estado del pedido del cliente:", error);
    }
  };

  const updateFarmaciaOrderStatus = async (id, estado) => {
    try {
      const stored = await AsyncStorage.getItem("farmaciaOrders");
      if (!stored) return;
      const orders = JSON.parse(stored);
      const updated = orders.map((order) =>
        order.id?.toString() === id.toString()
          ? { ...order, estado }
          : order
      );
      await AsyncStorage.setItem("farmaciaOrders", JSON.stringify(updated));
    } catch (error) {
      console.error("Error actualizando estado del pedido en farmacia:", error);
    }
  };

  // ✅ Solo mostrar pedidos confirmados
  const pedidosDisponibles = useMemo(
    () => pedidos.filter((p) => normalizeRepartidorStatus(p.estado) === "confirmado"),
    [pedidos]
  );

  // ✅ Si tiene un pedido tomado, ir a pantalla activa
  const pedidoActivo = useMemo(
    () =>
      pedidos.find((p) => {
        const estado = normalizeRepartidorStatus(p.estado);
        return estado === "asignado" || estado === "en_camino";
      }),
    [pedidos]
  );

  useEffect(() => {
    if (pedidoActivo) {
      navigation.replace("PedidoActivo", {
        pedido: {
          ...pedidoActivo,
          direccionFarmacia: getDireccionFarmacia(pedidoActivo),
          direccionCliente: getDireccionCliente(pedidoActivo),
        },
      });
    }
  }, [pedidoActivo, navigation, getDireccionFarmacia, getDireccionCliente]);

  if (pedidoActivo) {
    return null;
  }

  const aceptarPedido = async (id) => {
    const repartidor = { nombre: "Repartidor Test" }; // luego vendrá del login

    const updated = pedidos.map(p =>
      p.id === id
        ? {
            ...p,
            estado: "asignado",
            repartidor,
            direccionFarmacia: getDireccionFarmacia(p),
            direccionCliente: getDireccionCliente(p),
          }
        : p
    );

    setPedidos(updated);
    await AsyncStorage.setItem("pedidosRepartidor", JSON.stringify(updated));
    await updateClienteOrderStatus(id, "aceptado");
    await updateFarmaciaOrderStatus(id, "aceptado");

    const pedido = updated.find(p => p.id === id);
    if (pedido) {
      navigation.replace("PedidoActivo", {
        pedido: {
          ...pedido,
          direccionFarmacia: getDireccionFarmacia(pedido),
          direccionCliente: getDireccionCliente(pedido),
        },
      });
    }
  };

  const rechazarPedido = async (id) => {
    const updated = pedidos.filter(p => p.id !== id);
    setPedidos(updated);
    await AsyncStorage.setItem("pedidosRepartidor", JSON.stringify(updated));

    Alert.alert("❌ Pedido rechazado", "Se asignará a otro repartidor");
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.farmacia}</Text>
      <Text>📍 {getDireccionFarmacia(item)}</Text>
      <Text>🏠 {getDireccionCliente(item)}</Text>
      <Text>🛵 Distancia: {item.distancia} km</Text>
      <Text>💊 Pedido: {item.productos}</Text>

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
    <View style={styles.container}>
      <Text style={styles.header}>🚚 Pedidos Disponibles</Text>

      {pedidosDisponibles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No hay pedidos pendientes por ahora</Text>
          <Text style={styles.emptySubtitle}>
            Cuando una farmacia confirme un pedido lo vas a ver en esta lista.
          </Text>
        </View>
      ) : (
        <FlatList
          data={pedidosDisponibles.sort((a, b) => a.distancia - b.distancia)}
          keyExtractor={item => item.id}
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#fff" },
  header: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  card: { padding: 14, backgroundColor: "#f9f9f9", borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#ddd" },
  title: { fontSize: 18, fontWeight: "600" },
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
});
