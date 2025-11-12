import { useState } from "react";
import {
  Alert,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import API from "../api/api";
import { useTheme } from '../theme/ThemeProvider';

export default function AgregarProductoScreen({ navigation }) {
  const [nombre, setNombre] = useState("");
  const [presentacion, setPresentacion] = useState(""); // 👈 nuevo campo
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [requiereReceta, setRequiereReceta] = useState(false);
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const styles = createStyles(theme);

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
          placeholderTextColor={theme.colors.textSecondary}
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
          placeholderTextColor={theme.colors.textSecondary}
          value={presentacion}
          onChangeText={setPresentacion}
        />

        <TextInput
          style={[styles.input, { height: 80 }]}
          placeholder="Descripción"
          placeholderTextColor={theme.colors.textSecondary}
          value={descripcion}
          onChangeText={setDescripcion}
          multiline
        />

        <TextInput
          style={styles.input}
          placeholder="Precio"
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType="numeric"
          value={precio}
          onChangeText={setPrecio}
        />

        <TextInput
          style={styles.input}
          placeholder="Stock disponible"
          placeholderTextColor={theme.colors.textSecondary}
          keyboardType="numeric"
          value={stock}
          onChangeText={setStock}
        />

        <View style={styles.switchContainer}>
          <Text style={styles.label}>¿Requiere receta?</Text>
          <Switch value={requiereReceta} onValueChange={setRequiereReceta} />
        </View>

        <Button
          title={loading ? "Guardando..." : "Guardar producto"}
          color= {theme.colors.primary}
          shadowRadius= {12}
          onPress={handleGuardarProducto}
          disabled={loading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// 🎨 Estilos
const createStyles = (theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background, },
    scrollView: { flex: 1, padding: 20 },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.colors.text,
      marginBottom: 20,
      textAlign: "center",
    },
    label: {
      fontSize: 16,
      color: theme.colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 18,
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
      fontSize: 16,
    },
    switchContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 25,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      marginTop: 6,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    primaryButtonText: {
      color: theme.colors.buttonText,
      fontWeight: '700',
      fontSize: 16,
    },
  });
