import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import getClienteOrdersStorageKey from "../utils/storageKeys";

const normalizeStatus = (status) => {
  const value = (status || "").toString().trim().toLowerCase();
  const map = {
    "en camino": "en_camino",
    en_camino: "en_camino",
    recogido: "en_camino",
    retirado: "en_camino",
    entregado: "entregado",
    recibido: "entregado",
  };

  return map[value] || value;
};

export default function PedidoActivoScreen({ route, navigation }) {
  const { pedido } = route.params;
  const pedidoId = useMemo(() => pedido?.id?.toString() ?? "", [pedido?.id]);
  const [currentStatus, setCurrentStatus] = useState(() => normalizeStatus(pedido?.estado));
  const retirado = currentStatus === "en_camino";
  const direccionFarmacia =
    pedido.direccionFarmacia ||
    pedido.farmaciaDireccion ||
    pedido.farmacia_direccion ||
    "Dirección de farmacia";
  const direccionEntrega =
    pedido.direccionCliente ||
    pedido.direccionEntrega ||
    pedido.direccion_entrega ||
    "Dirección del cliente";

  useEffect(() => {
    const syncEstado = async () => {
      if (!pedidoId) return;

      try {
        const stored = await AsyncStorage.getItem("pedidosRepartidor");
        if (!stored) return;

        const pedidos = JSON.parse(stored);
        const pedidosArray = Array.isArray(pedidos) ? pedidos : [];
        const pedidoGuardado = pedidosArray.find(
          (item) => item.id?.toString() === pedidoId
        );

        if (pedidoGuardado?.estado != null) {
          setCurrentStatus(normalizeStatus(pedidoGuardado.estado));
        }
      } catch (error) {
        console.error("Error sincronizando estado del pedido activo:", error);
      }
    };

    syncEstado();
  }, [pedidoId]);

  const updateClienteOrderStatus = async (estado) => {
    try {
      const storageKey = await getClienteOrdersStorageKey();
      const stored = await AsyncStorage.getItem(storageKey);
      if (!stored) return;
      const ordersRaw = JSON.parse(stored);
      const orders = Array.isArray(ordersRaw) ? ordersRaw : [];
      if (orders.length === 0) return;
      const updated = orders.map((order) =>
        order.id?.toString() === pedidoId
          ? { ...order, estado }
          : order
      );
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (error) {
      console.error("Error actualizando pedido del cliente:", error);
    }
  };

  const updateFarmaciaOrderStatus = async (estado) => {
    try {
      const stored = await AsyncStorage.getItem("farmaciaOrders");
      if (!stored) return;
      const orders = JSON.parse(stored);
      const updated = orders.map((order) =>
        order.id?.toString() === pedidoId
          ? { ...order, estado }
          : order
      );
      await AsyncStorage.setItem("farmaciaOrders", JSON.stringify(updated));
    } catch (error) {
      console.error("Error actualizando pedido en farmacia:", error);
    }
  };

  const marcarRetirado = async () => {
    try {
      const stored = await AsyncStorage.getItem("pedidosRepartidor");
      const pedidos = stored ? JSON.parse(stored) : [];
      const pedidosArray = Array.isArray(pedidos) ? pedidos : [];
      const updated = pedidosArray.map((p) =>
        p.id?.toString() === pedidoId ? { ...p, estado: "en_camino" } : p
      );

      setCurrentStatus("en_camino");
      await AsyncStorage.setItem("pedidosRepartidor", JSON.stringify(updated));
      await updateClienteOrderStatus("en_camino");
      await updateFarmaciaOrderStatus("en_camino");

      Alert.alert("📦 Pedido retirado de farmacia", "Procede a entregar.");
    } catch (error) {
      console.error("Error al marcar pedido como retirado:", error);
    }
  };

  const marcarEntregado = async () => {
    try {
      const stored = await AsyncStorage.getItem("pedidosRepartidor");
      const pedidos = stored ? JSON.parse(stored) : [];
      const pedidosArray = Array.isArray(pedidos) ? pedidos : [];
      const updated = pedidosArray.map((p) =>
        p.id?.toString() === pedidoId ? { ...p, estado: "entregado" } : p
      );

      await AsyncStorage.setItem("pedidosRepartidor", JSON.stringify(updated));
      await updateClienteOrderStatus("entregado");
      await updateFarmaciaOrderStatus("entregado");
      setCurrentStatus("entregado");
      navigation.replace("HomeRepartidor");
    } catch (error) {
      console.error("Error al marcar pedido como entregado:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚚 Pedido en proceso</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Farmacia:</Text>
        <Text style={styles.text}>{pedido.farmacia}</Text>

        <Text style={styles.label}>Dirección farmacia:</Text>
        <Text style={styles.text}>{direccionFarmacia}</Text>

        <Text style={styles.label}>Dirección de entrega:</Text>
        <Text style={styles.text}>{direccionEntrega}</Text>

        <Text style={styles.label}>Productos:</Text>
        <Text style={styles.text}>{pedido.productos}</Text>
      </View>

      {!retirado ? (
        <TouchableOpacity style={styles.button} onPress={marcarRetirado}>
          <Text style={styles.buttonText}>📦 Marcar como retirado</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.button, { backgroundColor: "#2E7D32" }]} onPress={marcarEntregado}>
          <Text style={styles.buttonText}>✅ Marcar como entregado</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
  card: {
    backgroundColor: "#f4f4f4",
    padding: 15,
    borderRadius: 10,
    marginBottom: 30,
  },
  label: { fontWeight: "600", marginTop: 8 },
  text: { fontSize: 16, marginBottom: 6 },
  button: { backgroundColor: "#1565C0", padding: 14, borderRadius: 8, marginBottom: 10 },
  buttonText: { textAlign: "center", color: "#fff", fontWeight: "600" }
});
