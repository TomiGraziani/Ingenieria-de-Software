import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../api/api";
import * as DocumentPicker from "expo-document-picker";

export default function ProductosFarmaciaScreen({ route, navigation }) {
  const { farmacia } = route.params;
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procesandoPedido, setProcesandoPedido] = useState(false);

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
            resolve(null);
            return;
          }

          resolve(result.assets[0]);
        } catch (error) {
          console.error("Error al seleccionar receta:", error);
          Alert.alert("Error", "No se pudo seleccionar el archivo de la receta.");
          resolve(null);
        }
      };

      Alert.alert(
        "Receta necesaria",
        "Este medicamento requiere que adjuntes una receta médica.",
        [
          { text: "Cancelar", style: "cancel", onPress: () => resolve(null) },
          { text: "Adjuntar receta", onPress: () => abrirPicker() },
        ],
        { cancelable: false }
      );
    });

  // 🔹 Crear pedido en el backend
  const realizarPedido = async (producto) => {
    try {
      if (procesandoPedido) {
        return;
      }

      setProcesandoPedido(true);

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
      formData.append("direccion_entrega", "Entrega a domicilio");
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

      const pedidoId = response.data?.id?.toString?.() ?? Date.now().toString();
      const requiereReceta = !!producto.requiere_receta;
      const createdAt = new Date().toISOString();

      const nuevoPedidoCliente = {
        id: pedidoId,
        productoId: producto.id,
        productoNombre: producto.nombre,
        farmaciaId: farmacia.id,
        farmaciaNombre: farmacia.nombre,
        farmaciaDireccion: farmacia.direccion || "Dirección no disponible",
        cantidad: payload.cantidad,
        direccionEntrega: payload.direccion_entrega,
        requiereReceta,
        estado: requiereReceta ? "creado" : "aceptado",
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
        estado: requiereReceta ? "pendiente" : "aceptado",
        usuario_email: usuario?.email,
        clienteNombre: usuario?.nombre,
        recetaPendiente: requiereReceta,
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
          direccionCliente: payload.direccion_entrega,
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
                  { text: "Confirmar", onPress: () => realizarPedido(item) },
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
});
