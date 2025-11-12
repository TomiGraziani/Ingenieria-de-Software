import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Button,
  Switch,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import API from "../api/api";

export default function AgregarProductoScreen({ navigation }) {
  const [nombre, setNombre] = useState("");
  const [presentacion, setPresentacion] = useState(""); // 👈 nuevo campo
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [requiereReceta, setRequiereReceta] = useState(false);
  const [loading, setLoading] = useState(false);

  // Función para validar que solo contenga letras y espacios en blanco
  const validarNombreProducto = (texto, textoAnterior) => {
    // Detecta si se intentó ingresar un número u otro carácter no válido
    const tieneNumerosOCaracteresEspeciales = /[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/.test(texto);

    if (tieneNumerosOCaracteresEspeciales) {
      Alert.alert('Error', 'No se admiten numeros en el nombre ingrese un nombre valido');
      // Mantener el texto anterior (sin los números)
      return textoAnterior || '';
    }

    // Si es válido, permitir el cambio
    return texto;
  };

  // 🔹 Validaciones y envío
  const handleGuardarProducto = async () => {
    if (!nombre.trim() || !precio.trim() || !stock.trim() || !presentacion.trim()) {
      Alert.alert("Error", "Por favor completá nombre, precio, stock y presentación.");
      return;
    }

    setLoading(true);
    try {
      const response = await API.post("productos/", {
        nombre,
        presentacion, // ✅ agregado
        descripcion,
        precio: parseFloat(precio),
        stock: parseInt(stock),
        requiere_receta: requiereReceta,
      });

      console.log("✅ Producto creado:", response.data);
      Alert.alert("✅ Éxito", "Producto agregado correctamente.", [
        {
          text: "OK",
          onPress: () => {
            // Volver a la pantalla anterior, useFocusEffect se encargará de refrescar
            navigation.goBack();
          }
        },
      ]);
    } catch (error) {
      console.error("❌ Error al crear producto:", error.response?.data || error);
      Alert.alert(
        "Error",
        error.response?.data?.detail || "No se pudo agregar el producto."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>🧾 Nuevo producto</Text>

        <TextInput
          style={styles.input}
          placeholder="Nombre del producto"
          value={nombre}
          onChangeText={(text) => {
            const nombreValidado = validarNombreProducto(text, nombre);
            setNombre(nombreValidado);
          }}
          autoCapitalize="words"
        />

        <TextInput
          style={styles.input}
          placeholder="Presentación (ej: 500 mg, 200 ml)"
          value={presentacion}
          onChangeText={setPresentacion}
        />

        <TextInput
          style={[styles.input, { height: 80 }]}
          placeholder="Descripción"
          value={descripcion}
          onChangeText={setDescripcion}
          multiline
        />

        <TextInput
          style={styles.input}
          placeholder="Precio"
          keyboardType="numeric"
          value={precio}
          onChangeText={setPrecio}
        />

        <TextInput
          style={styles.input}
          placeholder="Stock disponible"
          keyboardType="numeric"
          value={stock}
          onChangeText={setStock}
        />

        <View style={styles.switchContainer}>
          <Text style={{ fontSize: 16 }}>¿Requiere receta?</Text>
          <Switch value={requiereReceta} onValueChange={setRequiereReceta} />
        </View>

        <Button
          title={loading ? "Guardando..." : "Guardar producto"}
          color="#1E88E5"
          onPress={handleGuardarProducto}
          disabled={loading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// 🎨 Estilos
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollView: { flex: 1, padding: 20 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1E88E5",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
});
