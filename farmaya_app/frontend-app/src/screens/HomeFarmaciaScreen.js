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
  Switch,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../api/api";
import { useTheme } from "../theme/ThemeProvider";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function HomeFarmaciaScreen({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [theme, insets]);
  const [farmacia, setFarmacia] = useState(null);
  const [productos, setProductos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pedidoProcesando, setPedidoProcesando] = useState(null);

  // Modal de edición
  const [modalVisible, setModalVisible] = useState(false);
  const [productoEdit, setProductoEdit] = useState(null);
  const [nombre, setNombre] = useState("");
  const [presentacion, setPresentacion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [requiereReceta, setRequiereReceta] = useState(false);

  // 🔹 Cargar datos del usuario (farmacia)
  const cargarFarmacia = async () => {
    try {
      const response = await API.get("usuarios/me/");
      setFarmacia(response.data);
    } catch (error) {
      console.error("❌ Error al cargar farmacia:", error.response?.data || error);
      Alert.alert("Error", "No se pudieron cargar los datos de la farmacia.");
    }
  };

  // 🔹 Cargar productos de la farmacia autenticada
  const cargarProductos = async () => {
    try {
      const response = await API.get("productos/");
      setProductos(response.data);
    } catch (error) {
      console.error("❌ Error al cargar productos:", error.response?.data || error);
      Alert.alert("Error", "No se pudieron cargar los productos.");
    }
  };

  // 🔹 Cargar pedidos recibidos
  const cargarPedidos = async () => {
    try {
      const response = await API.get("pedidos/");
      setPedidos(response.data);
    } catch (error) {
      console.error("❌ Error al cargar pedidos:", error.response?.data || error);
    }
  };

  const sincronizarAlmacenamientos = async (pedido) => {
    try {
      const rawId = pedido?.id ?? pedido?.ID ?? null;
      const id = rawId != null ? rawId.toString() : null;
      if (!id) return;

      const direccionEntrega =
        pedido.direccion_entrega || pedido.direccionEntrega || "Entrega a coordinar";
      const productoNombre =
        pedido.producto_nombre ||
        pedido.productoNombre ||
        pedido.producto?.nombre ||
        "Producto";
      const requiereReceta =
        pedido.requiere_receta ?? pedido.requiereReceta ?? pedido.producto?.requiere_receta ?? false;
      const clienteNombre = pedido.usuario_nombre || pedido.clienteNombre || "";
      const clienteEmail =
        pedido.usuario_email || pedido.usuario?.email || pedido.email || "";
      const fechaPedido = pedido.fecha || pedido.createdAt || new Date().toISOString();
      const farmaciaNombre = farmacia?.nombre || pedido.farmacia_nombre || "Farmacia";
      const farmaciaDireccion = farmacia?.direccion || pedido.farmaciaDireccion || "Dirección no disponible";

      // Actualizar pedidos de la farmacia
      const storedFarmacia = await AsyncStorage.getItem("farmaciaOrders");
      const pedidosFarmacia = storedFarmacia ? JSON.parse(storedFarmacia) : [];
      const indexFarmacia = pedidosFarmacia.findIndex((item) => item.id?.toString() === id);
      const pedidoFarmacia = {
        id,
        productoNombre,
        producto_nombre: productoNombre,
        cantidad: pedido.cantidad ?? 1,
        direccionEntrega,
        direccion_entrega: direccionEntrega,
        requiereReceta,
        estado: pedido.estado,
        farmaciaNombre,
        farmaciaDireccion,
        usuario_email: clienteEmail,
        clienteNombre,
        createdAt: fechaPedido,
      };

      if (indexFarmacia === -1) {
        pedidosFarmacia.push(pedidoFarmacia);
      } else {
        pedidosFarmacia[indexFarmacia] = {
          ...pedidosFarmacia[indexFarmacia],
          ...pedidoFarmacia,
        };
      }

      await AsyncStorage.setItem("farmaciaOrders", JSON.stringify(pedidosFarmacia));

      // Actualizar pedidos del cliente
      const storedCliente = await AsyncStorage.getItem("clienteOrders");
      if (storedCliente) {
        const pedidosCliente = JSON.parse(storedCliente);
        const actualizados = pedidosCliente.map((item) => {
          if (item.id?.toString() !== id) return item;

          let estadoCliente = item.estado;
          if (["aprobado", "aceptado"].includes(pedido.estado)) {
            estadoCliente = "aceptado";
          } else if (["enviado", "en_camino"].includes(pedido.estado)) {
            estadoCliente = "en_camino";
          } else if (pedido.estado === "entregado") {
            estadoCliente = "recibido";
          } else if (pedido.estado === "cancelado") {
            estadoCliente = "cancelado";
          } else if (pedido.estado === "pendiente" && requiereReceta) {
            estadoCliente = "creado";
          } else if (pedido.estado) {
            estadoCliente = pedido.estado;
          }

          return {
            ...item,
            estado: estadoCliente,
            direccionEntrega,
            productoNombre,
            producto_nombre: productoNombre,
          };
        });

        await AsyncStorage.setItem("clienteOrders", JSON.stringify(actualizados));
      }

      // Actualizar pedidos del repartidor
      const storedRepartidor = await AsyncStorage.getItem("pedidosRepartidor");
      const pedidosRepartidor = storedRepartidor ? JSON.parse(storedRepartidor) : [];
      const indexRepartidor = pedidosRepartidor.findIndex((item) => item.id?.toString() === id);

      if (["aprobado", "aceptado"].includes(pedido.estado)) {
        const pedidoRepartidor = {
          id,
          farmacia: farmaciaNombre,
          direccionFarmacia:
            farmaciaDireccion || pedidosRepartidor[indexRepartidor]?.direccionFarmacia || "Dirección de farmacia",
          direccionCliente: direccionEntrega,
          productos: productoNombre,
          requiereReceta,
          estado: "confirmado",
          distancia: pedidosRepartidor[indexRepartidor]?.distancia || 3.2,
          createdAt: fechaPedido,
        };

        if (indexRepartidor === -1) {
          pedidosRepartidor.push(pedidoRepartidor);
        } else {
          pedidosRepartidor[indexRepartidor] = {
            ...pedidosRepartidor[indexRepartidor],
            ...pedidoRepartidor,
          };
        }
      } else if (indexRepartidor !== -1) {
        pedidosRepartidor.splice(indexRepartidor, 1);
      }

      await AsyncStorage.setItem("pedidosRepartidor", JSON.stringify(pedidosRepartidor));
    } catch (storageError) {
      console.error("Error sincronizando almacenamiento:", storageError);
    }
  };

  // 🔹 Eliminar producto
  const eliminarProducto = async (id) => {
    Alert.alert("Confirmar", "¿Seguro que querés eliminar este producto?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await API.delete(`productos/${id}/`);
            setProductos(productos.filter((p) => p.id !== id));
          } catch (error) {
            Alert.alert("Error", "No se pudo eliminar el producto.");
          }
        },
      },
    ]);
  };

  // 🔹 Abrir modal de edición
  const abrirEdicion = (producto) => {
    setProductoEdit(producto);
    setNombre(producto.nombre);
    setPresentacion(producto.presentacion || "");
    setDescripcion(producto.descripcion || "");
    setPrecio(String(producto.precio));
    setStock(String(producto.stock));
    setRequiereReceta(producto.requiere_receta);
    setModalVisible(true);
  };

  // 🔹 Guardar cambios del producto
  const guardarCambios = async () => {
    try {
      await API.put(`productos/${productoEdit.id}/`, {
        nombre,
        presentacion,
        descripcion,
        precio: parseFloat(precio),
        stock: parseInt(stock),
        requiere_receta: requiereReceta,
      });
      setModalVisible(false);
      cargarProductos();
      Alert.alert("✅ Éxito", "Producto actualizado correctamente.");
    } catch (error) {
      console.error("❌ Error al actualizar producto:", error.response?.data || error);
      Alert.alert("Error", "No se pudo actualizar el producto.");
    }
  };

  // 🔹 useEffects
  useEffect(() => {
    (async () => {
      await cargarFarmacia();
      await cargarProductos();
      await cargarPedidos();
      setLoading(false);
    })();
  }, []);

  const abrirReceta = async (url) => {
    if (!url) {
      Alert.alert("Receta no disponible", "El pedido no tiene una receta adjunta.");
      return;
    }

    try {
      const soportado = await Linking.canOpenURL(url);
      if (!soportado) {
        Alert.alert(
          "No se pudo abrir",
          "No encontramos una aplicación para visualizar la receta adjunta."
        );
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.error("Error al abrir receta:", error);
      Alert.alert("Error", "No se pudo abrir la receta. Intentá nuevamente.");
    }
  };

  const actualizarEstadoPedido = async (id, nuevoEstado) => {
    try {
      setPedidoProcesando(id);
      const response = await API.patch(`pedidos/${id}/`, { estado: nuevoEstado });
      let pedidoActualizado = response.data;

      if (!pedidoActualizado || Object.keys(pedidoActualizado).length === 0) {
        const detalle = await API.get(`pedidos/${id}/`);
        pedidoActualizado = detalle.data;
      }

      const pedidoPrevio = pedidos.find((pedido) => pedido.id === id) || {};
      const pedidoCombinado = { ...pedidoPrevio, ...pedidoActualizado, id };

      setPedidos((prev) =>
        prev.map((pedido) => (pedido.id === id ? pedidoCombinado : pedido))
      );

      await sincronizarAlmacenamientos(pedidoCombinado);

      if (nuevoEstado === "aprobado") {
        Alert.alert("Pedido aceptado", "Confirmaste la preparación del pedido.");
      } else {
        Alert.alert("Pedido rechazado", "Notificamos al cliente sobre el rechazo.");
      }
    } catch (error) {
      console.error("Error al actualizar pedido:", error.response?.data || error);
      Alert.alert(
        "Error",
        error.response?.data?.detail || "No se pudo actualizar el pedido."
      );
    } finally {
      setPedidoProcesando(null);
    }
  };

  const renderProductItem = ({ item }) => (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardNombre}>{item.nombre}</Text>
        {item.presentacion ? (
          <Text style={styles.cardDetail}>💊 Presentación: {item.presentacion}</Text>
        ) : null}
        <Text style={styles.cardDetail}>💰 ${item.precio}</Text>
        <Text style={styles.cardDetail}>📦 Stock: {item.stock}</Text>
        <Text style={styles.cardDetail}>
          {item.requiere_receta ? "📋 Requiere receta" : "✅ Sin receta"}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => abrirEdicion(item)}>
          <Text style={styles.btnEditar}>📝</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => eliminarProducto(item.id)}>
          <Text style={styles.btnEliminar}>🗑</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <View style={styles.section}>
        <Text style={styles.title}>🏥 {farmacia?.nombre}</Text>
        <Text style={styles.info}>📍 {farmacia?.direccion}</Text>
        <Text style={styles.info}>📞 {farmacia?.telefono}</Text>
        <Text style={styles.info}>🕓 {farmacia?.horarios}</Text>
        <Text style={styles.info}>📧 {farmacia?.email}</Text>

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => navigation.navigate("EditarPerfilFarmacia")}
        >
          <Text style={styles.btnText}>✏️ Editar perfil</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>📦 Pedidos recibidos</Text>
        {pedidos.length === 0 ? (
          <Text style={styles.emptyText}>No hay pedidos por ahora</Text>
        ) : (
          pedidos.map((p) => (
            <View key={p.id} style={styles.cardPedido}>
              <Text style={styles.cardTitle}>Pedido #{p.id}</Text>
              <Text style={styles.cardDetail}>Cliente: {p.usuario_nombre || "Anónimo"}</Text>
              <Text style={styles.cardDetail}>Producto: {p.producto_nombre}</Text>
              <Text style={styles.cardDetail}>Cantidad: {p.cantidad}</Text>
              <Text style={styles.cardDetail}>Método de pago: {p.metodo_pago}</Text>
              <Text style={styles.estado}>Estado: {p.estado}</Text>

              {p.receta?.archivo_url && (
                <TouchableOpacity
                  style={styles.btnSecundario}
                  onPress={() => abrirReceta(p.receta.archivo_url)}
                >
                  <Text style={styles.btnSecundarioText}>📄 Ver receta</Text>
                </TouchableOpacity>
              )}

              <View style={styles.accionesPedido}>
                <TouchableOpacity
                  style={[styles.btnPedido, styles.btnAceptar]}
                  disabled={pedidoProcesando === p.id || p.estado === "aprobado"}
                  onPress={() => actualizarEstadoPedido(p.id, "aprobado")}
                >
                  <Text style={styles.btnPedidoText}>
                    {pedidoProcesando === p.id && p.estado !== "aprobado"
                      ? "Procesando..."
                      : "Aceptar"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPedido, styles.btnRechazar]}
                  disabled={pedidoProcesando === p.id || p.estado === "cancelado"}
                  onPress={() => actualizarEstadoPedido(p.id, "cancelado")}
                >
                  <Text style={styles.btnPedidoText}>Rechazar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>🧾 Mis productos</Text>
        <TouchableOpacity
          style={[styles.btnPrimary, styles.btnAccent]}
          onPress={() => navigation.navigate("AgregarProducto")}
        >
          <Text style={styles.btnText}>➕ Agregar producto</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyProducts = () => (
    <Text style={styles.emptyText}>No hay productos cargados todavía</Text>
  );

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <FlatList
        data={productos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderProductItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyProducts}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar producto</Text>

            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Nombre"
            />
            <TextInput
              style={styles.input}
              value={presentacion}
              onChangeText={setPresentacion}
              placeholder="Presentación"
            />
            <TextInput
              style={styles.input}
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Descripción"
            />
            <TextInput
              style={styles.input}
              value={precio}
              onChangeText={setPrecio}
              keyboardType="numeric"
              placeholder="Precio"
            />
            <TextInput
              style={styles.input}
              value={stock}
              onChangeText={setStock}
              keyboardType="numeric"
              placeholder="Stock"
            />
            <View style={styles.switchContainer}>
              <Text>¿Requiere receta?</Text>
              <Switch value={requiereReceta} onValueChange={setRequiereReceta} />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.btnGuardar} onPress={guardarCambios}>
                <Text style={styles.buttonText}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnGuardar, styles.btnCancelar]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonTextMuted}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// 🔹 Estilos
const createStyles = (theme, insets) => {
  const bottomInset = insets?.bottom ?? 0;

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    listContent: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 20 + bottomInset,
      backgroundColor: theme.colors.background,
    },
    headerContent: {
      gap: 24,
      marginBottom: 16,
    },
    section: {
      gap: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      marginBottom: 5,
      color: theme.colors.text,
    },
    info: { fontSize: 15, color: theme.colors.textSecondary },
    subtitle: {
      fontSize: 18,
      fontWeight: "bold",
      marginTop: 25,
      marginBottom: 12,
      color: theme.colors.text,
    },
    btnPrimary: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      marginVertical: 12,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.22,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 10,
      elevation: 3,
    },
    btnText: { color: theme.colors.buttonText, fontWeight: "bold", fontSize: 16 },
    btnAccent: { backgroundColor: theme.colors.accent },
    emptyText: { textAlign: "center", marginTop: 12, color: theme.colors.textSecondary },
    card: {
      backgroundColor: theme.colors.surface,
      padding: 16,
      borderRadius: 14,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 10,
    },
    cardPedido: {
      backgroundColor: theme.colors.surface,
      padding: 18,
      borderRadius: 16,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardTitle: { fontWeight: "bold", fontSize: 16, marginBottom: 4, color: theme.colors.text },
    estado: { marginTop: 4, fontWeight: "600", color: theme.colors.accent },
    cardNombre: { fontSize: 18, fontWeight: "bold", color: theme.colors.text },
    cardActions: { flexDirection: "row", marginLeft: 10 },
    btnEditar: { fontSize: 22, marginHorizontal: 6, color: theme.colors.accent },
    btnEliminar: { fontSize: 22, marginHorizontal: 6, color: "#D97767" },
    cardDetail: { color: theme.colors.textSecondary, marginBottom: 4 },
    btnSecundario: {
      marginTop: 10,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: theme.colors.muted,
      alignSelf: "flex-start",
    },
    btnSecundarioText: {
      color: theme.colors.accent,
      fontWeight: "600",
    },
    accionesPedido: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 14,
      gap: 12,
    },
    btnPedido: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    btnAceptar: {
      backgroundColor: theme.colors.primary,
    },
    btnRechazar: {
      backgroundColor: theme.colors.accent,
    },
    btnPedidoText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.4)",
      padding: 20,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 22,
      width: "90%",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 18,
      textAlign: "center",
      color: theme.colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 14,
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
    },
    switchContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-around",
      marginTop: 16,
      gap: 12,
    },
    btnGuardar: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      flex: 1,
    },
    btnCancelar: {
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    buttonText: { color: theme.colors.buttonText, fontWeight: "bold" },
    buttonTextMuted: { color: theme.colors.text, fontWeight: "bold" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    loadingText: { marginTop: 12, color: theme.colors.textSecondary },
  });
};
