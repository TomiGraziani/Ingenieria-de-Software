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
  Switch,
  ScrollView,
  Linking,
} from "react-native";
import API from "../api/api";

export default function HomeFarmaciaScreen({ navigation }) {
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
      await API.patch(`pedidos/${id}/`, { estado: nuevoEstado });
      setPedidos((prev) =>
        prev.map((pedido) =>
          pedido.id === id ? { ...pedido, estado: nuevoEstado } : pedido
        )
      );

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1E88E5" />
        <Text>Cargando...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* 🔹 Datos farmacia */}
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

      {/* 🔹 Pedidos recibidos */}
      <Text style={styles.subtitle}>📦 Pedidos recibidos</Text>
      {pedidos.length === 0 ? (
        <Text style={styles.emptyText}>No hay pedidos por ahora</Text>
      ) : (
        pedidos.map((p) => (
          <View key={p.id} style={styles.cardPedido}>
            <Text style={styles.cardTitle}>Pedido #{p.id}</Text>
            <Text>Cliente: {p.usuario_nombre || "Anónimo"}</Text>
            <Text>Producto: {p.producto_nombre}</Text>
            <Text>Cantidad: {p.cantidad}</Text>
            <Text>Método de pago: {p.metodo_pago}</Text>
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

      {/* 🔹 Productos */}
      <Text style={styles.subtitle}>🧾 Mis productos</Text>
      <TouchableOpacity
        style={[styles.btnPrimary, { backgroundColor: "#43a047" }]}
        onPress={() => navigation.navigate("AgregarProducto")}
      >
        <Text style={styles.btnText}>➕ Agregar producto</Text>
      </TouchableOpacity>

      {productos.length === 0 ? (
        <Text style={styles.emptyText}>No hay productos cargados todavía</Text>
      ) : (
        <FlatList
          data={productos}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardNombre}>{item.nombre}</Text>
                {item.presentacion ? (
                  <Text>💊 Presentación: {item.presentacion}</Text>
                ) : null}
                <Text>💰 ${item.precio}</Text>
                <Text>📦 Stock: {item.stock}</Text>
                <Text>
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
          )}
        />
      )}

      {/* 🔹 Modal de edición */}
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
                style={[styles.btnGuardar, { backgroundColor: "#9e9e9e" }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// 🔹 Estilos
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 5 },
  info: { fontSize: 15, color: "#444" },
  subtitle: { fontSize: 18, fontWeight: "bold", marginTop: 25, marginBottom: 10 },
  btnPrimary: {
    backgroundColor: "#1E88E5",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 10,
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  emptyText: { textAlign: "center", marginTop: 10, color: "#777" },
  card: {
    backgroundColor: "#f6f6f6",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  cardPedido: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontWeight: "bold", fontSize: 16, marginBottom: 5 },
  estado: { marginTop: 4, fontWeight: "600" },
  cardNombre: { fontSize: 18, fontWeight: "bold" },
  cardActions: { flexDirection: "row", marginLeft: 10 },
  btnEditar: { fontSize: 22, marginHorizontal: 6 },
  btnEliminar: { fontSize: 22, marginHorizontal: 6, color: "red" },
  btnSecundario: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#e3f2fd",
    alignSelf: "flex-start",
  },
  btnSecundarioText: {
    color: "#1565c0",
    fontWeight: "600",
  },
  accionesPedido: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 10,
  },
  btnPedido: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  btnAceptar: {
    backgroundColor: "#43a047",
  },
  btnRechazar: {
    backgroundColor: "#e53935",
  },
  btnPedidoText: {
    color: "#fff",
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    width: "85%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  btnGuardar: {
    backgroundColor: "#43a047",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    width: "40%",
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
