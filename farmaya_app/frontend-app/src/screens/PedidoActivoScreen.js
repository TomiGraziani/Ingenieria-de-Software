import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function PedidoActivoScreen({ route, navigation }) {
  const { pedido } = route.params;
  const [retirado, setRetirado] = useState(pedido.estado === "en camino");

  const updateClienteOrderStatus = async (estado) => {
    try {
      const stored = await AsyncStorage.getItem("clienteOrders");
      if (!stored) return;
      const orders = JSON.parse(stored);
      const updated = orders.map((order) =>
        order.id?.toString() === pedido.id?.toString()
          ? { ...order, estado }
          : order
      );
      await AsyncStorage.setItem("clienteOrders", JSON.stringify(updated));
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
        order.id?.toString() === pedido.id?.toString()
          ? { ...order, estado }
          : order
      );
      await AsyncStorage.setItem("farmaciaOrders", JSON.stringify(updated));
    } catch (error) {
      console.error("Error actualizando pedido en farmacia:", error);
    }
  };

  const marcarRetirado = async () => {
    const stored = await AsyncStorage.getItem("pedidosRepartidor");
    const updated = JSON.parse(stored).map((p) =>
      p.id === pedido.id ? { ...p, estado: "retirado" } : p
    );

    setRetirado(true);
    await AsyncStorage.setItem("pedidosRepartidor", JSON.stringify(updated));
    await updateClienteOrderStatus("en_camino");
    await updateFarmaciaOrderStatus("en_camino");

    Alert.alert("📦 Pedido retirado de farmacia", "Procede a entregar.");
  };

  const marcarEntregado = async () => {
    const stored = await AsyncStorage.getItem("pedidosRepartidor");
    const updated = JSON.parse(stored).map((p) =>
      p.id === pedido.id ? { ...p, estado: "entregado" } : p
    );

    await AsyncStorage.setItem("pedidosRepartidor", JSON.stringify(updated));
    await updateClienteOrderStatus("recibido");
    await updateFarmaciaOrderStatus("entregado");
    navigation.replace("HomeRepartidor");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚚 Pedido en proceso</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Farmacia:</Text>
        <Text style={styles.text}>{pedido.farmacia}</Text>

        <Text style={styles.label}>Dirección farmacia:</Text>
        <Text style={styles.text}>{pedido.direccionFarmacia}</Text>

        <Text style={styles.label}>Dirección de entrega:</Text>
        <Text style={styles.text}>{pedido.direccionCliente || "Dirección del cliente"}</Text>

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
