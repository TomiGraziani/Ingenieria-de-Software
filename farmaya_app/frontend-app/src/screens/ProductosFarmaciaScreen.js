import React, { useEffect, useMemo, useState } from "react";
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
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Dimensions,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../api/api";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import getClienteOrdersStorageKey from "../utils/storageKeys";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const formatRecetaNombre = (receta) => {
  if (!receta) return null;
  if (receta.name) return receta.name;
  if (receta.uri) {
    const parts = receta.uri.split("/");
    return parts[parts.length - 1];
  }
  return "Receta adjunta";
};

export default function ProductosFarmaciaScreen({ route }) {
  const { farmacia } = route.params;
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesandoPedido, setProcesandoPedido] = useState(false);
  const [carrito, setCarrito] = useState([]);

  const [direccionModalVisible, setDireccionModalVisible] = useState(false);
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [direccionError, setDireccionError] = useState("");

  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [cantidadSeleccionada, setCantidadSeleccionada] = useState("1");
  const [recetaTemporal, setRecetaTemporal] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);

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
  }, [farmacia.id]);

  const solicitarReceta = () =>
    new Promise((resolve) => {
      let alreadyResolved = false;

      const safeResolve = (value) => {
        if (!alreadyResolved) {
          alreadyResolved = true;
          resolve(value);
        }
      };

      const tomarFoto = async () => {
        try {
          // Solicitar permisos de cámara
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert(
              "Permisos necesarios",
              "Se necesitan permisos de cámara para tomar una foto de la receta."
            );
            safeResolve(null);
            return;
          }

          // Abrir la cámara
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.8,
          });

          if (result.canceled) {
            safeResolve(null);
            return;
          }

          if (result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            // Convertir el resultado de ImagePicker al formato esperado
            const receta = {
              uri: asset.uri,
              name: `receta_${Date.now()}.jpg`,
              mimeType: "image/jpeg",
              type: "image/jpeg",
            };
            safeResolve(receta);
          } else {
            safeResolve(null);
          }
        } catch (error) {
          console.error("Error al tomar foto:", error);
          Alert.alert("Error", "No se pudo tomar la foto de la receta.");
          safeResolve(null);
        }
      };

      const abrirPicker = async () => {
        try {
          const result = await DocumentPicker.getDocumentAsync({
            type: ["image/*", "application/pdf"],
            copyToCacheDirectory: true,
          });

          if (result.canceled) {
            safeResolve(null);
            return;
          }

          safeResolve(result.assets?.[0] || null);
        } catch (error) {
          console.error("Error al seleccionar receta:", error);
          Alert.alert("Error", "No se pudo seleccionar el archivo de la receta.");
          safeResolve(null);
        }
      };

      Alert.alert(
        "Receta necesaria",
        "Este medicamento requiere que adjuntes una receta médica.",
        [
          { text: "Cancelar", style: "cancel", onPress: () => safeResolve(null) },
          { text: "📷 Tomar foto", onPress: () => tomarFoto() },
          { text: "📁 Seleccionar archivo", onPress: () => abrirPicker() },
        ],
        { cancelable: false }
      );
    });

  const abrirModalProducto = (producto, editar = false) => {
    setProductoSeleccionado(producto);

    if (editar) {
      const existente = carrito.find((item) => item.producto.id === producto.id);
      setCantidadSeleccionada(existente ? String(existente.cantidad) : "1");
      setRecetaTemporal(existente?.receta || null);
      setEditingItemId(producto.id);
    } else {
      setCantidadSeleccionada("1");
      setRecetaTemporal(null);
      setEditingItemId(null);
    }

    setItemModalVisible(true);
  };

  const cerrarModalProducto = () => {
    setItemModalVisible(false);
    setProductoSeleccionado(null);
    setCantidadSeleccionada("1");
    setRecetaTemporal(null);
    setEditingItemId(null);
  };

  const adjuntarRecetaManual = async () => {
    const receta = await solicitarReceta();
    if (receta) {
      setRecetaTemporal(receta);
    }
  };

  const confirmarProducto = async () => {
    if (!productoSeleccionado) {
      return;
    }

    const cantidadNum = parseInt(cantidadSeleccionada, 10);
    if (Number.isNaN(cantidadNum) || cantidadNum <= 0) {
      Alert.alert("Cantidad inválida", "Ingresá una cantidad mayor a cero.");
      return;
    }

    let recetaAdjunta = recetaTemporal;
    if (productoSeleccionado.requiere_receta && !recetaAdjunta) {
      recetaAdjunta = await solicitarReceta();
      if (!recetaAdjunta) {
        return;
      }
    }

    setCarrito((prev) => {
      if (editingItemId) {
        return prev.map((item) =>
          item.producto.id === editingItemId
            ? { ...item, cantidad: cantidadNum, receta: recetaAdjunta }
            : item
        );
      }

      const existente = prev.find((item) => item.producto.id === productoSeleccionado.id);
      if (existente) {
        return prev.map((item) =>
          item.producto.id === productoSeleccionado.id
            ? {
              ...item,
              cantidad: item.cantidad + cantidadNum,
              receta: item.receta || recetaAdjunta,
            }
            : item
        );
      }

      return [
        ...prev,
        { producto: productoSeleccionado, cantidad: cantidadNum, receta: recetaAdjunta },
      ];
    });

    cerrarModalProducto();
  };

  const eliminarDelCarrito = (productoId, productoNombre) => {
    Alert.alert(
      "¿Estás seguro?",
      `¿Estás seguro que deseas quitar este medicamento: ${productoNombre}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Quitar",
          style: "destructive",
          onPress: () => {
            setCarrito((prev) => prev.filter((item) => item.producto.id !== productoId));
          },
        },
      ]
    );
  };

  const totalProductos = useMemo(
    () => carrito.reduce((acc, item) => acc + item.cantidad, 0),
    [carrito]
  );

  const totalEstimado = useMemo(
    () =>
      carrito.reduce(
        (acc, item) => acc + Number(item.producto.precio || 0) * item.cantidad,
        0
      ),
    [carrito]
  );

  const abrirModalDireccion = () => {
    if (carrito.length === 0) {
      Alert.alert("Pedido vacío", "Agregá al menos un producto al pedido.");
      return;
    }
    setDireccionError("");
    setDireccionModalVisible(true);
  };

  const cerrarModalDireccion = () => {
    setDireccionModalVisible(false);
  };

  const confirmarDireccion = () => {
    const direccionNormalizada = direccionEntrega.trim();
    if (!direccionNormalizada) {
      setDireccionError("Ingresá la dirección de entrega.");
      return;
    }

    setDireccionModalVisible(false);
    crearPedido(direccionNormalizada);
  };

  const guardarPedidoEnCliente = async (pedidoCreado, direccionSeleccionada) => {
    try {
      const storageKey = await getClienteOrdersStorageKey();
      const stored = await AsyncStorage.getItem(storageKey);
      let pedidosPrevios = [];

      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          pedidosPrevios = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          console.error("Error interpretando pedidos existentes del cliente:", error);
          pedidosPrevios = [];
        }
      }

      const detalles = Array.isArray(pedidoCreado?.detalles) ? pedidoCreado.detalles : [];
      const resumenProductos = detalles.length
        ? detalles
          .map(
            (detalle) =>
              `${detalle.producto_nombre || detalle.productoNombre || detalle.producto || "Producto"
              } × ${detalle.cantidad ?? 1}`
          )
          .join(", ")
        : carrito
          .map(
            (item) => `${item.producto?.nombre || "Producto"} × ${item.cantidad ?? 1}`
          )
          .join(", ");

      const nuevoPedido = {
        id: pedidoCreado?.id,
        estado: "creado", // Etapa 1: Pedido Creado - se marca como realizada cuando el cliente confirma
        direccionEntrega: pedidoCreado?.direccion_entrega || direccionSeleccionada,
        direccion_entrega: pedidoCreado?.direccion_entrega || direccionSeleccionada,
        productoNombre: resumenProductos,
        producto_nombre: resumenProductos,
        farmaciaNombre: pedidoCreado?.farmacia_nombre || farmacia?.nombre || "Farmacia",
        farmacia: pedidoCreado?.farmacia_nombre || farmacia?.nombre || "Farmacia",
        farmaciaId: farmacia?.id,
        clienteNombre: pedidoCreado?.cliente_nombre || "",
        clienteEmail: pedidoCreado?.cliente_email || "",
        createdAt: pedidoCreado?.fecha || new Date().toISOString(),
      };

      const pedidosActualizados = [
        nuevoPedido,
        ...pedidosPrevios.filter(
          (pedido) => pedido?.id?.toString() !== (pedidoCreado?.id ?? "").toString()
        ),
      ];

      await AsyncStorage.setItem(storageKey, JSON.stringify(pedidosActualizados));
    } catch (error) {
      console.error("No se pudo guardar el pedido para el cliente:", error);
    }
  };

  const crearPedido = async (direccionSeleccionada) => {
    try {
      if (procesandoPedido) {
        return;
      }

      setProcesandoPedido(true);

      const detalles = carrito.map((item, index) => ({
        producto: item.producto.id,
        cantidad: item.cantidad,
        receta_key: item.producto.requiere_receta ? `receta_${index}` : null,
      }));

      const formData = new FormData();
      formData.append("farmacia_id", String(farmacia.id));
      formData.append("direccion_entrega", direccionSeleccionada.trim());
      formData.append("metodo_pago", "efectivo");
      formData.append("detalles", JSON.stringify(detalles));

      carrito.forEach((item, index) => {
        if (item.producto.requiere_receta && item.receta) {
          formData.append(`receta_${index}`, {
            uri: item.receta.uri,
            name: item.receta.name || `receta-${item.producto.id}-${Date.now()}`,
            type: item.receta.mimeType || "image/jpeg",
          });
        }
      });

      const response = await API.post("pedidos/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      Alert.alert(
        "✅ Pedido creado",
        "Tu pedido fue enviado a la farmacia. Podés seguir el estado desde la sección Mis pedidos."
      );

      await guardarPedidoEnCliente(response.data, direccionSeleccionada);

      setCarrito([]);
      setDireccionEntrega("");
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E88E5" />
        <Text style={{ marginTop: 8 }}>Cargando productos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🛍 Productos de {farmacia.nombre}</Text>

      <FlatList
        data={productos}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{
          paddingBottom: carrito.length > 0 ? 200 : 20,
          paddingTop: 8,
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Esta farmacia no tiene productos cargados.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
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
            </View>

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => abrirModalProducto(item)}
            >
              <Text style={styles.addButtonText}>Agregar</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      {carrito.length > 0 ? (
        <SafeAreaView edges={['bottom']} style={styles.cartContainerWrapper}>
          <ScrollView
            style={styles.cartScrollView}
            contentContainerStyle={styles.cartContainer}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.cartTitle}>🧺 Pedido actual</Text>
            {carrito.map((item) => (
              <View key={item.producto.id} style={styles.cartItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartItemName}>
                    {item.producto.nombre} × {item.cantidad}
                  </Text>
                  <Text style={styles.cartItemPrice}>
                    ${Number(item.producto.precio || 0) * item.cantidad}
                  </Text>
                  {item.producto.requiere_receta ? (
                    <Text style={styles.cartItemReceta}>
                      {item.receta
                        ? `📄 ${formatRecetaNombre(item.receta)}`
                        : "📄 Receta pendiente"}
                    </Text>
                  ) : (
                    <Text style={styles.cartItemReceta}>✅ Sin receta</Text>
                  )}
                </View>

                <View style={styles.cartActions}>
                  <TouchableOpacity
                    style={styles.secondaryAction}
                    onPress={() => abrirModalProducto(item.producto, true)}
                  >
                    <Text style={styles.secondaryActionText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => eliminarDelCarrito(item.producto.id, item.producto.nombre)}
                  >
                    <Text style={styles.removeButtonText}>Quitar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <View style={styles.cartSummary}>
              <Text style={styles.summaryText}>Productos: {totalProductos}</Text>
              <Text style={styles.summaryText}>
                Total estimado: ${totalEstimado.toFixed(2)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={abrirModalDireccion}
              disabled={procesandoPedido}
            >
              <Text style={styles.confirmButtonText}>
                {procesandoPedido ? "Enviando..." : "Confirmar pedido"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      ) : null}

      <Modal
        visible={itemModalVisible}
        transparent
        animationType="fade"
        onRequestClose={cerrarModalProducto}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {productoSeleccionado?.nombre || "Producto"}
            </Text>
            <Text style={styles.modalSubtitle}>
              Ingresá la cantidad que querés agregar a tu pedido.
            </Text>
            <TextInput
              style={[styles.input, styles.quantityInput]}
              keyboardType="numeric"
              value={cantidadSeleccionada}
              onChangeText={setCantidadSeleccionada}
              placeholder="Cantidad"
            />

            {productoSeleccionado?.requiere_receta ? (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.recetaInfo}>📜 Este producto requiere receta médica.</Text>
                {recetaTemporal ? (
                  <Text style={styles.recetaAdjunta}>
                    Receta adjunta: {formatRecetaNombre(recetaTemporal)}
                  </Text>
                ) : (
                  <Text style={styles.recetaPendiente}>No hay receta adjunta.</Text>
                )}
                <TouchableOpacity style={styles.attachButton} onPress={adjuntarRecetaManual}>
                  <Text style={styles.attachButtonText}>
                    {recetaTemporal ? "Cambiar receta" : "Adjuntar receta"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={cerrarModalProducto}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={confirmarProducto}
              >
                <Text style={styles.modalButtonText}>
                  {editingItemId ? "Actualizar" : "Agregar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={direccionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={cerrarModalDireccion}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
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
                  {procesandoPedido ? "Enviando..." : "Confirmar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 12,
    paddingHorizontal: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E88E5",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { textAlign: "center", marginTop: 40, color: "#888", fontSize: 15 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    gap: 10,
    minHeight: 100,
  },
  nombre: { fontSize: 16, fontWeight: "bold", color: "#333" },
  presentacion: { fontSize: 13, color: "#555", marginTop: 2 },
  descripcion: { fontSize: 13, color: "#555", marginVertical: 4 },
  precio: { fontSize: 14, fontWeight: "600", color: "#2E7D32" },
  stock: { fontSize: 12, color: "#333", marginTop: 4 },
  receta: { fontSize: 12, color: "#D84315", marginTop: 2 },
  addButton: {
    backgroundColor: "#1E88E5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: { color: "#fff", fontWeight: "600" },
  cartContainerWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#eef4ff",
    borderTopWidth: 1,
    borderTopColor: "#bbd0ff",
    zIndex: 1000,
    maxHeight: screenHeight * 0.45,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  cartScrollView: {
    maxHeight: screenHeight * 0.45,
  },
  cartContainer: {
    padding: 12,
    paddingBottom: 16,
    borderRadius: 12,
    backgroundColor: "#eef4ff",
  },
  cartTitle: { fontSize: 16, fontWeight: "700", color: "#1E88E5", marginBottom: 10 },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
    paddingVertical: 4,
  },
  cartItemName: { fontSize: 14, fontWeight: "600", color: "#1F2937", flexShrink: 1 },
  cartItemPrice: { fontSize: 13, color: "#2E7D32", marginTop: 2 },
  cartItemReceta: { fontSize: 11, color: "#374151", marginTop: 2 },
  cartActions: { flexDirection: "row", gap: 6, flexShrink: 0 },
  secondaryAction: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#E3F2FD",
  },
  secondaryActionText: { color: "#1E88E5", fontWeight: "600" },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#FFCDD2",
  },
  removeButtonText: { color: "#C62828", fontWeight: "600" },
  cartSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#bbd0ff",
  },
  summaryText: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  confirmButton: {
    backgroundColor: "#1E88E5",
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  confirmButtonText: { color: "#fff", fontWeight: "700", textAlign: "center", fontSize: 16 },
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
  quantityInput: {
    textAlign: "center",
  },
  inputError: {
    borderColor: "#e53935",
  },
  errorText: {
    color: "#e53935",
    fontSize: 13,
    marginTop: 6,
  },
  recetaInfo: { fontSize: 13, color: "#1F2937" },
  recetaAdjunta: { fontSize: 13, color: "#2E7D32", marginTop: 4 },
  recetaPendiente: { fontSize: 13, color: "#D84315", marginTop: 4 },
  attachButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#1E88E5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  attachButtonText: { color: "#fff", fontWeight: "600" },
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
