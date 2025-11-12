import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import API from "../api/api";
import { useTheme } from '../theme/ThemeProvider';
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
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { pedido } = route.params;
  const pedidoId = useMemo(() => pedido?.id?.toString() ?? "", [pedido?.id]);
  const [currentStatus, setCurrentStatus] = useState(() => normalizeStatus(pedido?.estado));
  const [showMotivoModal, setShowMotivoModal] = useState(false);
  const [motivoNoEntrega, setMotivoNoEntrega] = useState("");
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

  const updateClienteOrderStatus = async (estado, motivoNoEntrega = null) => {
    try {
      const storageKey = await getClienteOrdersStorageKey();
      const stored = await AsyncStorage.getItem(storageKey);
      if (!stored) return;
      const ordersRaw = JSON.parse(stored);
      const orders = Array.isArray(ordersRaw) ? ordersRaw : [];
      if (orders.length === 0) return;
      const updated = orders.map((order) => {
        if (order.id?.toString() === pedidoId) {
          const updatedOrder = { ...order, estado };
          if (motivoNoEntrega) {
            updatedOrder.motivo_no_entrega = motivoNoEntrega;
          }
          return updatedOrder;
        }
        return order;
      });
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (error) {
      console.error("Error actualizando pedido del cliente:", error);
    }
  };

  const updateFarmaciaOrderStatus = async (estado, motivoNoEntrega = null) => {
    try {
      const stored = await AsyncStorage.getItem("farmaciaOrders");
      if (!stored) return;
      const orders = JSON.parse(stored);
      const updated = orders.map((order) => {
        if (order.id?.toString() === pedidoId) {
          const updatedOrder = { ...order, estado };
          if (motivoNoEntrega) {
            updatedOrder.motivo_no_entrega = motivoNoEntrega;
          }
          return updatedOrder;
        }
        return order;
      });
      await AsyncStorage.setItem("farmaciaOrders", JSON.stringify(updated));
    } catch (error) {
      console.error("Error actualizando pedido en farmacia:", error);
    }
  };

  const marcarRetirado = async () => {
    try {
      // Actualizar en el backend primero
      try {
        await API.patch(`pedidos/${pedidoId}/estado/`, {
          estado: "en_camino",
        });
      } catch (apiError) {
        console.error("Error actualizando estado en el backend:", apiError.response?.data || apiError);
        // Continuar con la actualización local aunque falle el backend
      }

      // Actualizar en AsyncStorage local
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
      Alert.alert("Error", "No se pudo actualizar el estado del pedido.");
    }
  };

  const marcarEntregado = async () => {
    try {
      // Actualizar en el backend primero
      try {
        await API.patch(`pedidos/${pedidoId}/estado/`, {
          estado: "entregado",
        });
      } catch (apiError) {
        console.error("Error actualizando estado en el backend:", apiError.response?.data || apiError);
        // Continuar con la actualización local aunque falle el backend
      }

      // Actualizar en AsyncStorage local
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
      Alert.alert("Error", "No se pudo actualizar el estado del pedido.");
    }
  };


  const marcarNoEntregado = async () => {
    if (!motivoNoEntrega.trim()) {
      Alert.alert("Error", "Por favor ingresá el motivo de no entrega.");
      return;
    }

    try {
      // Actualizar en el backend primero
      let pedidoActualizado = null;
      try {
        const response = await API.patch(`pedidos/${pedidoId}/estado/`, {
          estado: "no_entregado",
          motivo_no_entrega: motivoNoEntrega.trim(),
        });
        pedidoActualizado = response.data;
      } catch (apiError) {
        console.error("Error actualizando estado en el backend:", apiError.response?.data || apiError);
        // Continuar con la actualización local aunque falle el backend
      }

      // Usar los datos del backend si están disponibles, sino usar los datos locales
      const estadoFinal = "no_entregado";
      const motivoFinal = pedidoActualizado?.motivo_no_entrega || motivoNoEntrega.trim();

      // Actualizar en AsyncStorage local
      const stored = await AsyncStorage.getItem("pedidosRepartidor");
      const pedidos = stored ? JSON.parse(stored) : [];
      const pedidosArray = Array.isArray(pedidos) ? pedidos : [];
      const updated = pedidosArray.map((p) =>
        p.id?.toString() === pedidoId
          ? { ...p, estado: estadoFinal, motivo_no_entrega: motivoFinal }
          : p
      );

      await AsyncStorage.setItem("pedidosRepartidor", JSON.stringify(updated));
      await updateClienteOrderStatus(estadoFinal, motivoFinal);
      await updateFarmaciaOrderStatus(estadoFinal, motivoFinal);

      setCurrentStatus("no_entregado");
      setShowMotivoModal(false);
      setMotivoNoEntrega("");
      Alert.alert("✅ Pedido marcado como no entregado", "El pedido fue actualizado y el cliente y la farmacia serán notificados.");
      navigation.replace("HomeRepartidor");
    } catch (error) {
      console.error("Error al marcar pedido como no entregado:", error);
      Alert.alert("Error", "No se pudo actualizar el estado del pedido.");
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
        <>
          <TouchableOpacity style={[styles.button, { backgroundColor: "#2E7D32" }]} onPress={marcarEntregado}>
            <Text style={styles.buttonText}>✅ Marcar como entregado</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: "#D32F2F" }]} onPress={() => setShowMotivoModal(true)}>
            <Text style={styles.buttonText}>❌ Marcar como no entregado</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Modal para ingresar motivo de no entrega */}
      <Modal
        visible={showMotivoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMotivoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Motivo de no entrega</Text>
            <Text style={styles.modalSubtitle}>
              Ingresá el motivo por el cual no se pudo entregar el pedido:
            </Text>
            <TextInput
              style={styles.motivoInput}
              placeholder="Ej: Cliente no se encontraba en la dirección, dirección incorrecta, etc."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={motivoNoEntrega}
              onChangeText={setMotivoNoEntrega}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowMotivoModal(false);
                  setMotivoNoEntrega("");
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={marcarNoEntregado}
              >
                <Text style={styles.modalButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme) => 
  StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: 20 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 20, color: theme.colors.text, },
  card: {
    backgroundColor: theme.colors.surface,
    padding: 15,
    borderRadius: 10,
    marginBottom: 30,
    shadowColor: '#000',
    borderColor: theme.colors.border,
  },
  label: { fontWeight: "600", marginTop: 8, color: theme.colors.text, },
  text: { color: theme.colors.textSecondary,fontSize: 16, marginBottom: 6 },
  button: { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary,padding: 14, borderRadius: 8, marginBottom: 10 },
  buttonText: { textAlign: "center", color: theme.colors.buttonText, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    color: "#333",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  motivoInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 20,
    backgroundColor: "#f9f9f9",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#e0e0e0",
  },
  modalButtonConfirm: {
    backgroundColor: "#D32F2F",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  modalButtonTextCancel: {
    color: "#333",
    fontWeight: "600",
    fontSize: 16,
  },
});
