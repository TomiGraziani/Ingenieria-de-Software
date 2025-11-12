import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View, ActivityIndicator, Alert } from 'react-native';
import API from '../api/api';
import ErrorModal from '../components/ErrorModal';
import { extractErrorMessage } from '../utils/errorHandler';

export default function ProfileScreen() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 🔹 Cargar datos del usuario desde el backend
  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert('Error', 'Sesión no encontrada. Inicie sesión nuevamente.');
        return;
      }

      const response = await API.get('usuarios/me/', {

        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error al cargar el perfil:', error.response?.data || error);
      Alert.alert('Error', 'No se pudieron cargar los datos del usuario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  // Función para validar que solo contenga letras y espacios en blanco
  const validarNombre = (texto, textoAnterior) => {
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

  const handleChange = (key, value) => {
    // Si es el campo nombre, aplicar validación
    if (key === 'nombre') {
      const nombreAnterior = user?.nombre || '';
      value = validarNombre(value, nombreAnterior);
    }
    setUser({ ...user, [key]: value });
  };

  // 🔹 Guardar cambios en el backend
  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('accessToken');
      const response = await API.put('usuarios/me/', user, {

        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data);
      await AsyncStorage.setItem('user', JSON.stringify(response.data));
      Alert.alert('✅ Éxito', 'Perfil actualizado correctamente.');
    } catch (error) {
      // Extraer mensaje de error amigable del backend
      const friendlyMessage = extractErrorMessage(error);

      // Mostrar el modal de error en lugar del Alert
      setErrorMessage(friendlyMessage);
      setErrorModalVisible(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <ActivityIndicator size="large" color="#007AFF" style={{ flex: 1 }} />;
  if (!user) return <Text>Error al cargar usuario</Text>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mi Perfil</Text>

      <TextInput
        style={styles.input}
        value={user.email}
        editable={false}
        placeholder="Email"
      />

      <TextInput
        style={styles.input}
        value={user.nombre || ''}
        onChangeText={(text) => handleChange('nombre', text)}
        placeholder="Nombre"
        autoCapitalize="words"
      />

      <TextInput
        style={styles.input}
        value={user.direccion || ''}
        onChangeText={(text) => handleChange('direccion', text)}
        placeholder="Dirección"
      />

      <TextInput
        style={styles.input}
        value={user.telefono || ''}
        onChangeText={(text) => handleChange('telefono', text)}
        placeholder="Teléfono"
        keyboardType="phone-pad"
      />

      <TextInput
        style={styles.input}
        value={user.horarios || ''}
        onChangeText={(text) => handleChange('horarios', text)}
        placeholder="Horarios de atención"
      />

      <Text style={{ marginBottom: 20, fontWeight: '500' }}>
        Rol: {user.tipo_usuario}
      </Text>

      <Button
        title={saving ? 'Guardando...' : 'Guardar cambios'}
        onPress={handleSave}
        color="#1E88E5"
        disabled={saving}
      />
      <ErrorModal
        visible={errorModalVisible}
        message={errorMessage}
        onClose={() => setErrorModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#1E88E5' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    fontSize: 15,
  },
});
