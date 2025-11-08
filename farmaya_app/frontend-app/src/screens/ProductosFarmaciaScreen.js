import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../api/api";
import * as DocumentPicker from "expo-document-picker";

export default function ProductosFarmaciaScreen({ route, navigation }) {
  const { farmacia } = route.params;
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesandoPedido, setProcesandoPedido] = useState(false);
  const [direccionModalVisible, setDireccionModalVisible] = useState(false);
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [direccionError, setDireccionError] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);

  // 🔹 Obtener productos de esa farmacia
  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const response = await API.get(`productos/farmacia/${farmacia.id}/`);
        setProductos(response.data);
      } catch (error) {
        console.error("❌ Error al obtener productos:", error.response?.data || error);
        Alert.alert("Error", "No se pudieron cargar los productos de esta farmacia.");
      } finally {
        setLoading(false);
      }
    };

    fetchProductos();
  }, []);

  const solicitarReceta = () =>
    new Promise((resolve) => {
      let alreadyResolved = false;
      const safeResolve = (value) => {
        if (!alreadyResolved) {
          alreadyResolved = true;
          resolve(value);
        }
      };

      const abrirPicker = async () => {
        try {
          const result = await DocumentPicker.getDocumentAsync({
            type: ["image/*", "application/pdf"],
            copyToCacheDirectory: true,
          });

          if (result.canceled) {
            Alert.alert(
              "Receta obligatoria",
              "Debés adjuntar una receta para continuar con el pedido."
            );
            safeResolve(null);
            return;
          }

          safeResolve(result.assets[0]);
        } catch (error) {
          console.error("Error al seleccionar receta:", error);
          Alert.alert("Error", "No se pudo seleccionar el archivo de la receta.");
          safeResolve(null);
        }
      };

      const abrirCamara = async () => {
        try {
          // eslint-disable-next-line import/no-unresolved
          const ImagePicker = await import("expo-image-picker");
          const { requestCameraPermissionsAsync, launchCameraAsync, MediaTypeOptions } = ImagePicker;

          const { status } = await requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert(
              "Permiso requerido",
              "Necesitamos acceso a la cámara para tomar la foto de la receta."
            );
            safeResolve(null);
            return;
          }

          const result = await launchCameraAsync({
            mediaTypes: MediaTypeOptions.Images,
            quality: 0.7,
          });

          if (result.canceled) {
            Alert.alert(
              "Receta obligatoria",
              "Debés adjuntar una receta para continuar con el pedido."
            );
            safeResolve(null);
            return;
          }

          const asset = result.assets?.[0];
          if (!asset) {
            safeResolve(null);
            return;
          }

          safeResolve({
            uri: asset.uri,
            name: asset.fileName || `receta-${Date.now()}.jpg`,
            mimeType: asset.mimeType || "image/jpeg",
          });
        } catch (error) {
          console.error("Error al tomar foto de la receta:", error);
          Alert.alert("Error", "No se pudo acceder a la cámara.");
          safeResolve(null);
        }
      };

      Alert.alert(
        "Receta necesaria",
        "Este medicamento requiere que adjuntes una receta médica.",
        [
          { text: "Cancelar", style: "cancel", onPress: () => safeResolve(null) },
          { text: "Tomar foto", onPress: () => abrirCamara() },
          { text: "Adjuntar archivo", onPress: () => abrirPicker() },
        ],
        { cancelable: false }
      );
    });

  // 🔹 Crear pedido en el backend
  const realizarPedido = async (producto, direccionSeleccionada) => {
    try {
      if (procesandoPedido) {
        return;
      }

      setProcesandoPedido(true);

      const direccionNormalizada = direccionSeleccionada?.trim();
      if (!direccionNormalizada) {
        Alert.alert("Dirección requerida", "Ingresá una dirección de entrega válida.");
        setProcesandoPedido(false);
        return;
      }

      let recetaAdjunta = null;
      if (producto.requiere_receta) {
        recetaAdjunta = await solicitarReceta();
        if (!recetaAdjunta) {
          setProcesandoPedido(false);
          return;
        }
      }

      const token = await AsyncStorage.getItem("accessToken");
      if (!token) {
        Alert.alert("Sesión expirada", "Por favor, iniciá sesión nuevamente.");
        setProcesandoPedido(false);
        return;
      }

      const formData = new FormData();
      formData.append("producto", String(producto.id));
      formData.append("cantidad", "1");
      formData.append("direccion_entrega", direccionNormalizada);
      formData.append("metodo_pago", "efectivo");

      if (recetaAdjunta) {
        formData.append("receta_archivo", {
          uri: recetaAdjunta.uri,
          name: recetaAdjunta.name || `receta-${Date.now()}`,
          type: recetaAdjunta.mimeType || "image/jpeg",
        });
      }

      const response = await API.post("pedidos/", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      Alert.alert(
        "✅ Pedido creado",
        `Tu pedido de "${producto.nombre}" fue enviado a ${farmacia.nombre}.`
      );
      console.log("📦 Pedido creado:", response.data);

      const payload = response.data || {};
      const pedidoId = payload.id?.toString?.() ?? Date.now().toString();
      const requiereReceta = !!producto.requiere_receta;
      const createdAt = new Date().toISOString();
      const cantidad = Number(payload.cantidad ?? 1);
      const direccion = payload.direccion_entrega || direccionNormalizada;
      const estadoBackend = payload.estado || (requiereReceta ? "pendiente" : "aceptado");
      const clienteNombre = payload.usuario_nombre || payload.usuario?.nombre || "Cliente";
      const clienteEmail = payload.usuario_email || payload.usuario?.email || null;

      const nuevoPedidoCliente = {
        id: pedidoId,
        productoId: producto.id,
        productoNombre: producto.nombre,
        farmaciaId: farmacia.id,
        farmaciaNombre: farmacia.nombre,
        farmaciaDireccion: farmacia.direccion || "Dirección no disponible",
        cantidad,
        direccionEntrega: direccion,
        requiereReceta,
        estado: requiereReceta && estadoBackend === "pendiente" ? "creado" : estadoBackend,
        createdAt,
      };

      const storedCliente = await AsyncStorage.getItem("clienteOrders");
      const pedidosCliente = storedCliente ? JSON.parse(storedCliente) : [];
      await AsyncStorage.setItem(
        "clienteOrders",
        JSON.stringify([...pedidosCliente, nuevoPedidoCliente])
      );

      const pedidoFarmacia = {
        ...nuevoPedidoCliente,
        estado: estadoBackend,
        usuario_email: clienteEmail,
        clienteNombre,
        direccion_entrega: direccion,
      };
      const storedFarmacia = await AsyncStorage.getItem("farmaciaOrders");
      const pedidosFarmacia = storedFarmacia ? JSON.parse(storedFarmacia) : [];
      await AsyncStorage.setItem(
        "farmaciaOrders",
        JSON.stringify([...pedidosFarmacia, pedidoFarmacia])
      );

      if (!requiereReceta) {
        const storedRepartidor = await AsyncStorage.getItem("pedidosRepartidor");
        const pedidosRepartidor = storedRepartidor ? JSON.parse(storedRepartidor) : [];
        const nuevoPedidoRepartidor = {
          id: pedidoId,
          farmacia: farmacia.nombre,
          direccionFarmacia: farmacia.direccion || "Dirección de farmacia",
          direccionCliente: direccion,
          productos: producto.nombre,
          requiereReceta,
          estado: "confirmado",
          distancia: 2.5,
          createdAt,
        };
        await AsyncStorage.setItem(
          "pedidosRepartidor",
          JSON.stringify([...pedidosRepartidor, nuevoPedidoRepartidor])
        );
      }
      setDireccionEntrega("");
      setProductoSeleccionado(null);
      setDireccionError("");
    } catch (error) {
      console.error("❌ Error al crear pedido:", error.response?.data || error);
      Alert.alert(
        "Error",
        error.response?.data?.detail || "No se pudo realizar el pedido."
      );
    } finally {
      setProcesandoPedido(false);
    }
  };

  const abrirModalDireccion = (producto) => {
    setProductoSeleccionado(producto);
    setDireccionError("");
    setDireccionModalVisible(true);
  };

  const cerrarModalDireccion = () => {
    setDireccionModalVisible(false);
    setProductoSeleccionado(null);
  };

  const confirmarDireccion = () => {
    const direccionNormalizada = direccionEntrega.trim();
    if (!direccionNormalizada) {
      setDireccionError("Ingresá la dirección de entrega.");
      return;
    }

    if (!productoSeleccionado) {
      return;
    }

    setDireccionModalVisible(false);
    realizarPedido(productoSeleccionado, direccionNormalizada);
  };

  // 🔹 Loader
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E88E5" />
        <Text style={{ marginTop: 8 }}>Cargando productos...</Text>
      </View>
    );
  }

  // 🔹 Sin productos
  if (productos.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>
          Esta farmacia no tiene productos cargados.
        </Text>
      </View>
    );
  }

  // 🔹 Lista de productos
  return (
    <>
      <View style={styles.container}>
        <Text style={styles.title}>🛍 Productos de {farmacia.nombre}</Text>
        <FlatList
          data={productos}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                Alert.alert(
                  "Confirmar pedido",
                  `¿Querés pedir "${item.nombre}" a ${farmacia.nombre}?`,
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Continuar",
                      onPress: () => abrirModalDireccion(item),
                    },
                  ]
                )
              }
            >
              <Text style={styles.nombre}>{item.nombre}</Text>
              {item.presentacion ? (
                <Text style={styles.presentacion}>💊 {item.presentacion}</Text>
              ) : null}
              {item.descripcion ? (
                <Text style={styles.descripcion}>{item.descripcion}</Text>
              ) : null}
              <Text style={styles.precio}>💰 ${item.precio}</Text>
              <Text style={styles.stock}>📦 Stock disponible: {item.stock}</Text>
              {item.requiere_receta && (
                <Text style={styles.receta}>📜 Requiere receta</Text>
              )}
            </TouchableOpacity>
          )}
        />
      </View>

      <Modal
        visible={direccionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={cerrarModalDireccion}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Dirección de entrega</Text>
            <Text style={styles.modalSubtitle}>
              Ingresá la dirección donde querés recibir tu pedido.
            </Text>
            <TextInput
              style={[styles.input, direccionError ? styles.inputError : null]}
              value={direccionEntrega}
              onChangeText={(value) => {
                setDireccionEntrega(value);
                if (direccionError) {
                  setDireccionError("");
                }
              }}
              placeholder="Ej: Calle 12 #1234, Piso 3"
              autoCapitalize="sentences"
              autoCorrect
            />
            {direccionError ? (
              <Text style={styles.errorText}>{direccionError}</Text>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={cerrarModalDireccion}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={confirmarDireccion}
                disabled={procesandoPedido}
              >
                <Text style={styles.modalButtonText}>
                  {procesandoPedido ? "Creando..." : "Confirmar pedido"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// 🎨 Estilos
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  title: { fontSize: 20, fontWeight: "bold", color: "#1E88E5", marginBottom: 12 },
  card: {
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  nombre: { fontSize: 16, fontWeight: "bold", color: "#333" },
  presentacion: { fontSize: 13, color: "#555", marginTop: 2 },
  descripcion: { fontSize: 13, color: "#555", marginVertical: 4 },
  precio: { fontSize: 14, fontWeight: "600", color: "#2E7D32" },
  stock: { fontSize: 12, color: "#333", marginTop: 4 },
  receta: { fontSize: 12, color: "red" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { textAlign: "center", marginTop: 40, color: "#888", fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E88E5",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#546E7A",
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cfd8dc",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#263238",
  },
  inputError: {
    borderColor: "#e53935",
  },
  errorText: {
    color: "#e53935",
    fontSize: 13,
    marginTop: 6,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalButtonPrimary: {
    backgroundColor: "#1E88E5",
  },
  modalButtonSecondary: {
    backgroundColor: "#90A4AE",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
});
