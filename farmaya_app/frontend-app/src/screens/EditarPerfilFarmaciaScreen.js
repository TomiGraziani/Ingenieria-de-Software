import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import API from "../api/api";
import { useTheme } from "./../theme/ThemeProvider";

export default function EditarPerfilFarmaciaScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [farmacia, setFarmacia] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 🔹 Cargar datos de la farmacia
  useEffect(() => {
    const loadData = async () => {
      try {
        const token = await AsyncStorage.getItem("accessToken");
        if (!token) {
          Alert.alert("Sesión expirada", "Por favor, inicia sesión nuevamente.");
          navigation.replace("Login");
          return;
        }

        // ✅ Ruta corregida
        const response = await API.get("usuarios/me/", {
          headers: { Authorization: `Bearer ${token}` },
        });

        setFarmacia(response.data);
      } catch (error) {
        console.error("Error cargando datos:", error.response?.data || error);
        Alert.alert("Error", "No se pudieron cargar los datos del perfil.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // 🔹 Guardar cambios
  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("accessToken");

      // ✅ Ruta corregida
      const response = await API.put("usuarios/me/", farmacia, {
        headers: { Authorization: `Bearer ${token}` },
      });

      await AsyncStorage.setItem("user", JSON.stringify(response.data));
      Alert.alert("✅ Guardado", "Datos actualizados correctamente.");
      navigation.goBack();
    } catch (error) {
      console.error("Error al guardar cambios:", error.response?.data || error);
      Alert.alert("Error", "No se pudo actualizar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#1E88E5" style={{ flex: 1 }} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Editar Perfil</Text>

      {["direccion", "telefono", "horarios"].map((field) => (
        <TextInput
          key={field}
          style={styles.input}
          placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
          placeholderTextColor={theme.colors.textSecondary}
          value={farmacia?.[field] || ""}
          onChangeText={(text) => setFarmacia({ ...farmacia, [field]: text })}
        />
      ))}

      <TouchableOpacity
        style={[styles.saveButton, saving && { backgroundColor: "#999" }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>
          {saving ? "💾 Guardando..." : "💾 Guardar cambios"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (theme) =>
  StyleSheet.create({
    container: { flex: 1, padding: 20, marginTop: 30, backgroundColor: theme.colors.background },
    title: { color: theme.colors.text, fontSize: 22, fontWeight: "bold", marginBottom: 20, textAlign: "center" },
    input: {
      backgroundColor: theme.colors.card,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      borderRadius: 8,
      marginBottom: 12,
    },
    saveButton: {
      backgroundColor: theme.colors.primary,
      padding: 12,
      borderRadius: 8,
      marginTop: 10,
    },
    saveButtonText: { color: theme.colors.buttonText, textAlign: "center", fontWeight: '700', fontSize: 16 },
  });
